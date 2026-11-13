// src/pages/DashboardPageV7.jsx
import { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import {
  stockApi,
  quoteApi,
  articleApi,
  watchlistApi,
  authApi,
  boardApi,
  statusApi,
  searchApi,
  tokenStore,
} from '../api';
import {
  toUiStock,
  toUiArticle,
  toUiSummary,
  toUiBoardComment,
  toDisplayTime,
  SENTIMENT_LABEL,
  SENTIMENT_NONE_LABEL,
} from '../api/adapters';
import { useApi } from '../hooks/useApi';
import { useQuoteStream } from '../hooks/useQuoteStream';
import '../styles/dashboardV7.css';

// 1계층: 왼쪽 사이드바 네비게이션 메뉴 (장소 이동 전용)
const NAV_ITEMS = [
  { key: 'home', icon: '🏠', label: '홈', title: '시장 종합 & 실시간 뉴스·공시 매칭' },
  { key: 'stock', icon: '📊', label: '종목', title: '종목 탐색 & 개별 종목 대시보드' },
  { key: 'watchlist', icon: '⭐', label: '관심 종목', title: '내 관심 종목 & 뉴스·공시 모아보기' },
];

// 2계층: 개별 종목 상세 내부 가로 탭 (.stock-tabs)
const STOCK_TABS = [
  { key: 'summary', icon: '📑', label: '요약·감성' },
  { key: 'news', icon: '📰', label: '뉴스·공시' },
  { key: 'mention', icon: '📈', label: '언급량 추이' },
  { key: 'board', icon: '🗣️', label: '종목 토론' },
];

// 상단 시장 지수 3단 요약 데이터 (복원)
const MARKET_INDICES_DATA = [
  {
    key: 'KOSPI',
    name: '코스피',
    value: '-',
    changeText: '시세 연동 전',
    tone: 'neu',
  },
  {
    key: 'KOSDAQ',
    name: '코스닥',
    value: '-',
    changeText: '시세 연동 전',
    tone: 'neu',
  },
  {
    key: 'USD_KRW',
    name: '원/달러',
    value: '-',
    changeText: '시세 연동 전',
    tone: 'neu',
  },
];

const TREND_PERIODS = [
  { key: 'today', label: '오늘 (1시간)' },
  { key: '7d', label: '7일 (1일)' },
  { key: '30d', label: '30일 (1일)' },
];

const ARTICLE_PERIODS = [
  { key: 'ALL', label: '전체 기간' },
  { key: '0', label: '오늘' },
  { key: '7', label: '7일' },
  { key: '30', label: '30일' },
];

// 출처 탭: SNS는 1차에서 수집하지 않음(#93) → 뉴스와 공시(DART)만
const CHANNEL_FILTERS = [
  { key: 'ALL', label: '전체' },
  { key: 'NEWS', label: '📰 뉴스' },
  { key: 'DISCLOSURE', label: '📑 공시' },
];

// 기사 내용 감성 (주가 판단 낱말은 쓰지 않음). NONE = 판단 보류 (AI가 판단하지 않은 글, 제목만 연결한 기사 등)
const SENTIMENT_KEYS = ['POSITIVE', 'NEGATIVE', 'NEUTRAL'];
const sentimentKeyOf = (sentiment) => {
  const norm = sentiment ? String(sentiment).toUpperCase().trim() : '';
  return SENTIMENT_KEYS.includes(norm) ? norm : 'NONE';
};
const matchesSentiment = (art, filter) => filter === 'ALL' || sentimentKeyOf(art.sentiment) === filter;
const matchesChannel = (art, filter) =>
  filter === 'ALL' || (filter === 'DISCLOSURE' ? art.isDisclosure : !art.isDisclosure);
const countSentiments = (articles) => {
  const counts = { total: articles.length, pos: 0, neg: 0, neu: 0, none: 0 };
  articles.forEach((a) => {
    const key = sentimentKeyOf(a.sentiment);
    if (key === 'POSITIVE') counts.pos += 1;
    else if (key === 'NEGATIVE') counts.neg += 1;
    else if (key === 'NEUTRAL') counts.neu += 1;
    else counts.none += 1;
  });
  return counts;
};
const sentimentChips = (counts) => [
  { key: 'ALL', label: '전체', count: counts.total, cls: 'sent-chip-all' },
  { key: 'POSITIVE', label: '긍정', count: counts.pos, cls: 'sent-chip-pos' },
  { key: 'NEGATIVE', label: '부정', count: counts.neg, cls: 'sent-chip-neg' },
  { key: 'NEUTRAL', label: '중립', count: counts.neu, cls: 'sent-chip-neu' },
  { key: 'NONE', label: SENTIMENT_NONE_LABEL, count: counts.none, cls: 'sent-chip-none' },
];
// 글이 고른 종목들(codes) 중 하나를 주인공(MAIN)으로 다루는가 → "주인공 먼저" 정렬, "주인공인 글만" 거르기
const isMainFor = (art, codes) =>
  (art.relatedStocks || []).some((r) => codes.includes(r.code) && r.role === 'MAIN');
const sortArticles = (list, sort, codes) =>
  [...list].sort((a, b) => {
    if (sort === 'main') {
      const diff = (isMainFor(a, codes) ? 0 : 1) - (isMainFor(b, codes) ? 0 : 1);
      if (diff !== 0) return diff;
    }
    return b.publishedAt.localeCompare(a.publishedAt);
  });

const AI_NOTE_TEXT = 'AI가 기사 내용으로 판단 · 주가 예측 아님 · 틀릴 수 있음';
const PRICE_MOVE_TIP = '제목이 주가가 이미 움직인 뒤 쓴 기사입니다(이미 반영됐을 수 있음)';
const CORRECTION_TIP = '이미 낸 공시를 고쳐 다시 낸 정정 공시입니다(새 소식이 아닐 수 있음)';
const SAME_NEWS_TIP = '같은 종목·24시간 안·제목이 비슷한 기사를 같은 소식으로 묶은 수입니다(묶음은 틀릴 수 있음)';

const COMMENT_TAGS = {
  summary: { label: '뉴스', className: 'tag-news' },
  news: { label: '뉴스', className: 'tag-news' },
  // 예전에 쓴 [SNS] 말머리 의견도 그대로 보이게 남겨 둠 (새로 고르는 말머리에서는 뺌)
  sns: { label: 'SNS', className: 'tag-sns' },
  mention: { label: '언급량', className: 'tag-mention' },
  board: { label: '뉴스', className: 'tag-news' },
};
const COMMENT_TAG_PATTERN = /^\[(뉴스|SNS|언급량)\]\s*/;
// 의견 하나 = 게시판 글 하나 (서버 게시판 제목 칸이 200자라 그 길이에 맞춤)
const COMMENT_MAX_LENGTH = 200;
// 오늘의 이슈 종목: 홈 TOP 7, 종목 탐색 기본 목록은 같은 응답의 앞쪽 50개
const ISSUE_LIMIT = 50;
const PERIOD_PARAM = { 0: 'today', 7: '7d', 30: '30d' };

const formatRate = (rate) => {
  if (rate === null || rate === undefined || Number.isNaN(Number(rate))) return '0.00%';
  const num = Number(rate);
  return `${num > 0 ? '+' : ''}${num.toFixed(2)}%`;
};

const rateTone = (rate) => {
  const num = Number(rate ?? 0);
  if (num > 0) return 'up';
  if (num < 0) return 'down';
  return 'flat';
};

const formatPercent = (value) => `${(Math.round(value * 10) / 10).toFixed(1)}%`;

const nowTimeShort = () => {
  const now = new Date();
  const hh = String(now.getHours()).padStart(2, '0');
  const mm = String(now.getMinutes()).padStart(2, '0');
  return `${hh}:${mm}`;
};

const formatDateTime = (iso) => {
  if (!iso) return '';
  if (iso.includes('T')) return iso.slice(5, 16).replace('T', ' ');
  return iso;
};

const parseComment = (content) => {
  const str = String(content || '');
  const match = str.match(COMMENT_TAG_PATTERN);
  if (!match) return { tagKey: null, text: str };
  const tagKey =
    Object.keys(COMMENT_TAGS).find((key) => COMMENT_TAGS[key].label === match[1]) ?? null;
  return { tagKey, text: str.slice(match[0].length) };
};

const niceScale = (maxValue, tickCount = 4) => {
  const rough = Math.max(maxValue, 1) / tickCount;
  const pow = 10 ** Math.floor(Math.log10(rough));
  const step = [1, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10]
    .map((m) => m * pow)
    .find((s) => s >= rough);
  const intStep = Math.max(1, Math.ceil(step));
  return {
    yMax: intStep * tickCount,
    ticks: Array.from({ length: tickCount + 1 }, (_, i) => i * intStep),
  };
};

function RatePill({ rate, size = 'md' }) {
  if (rate === null || rate === undefined || Number.isNaN(Number(rate))) {
    return <span className="quote-pending-chip">시세 연동 전</span>;
  }
  const tone = rateTone(rate);
  const arrow = tone === 'up' ? '▲' : tone === 'down' ? '▼' : '';
  return (
    <span className={`rate-pill ${tone} ${size}`}>
      {arrow && <span className="rate-arrow">{arrow}</span>}
      {formatRate(rate)}
    </span>
  );
}

// [V7] C2: 가격/등락률 전용 렌더링 헬퍼 (목업 숫자 73,200원 등 배제)
/**
 * 시세 기준 문구: 가장 최근 시세 시각 + 장중이면 "실시간"/"장중", 아니면 "장 마감".
 * 장 시간은 한국 시간 평일 09:00~15:30 으로만 봄 (공휴일은 따지지 않음). 시세가 하나도 없으면 '' (KIS 꺼진 PC)
 */
function quoteBasisText(quotes) {
  const shown = quotes.filter((q) => q?.fetchedAt);
  if (shown.length === 0) return '';
  const last = shown.map((q) => String(q.fetchedAt)).sort().at(-1);
  const hhmm = last.slice(11, 16); // 서버 시각은 +09:00 (docs/api.md)
  const kstDay = new Date(Date.parse(last) + 9 * 3600 * 1000).getUTCDay(); // 0 일요일 ~ 6 토요일
  const open = kstDay >= 1 && kstDay <= 5 && hhmm >= '09:00' && hhmm <= '15:30';
  if (!open) return `${hhmm} 기준 · 장 마감 (마지막 체결가)`;
  return `${hhmm} 기준 · ${shown.some((q) => q.live) ? '실시간' : '장중 (몇 초마다 갱신)'}`;
}

function QuotePrice({ price, className = '' }) {
  if (price === null || price === undefined || Number.isNaN(Number(price))) {
    return <span className={`num quote-pending-text ${className}`}>-</span>;
  }
  return <span className={`num ${className}`}>{Number(price).toLocaleString()}원</span>;
}

function QuoteRate({ rate, size = 'sm' }) {
  if (rate === null || rate === undefined || Number.isNaN(Number(rate))) {
    return <span className="quote-pending-chip">시세 연동 전</span>;
  }
  return <RatePill rate={rate} size={size} />;
}

// 기사 내용 감성 배지: "기사 내용: 긍정 / 부정 / 중립". 판단하지 않은 글(null)은 "판단 보류"
// (주가 판단 낱말은 쓰지 않음. 판단은 투자자, 화면은 기사 내용 정보만)
const SENTIMENT_BADGE_CLASS = { POSITIVE: 'trend-up', NEGATIVE: 'trend-down', NEUTRAL: 'trend-neutral' };
function SentimentBadge({ sentiment, short = false }) {
  const key = sentimentKeyOf(sentiment);
  if (key === 'NONE') {
    return (
      <span className="trend-badge trend-hold" title="AI가 기사 내용을 판단하지 않은 글입니다">
        {SENTIMENT_NONE_LABEL}
      </span>
    );
  }
  return (
    <span className={`trend-badge ${SENTIMENT_BADGE_CLASS[key]}`}>
      {short ? SENTIMENT_LABEL[key] : `기사 내용: ${SENTIMENT_LABEL[key]}`}
    </span>
  );
}

// 글마다 붙는 '기사 내용' 배지. 제목만 연결한 기사는 판단 보류와 다른 이유라 따로 알려 줌
const TITLE_ONLY_TIP = '이 언론사는 기사에 AI 활용 금지를 밝혀서, 본문을 읽지 않고 제목으로만 종목을 연결했어요. 내용은 원문에서 확인해 주세요.';
const DISCLOSURE_PENDING_TIP = '공시 원문을 아직 AI가 읽지 않았어요. 잠시 뒤 요약과 함께 표시돼요.';
function JudgeBadge({ article, short = false }) {
  if (article.titleOnly) {
    return (
      <span className="trend-badge trend-hold title-only" title={TITLE_ONLY_TIP} aria-label={TITLE_ONLY_TIP}>
        제목만 확인
      </span>
    );
  }
  if (article.disclosurePending) {
    return (
      <span className="trend-badge trend-hold" title={DISCLOSURE_PENDING_TIP} aria-label={DISCLOSURE_PENDING_TIP}>
        원문 확인 전
      </span>
    );
  }
  return <SentimentBadge sentiment={article.sentiment} short={short} />;
}

// 요약이 없을 때 이유별 안내 (원문 링크는 상세 화면 아래에 늘 있음)
const missingSummaryText = (article) => {
  if (article.titleOnly) return 'AI 활용을 금지한 언론사 기사라 요약하지 않았어요 · 원문 보기로 확인해 주세요';
  if (article.disclosurePending) return '공시 원문을 아직 요약하지 않았어요 · 잠시 뒤 다시 보거나 원문 보기로 확인해 주세요';
  return 'AI 요약 없음 · 원문 보기로 확인해 주세요';
};

// 감성·요약 옆에 붙이는 짧은 안내
function AiNote({ className = '' }) {
  return <span className={`ai-note ${className}`}>{AI_NOTE_TEXT}</span>;
}

// 글의 정보 표시 (판단 없이 제목·출처에서 읽은 사실만): 주가 움직임 뒤 기사, 해석이 갈리는 공시
function ArticleInfoBadges({ article, withNote = false }) {
  if (!article) return null;
  return (
    <>
      {article.priceMoveTitle && (
        <span className="info-badge" title={PRICE_MOVE_TIP} aria-label={PRICE_MOVE_TIP}>
          주가 움직임 뒤 기사
        </span>
      )}
      {article.disclosureCorrection && (
        <span className="info-badge" title={CORRECTION_TIP} aria-label={CORRECTION_TIP}>
          정정 공시
        </span>
      )}
      {article.sameNewsCount >= 2 && (
        <span className="info-badge" title={SAME_NEWS_TIP} aria-label={SAME_NEWS_TIP}>
          {article.firstReport
            ? `첫 보도 · 같은 소식 ${article.sameNewsCount}건`
            : `같은 소식 ${article.sameNewsCount}건${article.firstReportPress ? ` · 첫 보도 ${article.firstReportPress}` : ''}`}
        </span>
      )}
      {withNote && article.contextDependent && (
        <span className="info-badge">목적·방식에 따라 해석이 달라지는 공시입니다</span>
      )}
    </>
  );
}

// 출처 표시: 공시면 "공시(의무/자율/공정공시) · 유형", 아니면 뉴스 (예전 SNS 글이 남아 있으면 SNS)
const sourceLabelOf = (art, { long = false } = {}) => {
  if (art.sourceType === 'SNS') return long ? 'SNS 게시글' : 'SNS';
  if (art.isDisclosure) {
    const head = art.disclosureKindLabel ? `공시(${art.disclosureKindLabel})` : '공시';
    return art.disclosureType ? `${head} · ${art.disclosureType}` : head;
  }
  return long ? '뉴스 기사' : '뉴스';
};

// 역할 배지: 주인공 / 함께 언급 (관련도 % 대신)
function RoleBadge({ role }) {
  if (role !== 'MAIN' && role !== 'MENTIONED') return null;
  return (
    <span className={`role-badge ${role === 'MAIN' ? 'main' : 'mentioned'}`}>
      {role === 'MAIN' ? '주인공' : '함께 언급'}
    </span>
  );
}

function SentimentBar({ ratio }) {
  const pos = Number(ratio?.positive ?? 0);
  const neu = Number(ratio?.neutral ?? 0);
  const neg = Number(ratio?.negative ?? 0);
  // 오늘 감성을 판단한 글이 없으면 비율을 지어내지 않고 그렇다고 알림
  if (pos + neu + neg === 0) {
    return (
      <div className="sentiment">
        <div className="sentiment-legend num">
          <span className="sent-neu">오늘 기사 내용을 판단한 글이 없습니다</span>
        </div>
      </div>
    );
  }
  return (
    <div className="sentiment">
      <div className="sentiment-bar" role="img" aria-label={`긍정 ${pos}%, 중립 ${neu}%, 부정 ${neg}%`}>
        <div className="seg pos" style={{ width: `${pos}%` }} />
        <div className="seg neu" style={{ width: `${neu}%` }} />
        <div className="seg neg" style={{ width: `${neg}%` }} />
      </div>
      <div className="sentiment-legend num">
        <span className="sent-pos">긍정 {pos}%</span>
        <span className="sent-neu">중립 {neu}%</span>
        <span className="sent-neg">부정 {neg}%</span>
      </div>
    </div>
  );
}

// 언급량 추이 막대그래프
function MentionTrendChart({ series, plotHeight }) {
  const safeSeries = Array.isArray(series) && series.length > 0 ? series : [];
  // 뉴스·공시 글 수만 그림 (SNS는 1차에서 모으지 않음, #93)
  const maxValue = Math.max(...safeSeries.map((d) => d.news || 0), 1);
  const { yMax, ticks } = niceScale(maxValue);
  const periodTotal = safeSeries.reduce((sum, d) => sum + (d.news || 0), 0);
  const peak = safeSeries.reduce(
    (best, d) => ((d.news || 0) > (best.news || 0) ? d : best),
    safeSeries[0] || { label: '', news: 0 }
  );

  return (
    <div className="trend-chart">
      <div
        className="trend-plot"
        style={plotHeight ? { height: `${plotHeight}px`, flex: 'none' } : undefined}
      >
        <div className="trend-area">
          {ticks.map((t) => (
            <div key={t} className="grid-line" style={{ bottom: `${(t / yMax) * 100}%` }}>
              <span className="grid-value num">{t}</span>
            </div>
          ))}

          <div className="trend-cols">
            {safeSeries.map((pt) => {
              const total = pt.news || 0;
              const newsPct = ((pt.news || 0) / yMax) * 100;
              const topPct = newsPct;
              const share = periodTotal > 0 ? (total / periodTotal) * 100 : 0;
              const isPeak = pt.label === peak?.label && total > 0;
              return (
                <div key={pt.label} className={`trend-col ${isPeak ? 'peak' : ''}`}>
                  {isPeak && (
                    <span className="peak-badge" style={{ bottom: `calc(${topPct}% + 6px)` }}>
                      🔥 피크 {total}
                    </span>
                  )}
                  <div className="trend-bar news" style={{ height: `${newsPct}%` }} />

                  <div
                    className="trend-tooltip"
                    role="tooltip"
                    style={{ bottom: `min(calc(${topPct}% + 10px), calc(100% - 78px))` }}
                  >
                    <div className="tooltip-title">{pt.label}</div>
                    <div className="tooltip-row">
                      <span>
                        <i className="legend-dot news" />
                        뉴스·공시
                      </span>
                      <b className="num">{pt.news}건</b>
                    </div>
                    <div className="tooltip-row total">
                      <span>합계 · 비중</span>
                      <b className="num">
                        {total}건 ({formatPercent(share)})
                      </b>
                    </div>
                  </div>

                  <span className="trend-label num">{pt.label}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
      <div className="trend-legend">
        <span>
          <i className="legend-dot news" /> 뉴스·공시 (작성 시각 기준)
        </span>
        <span className="legend-total">
          기간 합계 <b className="num">{periodTotal.toLocaleString()}건</b>
        </span>
      </div>
    </div>
  );
}

// [V8] 하단 페이지네이션: pagination-wrapper 안에 (1) 정보 텍스트, (2) 이전 버튼 + 페이지 번호 그룹 + 다음 버튼을 명확히 분리 (absolute 금지)
function Pagination({ currentPage, totalPages, totalItems, onPageChange }) {
  if (totalPages <= 1) {
    if (totalItems > 0) {
      return (
        <nav className="pagination-bar" aria-label="기사 목록 페이지 네비게이션">
          <div className="pagination-wrapper">
            <div className="pagination-info num">
              <span className="pagination-total">총 {totalItems}건</span>
              <span className="pagination-sep" aria-hidden="true">·</span>
              <span className="pagination-current">1 / 1 페이지</span>
            </div>
          </div>
        </nav>
      );
    }
    return null;
  }

  const getPageNumbers = () => {
    const pages = [];
    const delta = 2;
    const left = Math.max(1, currentPage - delta);
    const right = Math.min(totalPages, currentPage + delta);

    for (let i = 1; i <= totalPages; i++) {
      if (i === 1 || i === totalPages || (i >= left && i <= right)) {
        pages.push(i);
      }
    }

    const result = [];
    let prev = 0;
    for (const p of pages) {
      if (prev && p - prev > 1) {
        result.push('...');
      }
      result.push(p);
      prev = p;
    }
    return result;
  };

  const pageNumbers = getPageNumbers();

  return (
    <nav className="pagination-bar" aria-label="기사 목록 페이지 네비게이션">
      <div className="pagination-wrapper">
        {/* ① 상단/좌측 정보 텍스트 블록 */}
        <div className="pagination-info num">
          <span className="pagination-total">총 {totalItems}건</span>
          <span className="pagination-sep" aria-hidden="true">·</span>
          <span className="pagination-current">
            {currentPage} / {totalPages} 페이지
          </span>
        </div>

        {/* ② 중앙 페이지 번호 버튼 그룹 ([이전], 1, 2, ..., N, [다음]) */}
        <div className="pagination-buttons">
          <button
            type="button"
            className="more-link2 page-nav-btn"
            disabled={currentPage <= 1}
            onClick={() => onPageChange(currentPage - 1)}
            aria-label="이전 페이지로 이동"
          >
            &lt; 이전
          </button>

          <div className="page-number-group">
            {pageNumbers.map((p, idx) => {
              if (p === '...') {
                return (
                  <span key={`ellipsis-${idx}`} className="page-ellipsis" aria-hidden="true">
                    …
                  </span>
                );
              }
              const isCurrent = p === currentPage;
              return (
                <button
                  key={p}
                  type="button"
                  className={`more-link2 page-num-btn num ${isCurrent ? 'active' : ''}`}
                  onClick={() => onPageChange(p)}
                  aria-current={isCurrent ? 'page' : undefined}
                  aria-label={`${p} 페이지로 이동`}
                >
                  {p}
                </button>
              );
            })}
          </div>

          <button
            type="button"
            className="more-link2 page-nav-btn"
            disabled={currentPage >= totalPages}
            onClick={() => onPageChange(currentPage + 1)}
            aria-label="다음 페이지로 이동"
          >
            다음 &gt;
          </button>
        </div>
      </div>
    </nav>
  );
}

// [V7] A3, D3: 감성 배지를 메타 맨 앞(출처 옆)으로 배치, 첫 로딩 중 스켈레톤 3개
// 종목 칩은 주인공 먼저, 함께 언급 종목은 "+N 함께 언급"으로 접어 둠 (관련도 % 대신 역할)
function ArticleList({ articles, selectedId, onSelect, onSelectStock, loading = false }) {
  const [openMentions, setOpenMentions] = useState(() => new Set());
  const toggleMentions = (id) =>
    setOpenMentions((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  if (loading && (!articles || articles.length === 0)) {
    return (
      <div className="article-list skeleton-list" aria-busy="true" aria-label="목록 불러오는 중">
        {[1, 2, 3].map((sk) => (
          <div key={sk} className="article-item skeleton-card">
            <div className="skeleton-line skeleton-meta" />
            <div className="skeleton-line skeleton-title" />
            <div className="skeleton-line skeleton-tags" />
          </div>
        ))}
      </div>
    );
  }

  if (articles.length === 0) {
    return (
      <div className="empty-state">
        <div className="empty-icon">📰</div>
        <div className="empty-title">조건에 맞는 분석 완료 글이 없습니다</div>
        <div className="empty-sub">상단 필터 조건을 변경하거나 검색어를 초기화해 보세요.</div>
      </div>
    );
  }

  return (
    <div className="article-list">
      {articles.map((art) => {
        const isSns = art.sourceType === 'SNS';
        const related = art.relatedStocks || [];
        const mainStocks = related.filter((r) => r.role === 'MAIN');
        const mentionedStocks = related.filter((r) => r.role !== 'MAIN');
        const mentionsOpen = openMentions.has(art.id);

        const sentKey = sentimentKeyOf(art.sentiment);
        const sentBorderClass =
          sentKey === 'POSITIVE'
            ? 'sent-border-pos'
            : sentKey === 'NEGATIVE'
              ? 'sent-border-neg'
              : 'sent-border-none';

        const renderChip = (rel, muted = false) => (
          <button
            key={rel.code}
            type="button"
            className={`matched-stock-tag num ${muted ? 'mentioned' : ''}`}
            onClick={(e) => {
              e.stopPropagation();
              onSelectStock(rel.code);
            }}
            title={`${rel.name} 종목 상세 화면으로 이동 (${rel.roleLabel})`}
          >
            #{rel.name}
            {!muted && <span className="chip-role">주인공</span>}
          </button>
        );

        return (
          <article
            key={art.id}
            className={`article-item ${sentBorderClass} ${selectedId === art.id ? 'selected' : ''}`}
            role="button"
            tabIndex={0}
            aria-label={`${art.title} 상세 보기`}
            onClick={() => onSelect(art.id)}
            onKeyDown={(e) => {
              if (e.target !== e.currentTarget) return;
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onSelect(art.id);
              }
            }}
          >
            <div className="article-top-meta">
              <div className="article-meta-left">
                <span
                  className={`source-pill ${isSns ? 'sns' : art.isDisclosure ? 'disclosure' : 'news'}`}
                >
                  {sourceLabelOf(art)}
                </span>
                <JudgeBadge article={art} short />
                <ArticleInfoBadges article={art} />
                <span className="article-press-time num">
                  {art.press} · {art.publishedAt}
                </span>
              </div>
            </div>

            <h4 className="article-title">{art.title}</h4>

            <div className="article-stock-tags">
              {mainStocks.map((rel) => renderChip(rel))}
              {mentionedStocks.length > 0 && (
                <>
                  {mentionsOpen && mentionedStocks.map((rel) => renderChip(rel, true))}
                  <button
                    type="button"
                    className="mention-toggle-btn"
                    aria-expanded={mentionsOpen}
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleMentions(art.id);
                    }}
                  >
                    {mentionsOpen ? '접기' : `+${mentionedStocks.length} 함께 언급`}
                  </button>
                </>
              )}
              {isSns && <span className="sns-mini-tag">⚠️ 참고용 · 확인되지 않은 정보</span>}
            </div>
          </article>
        );
      })}
    </div>
  );
}

// 실시간 종목 토론장 컴포넌트
function StockComments({
  stock,
  comments,
  user,
  tabKey,
  compact = false,
  onAdd,
  onDelete,
  onToggleLike,
  onRequireLogin,
}) {
  const resolvedDefaultTag = tabKey === 'mention' ? 'mention' : 'news';

  const [draft, setDraft] = useState('');
  const [selectedTag, setSelectedTag] = useState(resolvedDefaultTag);
  const [filterMode, setFilterMode] = useState('all');
  const [sortMode, setSortMode] = useState('latest');

  useEffect(() => {
    setSelectedTag(resolvedDefaultTag);
  }, [resolvedDefaultTag, stock?.code]);

  const currentTag = COMMENT_TAGS[selectedTag] || COMMENT_TAGS.news;
  const prefix = `[${currentTag.label}] `;

  const parsedComments = useMemo(
    () => comments.map((c) => ({ ...c, ...parseComment(c.content) })),
    [comments]
  );

  const visibleComments = useMemo(() => {
    const filtered =
      filterMode === 'all'
        ? parsedComments
        : parsedComments.filter((c) => c.tagKey === filterMode);
    return [...filtered].sort((a, b) => {
      if (sortMode === 'likes') {
        if ((b.likes || 0) !== (a.likes || 0)) return (b.likes || 0) - (a.likes || 0);
      }
      return String(b.createdAt || '').localeCompare(String(a.createdAt || ''));
    });
  }, [parsedComments, filterMode, sortMode]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!user) {
      onRequireLogin('🔒 종목토론 의견 작성은 로그인이 필요합니다.');
      return;
    }
    const text = draft.trim();
    if (!text) return;
    onAdd(`${prefix}${text}`);
    setDraft('');
  };

  if (!stock) return null;

  return (
    <div className={compact ? 'comments-embedded' : 'content-card comments-section'}>
      <div className="card-header comments-header">
        <div className="comments-title-group">
          <div className="card-title">
            💬 {stock.name} 실시간 종목토론{' '}
            <span className="count-badge num">
              {visibleComments.length}
              {filterMode !== 'all' && ` / ${parsedComments.length}`}
            </span>
          </div>
          {!compact && (
            <span className="card-caption">
              뉴스·공시·언급량 탭에서 함께 보는 종목 의견입니다
            </span>
          )}
        </div>

        <div className="comments-controls">
          <div className="segmented" role="group" aria-label="의견 말머리 필터">
            {[
              { key: 'all', label: '전체 의견' },
              { key: 'news', label: '뉴스' },
              { key: 'mention', label: '언급량' },
            ].map((f) => (
              <button
                key={f.key}
                type="button"
                className={filterMode === f.key ? 'active' : ''}
                onClick={() => setFilterMode(f.key)}
              >
                {f.label}
              </button>
            ))}
          </div>

          <div className="segmented" role="group" aria-label="의견 정렬 기준">
            <button
              type="button"
              className={sortMode === 'latest' ? 'active' : ''}
              onClick={() => setSortMode('latest')}
            >
              최신순
            </button>
            <button
              type="button"
              className={sortMode === 'likes' ? 'active' : ''}
              onClick={() => setSortMode('likes')}
            >
              공감순
            </button>
          </div>
        </div>
      </div>

      <form className="comment-form" onSubmit={handleSubmit}>
        <textarea
          className="comment-input"
          rows={compact ? 2 : 3}
          maxLength={COMMENT_MAX_LENGTH - prefix.length}
          placeholder={
            user
              ? `${stock.name}에 대한 의견을 남겨 주세요 (현재 글 기준 [${currentTag.label}] 말머리 자동 부착)`
              : '로그인 후 종목토론 의견을 작성할 수 있습니다.'
          }
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
        />
        <div className="comment-form-footer">
          <div className="comment-tag-selector">
            <span className="stock-meta">말머리 선택:</span>
            {[
              { key: 'news', label: '뉴스' },
              { key: 'mention', label: '언급량' },
            ].map((t) => (
              <button
                key={t.key}
                type="button"
                className={`more-link2 ${selectedTag === t.key ? 'active' : ''}`}
                onClick={() => setSelectedTag(t.key)}
              >
                [{t.label}]
              </button>
            ))}
            <span className="stock-meta num">
              {draft.length + prefix.length}/{COMMENT_MAX_LENGTH}
            </span>
          </div>
          <button type="submit" className="btn-primary">
            {user ? '의견 등록' : '로그인 후 작성'}
          </button>
        </div>
      </form>

      {visibleComments.length === 0 ? (
        <div className="empty-text">
          {filterMode !== 'all'
            ? '선택한 말머리 필터에 해당하는 의견이 아직 없습니다.'
            : '아직 등록된 종목 의견이 없습니다. 첫 의견을 남겨보세요!'}
        </div>
      ) : (
        <ul className="comment-list">
          {visibleComments.map((c) => {
            const cid = c.commentId ?? c.id;
            return (
              <li key={cid} className="comment-item">
                <div className="comment-meta">
                  {c.tagKey && COMMENT_TAGS[c.tagKey] && (
                    <span className={`comment-tag ${COMMENT_TAGS[c.tagKey].className}`}>
                      {COMMENT_TAGS[c.tagKey].label}
                    </span>
                  )}
                  <strong>{c.author}</strong>
                  <span className="num">{formatDateTime(c.createdAt)}</span>

                  <div className="comment-actions">
                    <button
                      type="button"
                      className={`like-btn ${c.likedByMe ? 'active' : ''} num`}
                      onClick={() => onToggleLike(cid)}
                      aria-label={`댓글 공감 ${c.likes || 0}개`}
                    >
                      👍 공감 {c.likes || 0}
                    </button>
                    {user?.username === c.author && (
                      <button
                        type="button"
                        className="link-btn"
                        onClick={() => onDelete(cid)}
                        aria-label="내 댓글 삭제"
                      >
                        삭제
                      </button>
                    )}
                  </div>
                </div>
                <p className="comment-content">{c.text}</p>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

// 우측 글 상세 패널
function ArticleDetail({
  article,
  allStocks,
  liveQuotes,
  onSelectStock,
  onClose,
  closeLabel = '← 우측 관심·이슈 종목 요약으로 돌아가기',
  regenerating = false,
  onRegenerateSummary,
  showComments = true,
  preferredStockCode,
  commentsByStock = {},
  user = null,
  onAddCommentForStock,
  onDeleteCommentForStock,
  onToggleLikeForStock,
  onRequireLogin,
  onNeedComments,
}) {
  // 주인공 먼저 (adapters 에서 정렬해 둠). 관련도 % 는 주된 신호로 쓰지 않음
  const sortedRelatedStocks = useMemo(() => [...(article?.relatedStocks || [])], [article]);
  const mainRelated = sortedRelatedStocks.filter((r) => r.role === 'MAIN');
  const mentionedRelated = sortedRelatedStocks.filter((r) => r.role !== 'MAIN');
  const [showMentioned, setShowMentioned] = useState(false);

  // 연결 종목의 오늘 시세를 기사를 열어 둔 동안 실시간으로 (주인공 먼저 5종목, 나머지는 처음 불러온 값).
  // "기사 때문에 몇 % 올랐다"가 아니라 "이 종목의 지금" — 기사 뒤 주가 반응은 붙이지 않기로 함 (docs/decisions.md 2026-11-10)
  const [streamQuotes, setStreamQuotes] = useState({});
  useQuoteStream(
    sortedRelatedStocks.map((r) => r.code),
    (q) => setStreamQuotes((prev) => ({ ...prev, [q.stockCode]: q }))
  );
  const quoteOf = (code) => streamQuotes[code] || liveQuotes[code];
  const quoteBasis = quoteBasisText(sortedRelatedStocks.map((r) => quoteOf(r.code)));

  const [commentTargetCode, setCommentTargetCode] = useState(
    preferredStockCode || sortedRelatedStocks[0]?.code || '005930'
  );

  useEffect(() => {
    if (!article) return;
    setShowMentioned(false);

    const hasPreferred = sortedRelatedStocks.some(
      (r) => r.code === preferredStockCode
    );

    setCommentTargetCode(
      hasPreferred
        ? preferredStockCode
        : sortedRelatedStocks[0]?.code || preferredStockCode || '005930'
    );
  }, [article, preferredStockCode, sortedRelatedStocks]);

  // 의견을 보여 줄 종목의 토론 글을 아직 안 받았으면 받음
  useEffect(() => {
    if (commentTargetCode && !commentsByStock[commentTargetCode]) onNeedComments?.(commentTargetCode);
  }, [commentTargetCode, commentsByStock, onNeedComments]);

  if (!article) {
    return (
      <div className="empty-text">
        왼쪽 목록에서 뉴스·공시를 선택하면 AI 3줄 요약과 종목 연결 근거, 하단 종목토론 의견이 표시됩니다.
      </div>
    );
  }

  const isSns = article.sourceType === 'SNS';
  // 의견을 남길 종목: 글의 연결 종목 중 고른 것 (종목 정보를 아직 모르면 이름만으로)
  const targetRel = sortedRelatedStocks.find((r) => r.code === commentTargetCode) || sortedRelatedStocks[0];
  const primaryStock =
    allStocks.find((s) => s.code === commentTargetCode) ||
    (targetRel ? { code: targetRel.code, name: targetRel.name } : null);

  const targetStockComments = commentsByStock[primaryStock?.code] || [];
  const commentTabKey = 'news';
  const visibleEvidence = showMentioned ? sortedRelatedStocks : mainRelated;

  return (
    <div className="article-detail">
      {onClose && (
        <div className="detail-back-bar">
          <button type="button" className="more-link2" onClick={onClose}>
            {closeLabel}
          </button>
        </div>
      )}

      <div className="article-detail-head">
        <div>
          <div className="article-meta-left">
            <span className={`source-pill ${isSns ? 'sns' : article.isDisclosure ? 'disclosure' : 'news'}`}>
              {sourceLabelOf(article, { long: true })}
            </span>
            <ArticleInfoBadges article={article} />
            <span className="stock-meta num">
              {article.press} · {article.publishedAt}
            </span>
          </div>
          <h3>{article.title}</h3>
          {article.contextDependent && (
            <div className="context-note">ℹ️ 목적·방식에 따라 해석이 달라지는 공시입니다</div>
          )}
        </div>
        <a
          href={article.url}
          target="_blank"
          rel="noreferrer"
          className="btn-outline"
          aria-label="원문 보러가기 외부 링크"
        >
          원문 ↗
        </a>
      </div>

      {isSns && (
        <div className="sns-warning-inline" role="alert">
          ⚠️ <strong>참고용 · 확인되지 않은 정보:</strong> SNS(블로그·카페·커뮤니티) 게시글은 사실 여부가 검증되지 않았습니다. 원문과 공시를 반드시 확인해 주세요.
        </div>
      )}

      {article.keywords?.length > 0 && (
        <div className="theme-tags">
          {article.keywords.map((kw) => (
            <span key={kw} className="theme-tag">
              #{kw}
            </span>
          ))}
        </div>
      )}

      <div className="ai-card">
        <div className="ai-card-header">
          <span className="ai-card-badge">🤖 AI 3줄 요약 · 기사 내용 판단</span>
          <div className="header-btn-group">
            <JudgeBadge article={article} />
            {onRegenerateSummary && (
              <button
                type="button"
                className="more-link2"
                onClick={onRegenerateSummary}
                disabled={regenerating}
                title="이 종목의 오늘 종합 요약을 다시 만듭니다"
              >
                {regenerating ? '⏳ 재생성 중...' : '🔄 종목 요약 재생성'}
              </button>
            )}
          </div>
        </div>
        {article.hasSummary === false ? (
          <div className="summary-missing">{missingSummaryText(article)}</div>
        ) : (
          <ul className="summary-lines">
            {article.summary.map((line, idx) => (
              <li key={idx}>{line}</li>
            ))}
          </ul>
        )}
        <AiNote />
      </div>

      <div className="detail-section-block">
        <div className="sub-title">
          📌 연결 종목과 근거 (주인공 {mainRelated.length}
          {mentionedRelated.length > 0 && ` · 함께 언급 ${mentionedRelated.length}`})
        </div>
        {sortedRelatedStocks.length === 0 ? (
          <div className="empty-text">연결된 종목이 없습니다.</div>
        ) : (
          <>
            <table className="stock-table compact-table">
              <thead>
                <tr>
                  <th>종목명 (클릭 시 이동)</th>
                  <th>역할</th>
                  <th className="num-col">현재가</th>
                  <th className="num-col">오늘 등락률</th>
                </tr>
              </thead>
              <tbody>
                {sortedRelatedStocks
                  .filter((rel) => showMentioned || rel.role === 'MAIN')
                  .map((rel) => {
                    const quote = quoteOf(rel.code);
                    return (
                      <tr
                        key={rel.code}
                        className={rel.role === 'MAIN' ? '' : 'mentioned-row'}
                        onClick={() => onSelectStock(rel.code)}
                        title={`${rel.name} 종목 상세 화면으로 이동`}
                      >
                        <td>
                          <strong>{rel.name}</strong>{' '}
                          <span className="stock-code num">{rel.code}</span>
                        </td>
                        <td>
                          <RoleBadge role={rel.role} />
                        </td>
                        <td className="num-col num">
                          <QuotePrice price={quote?.price} />
                        </td>
                        <td className="num-col num">
                          <QuoteRate rate={quote?.changeRate} size="sm" />
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
            {quoteBasis && (
              <div className="context-note quote-basis-note">
                🕒 {quoteBasis} · 어제 종가 대비 이 종목의 현재 값입니다. 기사 때문에 움직였다는 뜻이 아닙니다.
              </div>
            )}

            {mentionedRelated.length > 0 && (
              <button
                type="button"
                className="mention-toggle-btn block"
                aria-expanded={showMentioned}
                onClick={() => setShowMentioned((prev) => !prev)}
              >
                {showMentioned
                  ? '함께 언급 종목 접기 ▲'
                  : `+${mentionedRelated.length} 함께 언급 종목 보기 ▼`}
              </button>
            )}

            <div className="evidence-list">
              {visibleEvidence.map((rel) => (
                <div
                  key={rel.code}
                  className={`evidence-card ${rel.role === 'MAIN' ? '' : 'mentioned'}`}
                >
                  <div className="evidence-head">
                    <button
                      type="button"
                      className="btn-text stock-jump-btn"
                      onClick={() => onSelectStock(rel.code)}
                      title={`${rel.name} 종목 상세 대시보드로 이동`}
                    >
                      📊 {rel.name} <span className="stock-code num">({rel.code})</span> 상세 이동 →
                    </button>
                    <span className="evidence-role">
                      <RoleBadge role={rel.role} />
                      {rel.relationType && (
                        <span className="stock-meta">{rel.relationType} 연결</span>
                      )}
                    </span>
                  </div>
                  {rel.matchedKeywords?.length > 0 && (
                    <div className="matched-kw-row">
                      {rel.matchedKeywords.map((mk) => (
                        <span key={mk} className="theme-tag">
                          #{mk}
                        </span>
                      ))}
                    </div>
                  )}
                  {rel.reason && (
                    <div className="evidence-reason">
                      <strong>연결 이유:</strong> {rel.reason}
                    </div>
                  )}
                  {rel.evidence?.trim() ? (
                    <div className="evidence-quote">
                      <strong>근거 원문</strong>
                      {rel.factTypeLabel && (
                        <span className="fact-type-label">{rel.factTypeLabel}</span>
                      )}
                      <strong>:</strong> {rel.evidence.trim()}
                    </div>
                  ) : (
                    <div className="evidence-empty-notice">
                      원문 링크를 통해 상세 내용을 확인하세요
                    </div>
                  )}
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {showComments && primaryStock && (
        <div className="detail-comments-wrap">
          {sortedRelatedStocks.length > 1 && (
            <div className="detail-comment-stock-bar">
              <span className="stock-meta">댓글 작성 종목 선택:</span>
              {sortedRelatedStocks.map((rel) => (
                <button
                  key={rel.code}
                  type="button"
                  className={`more-link2 ${primaryStock.code === rel.code ? 'active' : ''}`}
                  onClick={() => setCommentTargetCode(rel.code)}
                >
                  {rel.name}
                </button>
              ))}
            </div>
          )}
          <StockComments
            key={`${primaryStock.code}-${commentTabKey}`}
            stock={primaryStock}
            comments={targetStockComments}
            user={user}
            tabKey={commentTabKey}
            compact
            onAdd={(content) => onAddCommentForStock?.(primaryStock.code, content)}
            onDelete={(cid) => onDeleteCommentForStock?.(primaryStock.code, cid)}
            onToggleLike={(cid) => onToggleLikeForStock?.(primaryStock.code, cid)}
            onRequireLogin={onRequireLogin}
          />
        </div>
      )}
    </div>
  );
}

function StockPriceChart({ stockCode, stockName }) {
  const [period, setPeriod] = useState('3m');
  const [unit, setUnit] = useState('day');
  const [candles, setCandles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [hoveredIndex, setHoveredIndex] = useState(null);

  const periods = [
    { key: '1m', label: '1개월' },
    { key: '3m', label: '3개월' },
    { key: '6m', label: '6개월' },
    { key: '1y', label: '1년' },
  ];

  const units = [
    { key: 'day', label: '일봉' },
    { key: 'week', label: '주봉' },
    { key: 'month', label: '월봉' },
  ];

  useEffect(() => {
    if (!stockCode) return undefined;

    const controller = new AbortController();

    setLoading(true);
    setError(false);
    setHoveredIndex(null);
    setCandles([]);

    quoteApi.chart(stockCode, unit, {}, {
      signal: controller.signal,
    })
      .then((res) => {
        if (!controller.signal.aborted) {
          setCandles(res.items || []);
        }
      })
      .catch((err) => {
        if (!controller.signal.aborted) {
          console.error('차트 조회 실패:', err);
          setError(true);
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      });

    return () => controller.abort();
  }, [stockCode, unit]);

  const visibleData = useMemo(() => {
    if (!candles.length) return [];

    const latest = new Date(candles[candles.length - 1].time);
    const cutoff = new Date(latest);

    if (period === '1m') cutoff.setMonth(cutoff.getMonth() - 1);
    if (period === '3m') cutoff.setMonth(cutoff.getMonth() - 3);
    if (period === '6m') cutoff.setMonth(cutoff.getMonth() - 6);
    if (period === '1y') cutoff.setFullYear(cutoff.getFullYear() - 1);

    return candles.filter((item) => new Date(item.time) >= cutoff);
  }, [candles, period]);

  const width = 800;
  const height = 310;
  const left = 75;
  const right = 20;
  const top = 25;
  const bottom = 55;
  const plotWidth = width - left - right;
  const plotHeight = height - top - bottom;

  const prices = visibleData.map((d) => Number(d.close));
  const minPrice = prices.length ? Math.min(...prices) : 0;
  const maxPrice = prices.length ? Math.max(...prices) : 0;
  const range = Math.max(maxPrice - minPrice, 1);

  const xAt = (i) =>
    left + (i / Math.max(visibleData.length - 1, 1)) * plotWidth;

  const yAt = (price) =>
    top + (1 - (Number(price) - minPrice) / range) * plotHeight;

  const points = visibleData
    .map((d, i) => `${xAt(i)},${yAt(d.close)}`)
    .join(' ');

  const selected =
    hoveredIndex != null ? visibleData[hoveredIndex] : null;

  const fmt = (value) => Number(value || 0).toLocaleString('ko-KR');
  const dateLabel = (time) => String(time).slice(5, 10);

  const changePeriod = (nextPeriod) => {
    setPeriod(nextPeriod);
    setHoveredIndex(null);
    setUnit(
      nextPeriod === '6m' || nextPeriod === '1y'
        ? 'week'
        : 'day'
    );
  };

  return (
    <div className="content-card stock-chart-card">
      <div className="card-header chart-card-header">
        <div className="card-title">
          📈 {stockName} 주식 가격 차트
        </div>

        <div className="header-btn-group chart-controls-group">
          <div className="chart-btn-subgroup" role="group" aria-label="차트 조회 기간">
            {periods.map((p) => (
              <button
                key={p.key}
                type="button"
                className={`more-link2 ${period === p.key ? 'active' : ''}`}
                onClick={() => changePeriod(p.key)}
              >
                {p.label}
              </button>
            ))}
          </div>
          <span className="chart-controls-divider" aria-hidden="true">|</span>
          <div className="chart-btn-subgroup" role="group" aria-label="차트 봉 단위">
            {units.map((u) => (
              <button
                key={u.key}
                type="button"
                className={`more-link2 ${unit === u.key ? 'active' : ''}`}
                onClick={() => setUnit(u.key)}
              >
                {u.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {loading ? (
        <div className="chart-empty-box num">차트 불러오는 중...</div>
      ) : error ? (
        <div className="chart-empty-box num">
          주가 차트 API 조회에 실패했습니다. (KIS 대기)
        </div>
      ) : visibleData.length === 0 ? (
        <div className="chart-empty-box num">
          표시할 주가 데이터가 없습니다. (KIS 연동 전)
        </div>
      ) : (
        <>
          <svg
            viewBox={`0 0 ${width} ${height}`}
            style={{ width: '100%', display: 'block' }}
            role="img"
            aria-label={`${stockName} ${period} 주가 추이`}
            onMouseLeave={() => setHoveredIndex(null)}
          >
            {Array.from({ length: 5 }, (_, i) => {
              const price = maxPrice - (range * i) / 4;
              const y = yAt(price);

              return (
                <g key={i}>
                  <line
                    x1={left}
                    y1={y}
                    x2={width - right}
                    y2={y}
                    stroke="var(--border-color, #e5e7eb)"
                    strokeDasharray="4 4"
                  />
                  <text
                    x={left - 10}
                    y={y + 4}
                    textAnchor="end"
                    fontSize="12"
                    fill="var(--text-muted, #64748b)"
                  >
                    {fmt(Math.round(price))}
                  </text>
                </g>
              );
            })}

            {Array.from({ length: 5 }, (_, i) => {
              const index = Math.round(
                (i / 4) * (visibleData.length - 1)
              );

              return (
                <text
                  key={i}
                  x={xAt(index)}
                  y={height - 20}
                  textAnchor="middle"
                  fontSize="12"
                  fill="var(--text-muted, #64748b)"
                >
                  {dateLabel(visibleData[index].time)}
                </text>
              );
            })}

            <polyline
              points={points}
              fill="none"
              stroke="var(--accent-color, #4f63ed)"
              strokeWidth="2.5"
              strokeLinejoin="round"
              strokeLinecap="round"
            />

            <rect
              x={left}
              y={top}
              width={plotWidth}
              height={plotHeight}
              fill="transparent"
              onMouseMove={(e) => {
                const rect =
                  e.currentTarget.ownerSVGElement.getBoundingClientRect();

                const relativeX =
                  ((e.clientX - rect.left) / rect.width) * width;

                const ratio = Math.max(
                  0,
                  Math.min(1, (relativeX - left) / plotWidth)
                );

                const index = Math.round(
                  ratio * (visibleData.length - 1)
                );

                setHoveredIndex(index);
              }}
            />

            {selected && (
              <g>
                <line
                  x1={xAt(hoveredIndex)}
                  y1={top}
                  x2={xAt(hoveredIndex)}
                  y2={top + plotHeight}
                  stroke="var(--text-muted, #94a3b8)"
                  strokeDasharray="4 4"
                />
                <circle
                  cx={xAt(hoveredIndex)}
                  cy={yAt(selected.close)}
                  r="5"
                  fill="var(--accent-color, #4f63ed)"
                  stroke="var(--card-bg, #ffffff)"
                  strokeWidth="2"
                />
              </g>
            )}
          </svg>

          <div style={{ padding: '8px 20px 20px' }}>
            {selected ? (
              <div
                style={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: 14,
                  fontSize: 13,
                }}
              >
                <strong>{String(selected.time).slice(0, 10)}</strong>
                <span>시가 {fmt(selected.open)}원</span>
                <span>고가 {fmt(selected.high)}원</span>
                <span>저가 {fmt(selected.low)}원</span>
                <span>종가 {fmt(selected.close)}원</span>
                <span>거래량 {fmt(selected.volume)}주</span>
              </div>
            ) : (
              <span style={{ color: '#64748b', fontSize: 13 }}>
                그래프에 마우스를 올리면 날짜별 상세 시세가 표시됩니다.
              </span>
            )}
            <div style={{ color: '#64748b', fontSize: 12, marginTop: 8 }}>
              조회된 {unit === 'day' ? '일봉' : unit === 'week' ? '주봉' : '월봉'}
              {' '}데이터 기준 · {visibleData.length}개 봉
              {' '}· {String(visibleData[0].time).slice(0, 10)}
              {' '}~ {String(visibleData[visibleData.length - 1].time).slice(0, 10)}
            </div>
          </div>
        </>
      )}
    </div>
  );
}


export default function DashboardPageV7() {
  // 💡 [수정 포인트] 에러 방지를 위해 컴포넌트 최상단에 상태 변수들을 먼저 선언합니다.
  const [selectedStockCode, setSelectedStockCode] = useState('005930');
  const [activeNav, setActiveNav] = useState('home');
  const [stockViewMode, setStockViewMode] = useState('detail');
  const [stockTab, setStockTab] = useState('summary');
  const [searchQuery, setSearchQuery] = useState('');
  const [feedLocalQuery, setFeedLocalQuery] = useState('');
  const [homePage, setHomePage] = useState(1);
  const [stockNewsPage, setStockNewsPage] = useState(1);
  const [watchlistArticlesPage, setWatchlistArticlesPage] = useState(1);
  const [sentimentFilter, setSentimentFilter] = useState('ALL');
  const [channelFilter, setChannelFilter] = useState('ALL');
  const [articlePeriod, setArticlePeriod] = useState('ALL');
  // 관련도 % 대신 역할: "주인공인 글만" 거르기, 정렬은 최신순 / 주인공 먼저 (관련도 숫자는 역할을 못 가림, 11/10 측정)
  const [onlyMainRole, setOnlyMainRole] = useState(false);
  const [articleSort, setArticleSort] = useState('latest');
  const [onlyWatchlistArticles, setOnlyWatchlistArticles] = useState(false);
  const [expandedSummaryBox, setExpandedSummaryBox] = useState({ news: false });

  // 화면에 나온 종목 { 종목코드: 종목 } — 가짜 종목 목록 없이, API가 알려 준 종목만 모음
  // (이슈 순위·관심 종목·검색 결과·글의 연결 종목·종목 하나 조회). 값은 서버가 준 것만, 없으면 비워 둠
  const [knownStocks, setKnownStocks] = useState({});
  // onlyNew: 이름만 아는 종목(글의 연결 종목 등)은 처음 볼 때만 넣음 → 이슈 순위의 오늘 글 수를 덮지 않게
  const rememberStocks = useCallback((list, { onlyNew = false } = {}) => {
    if (!list?.length) return;
    setKnownStocks((prev) => {
      const next = { ...prev };
      list.forEach((st) => {
        if (!st?.code) return;
        const old = next[st.code];
        if (old && onlyNew) return;
        // 이미 아는 칸(오늘 글 수 등)은 새 값이 비어 있으면 그대로 둠
        next[st.code] = old
          ? Object.fromEntries(
            Object.entries({ ...old, ...st }).map(([k, v]) => [
              k,
              v === null || v === undefined || v === '' ? old[k] : v,
            ])
          )
          : { ...toUiStock({ stockCode: st.code, stockName: st.name }), ...st };
      });
      return next;
    });
  }, []);

  const [liveQuotes, setLiveQuotes] = useState({});

  const allStocks = useMemo(
    () =>
      Object.values(knownStocks).map((stock) => {
        const quote = liveQuotes[stock.code];
        const hasLive = quote && quote.price !== null && quote.price !== undefined;
        return {
          ...stock,
          price: hasLive ? quote.price : null,
          changeRate: hasLive ? quote.changeRate : null,
          changeAmount: hasLive ? quote.changeAmount : null,
        };
      }),
    [knownStocks, liveQuotes]
  );

  // 오늘의 이슈 종목 (뉴스 기준, 1분마다 다시). 홈 TOP 7 과 종목 탐색 기본 목록
  const issues = useApi(
    (signal) => stockApi.issues({ limit: ISSUE_LIMIT }, { signal }),
    [],
    { refreshMs: 60_000 }
  );
  const issueItems = useMemo(() => issues.data?.items || [], [issues.data]);
  // 현재가는 TOP 7 만 받음 (KIS 초당 호출 한도)
  const issueTopCodes = issueItems.slice(0, 7).map((it) => it.stockCode).join(',');
  useEffect(() => {
    rememberStocks(
      issueItems.map((it) => ({
        ...toUiStock(it),
        todayMatchedCount: it.articleCount,
        // 같은 소식 묶음을 1건으로 센 소식 수 (없는 서버면 null → 화면에 안 보임)
        todayEventCount: it.eventCount ?? null,
        // 오늘 공시 수 (2026-11-10: 순위 점수에서는 빠지고 배지로만). 없는 서버면 null → 안 보임
        todayDisclosureCount: it.disclosureCount ?? null,
        issueRank: it.rank,
        lastMatchedAt: toDisplayTime(it.lastPublishedAt) || '-',
        analysisReady: true,
      }))
    );
  }, [issueItems, rememberStocks]);

  // 종목 사전 기본 정보(이름·시장·업종)만 채움. 다른 칸(오늘 글 수 등)은 건드리지 않음
  const basicInfo = (item) => ({
    code: item.stockCode,
    name: item.stockName,
    market: item.market,
    sector: item.sector,
  });

  // 고른 종목의 시장·업종을 아직 모르면 종목 하나 조회로 받음 (글의 연결 종목은 이름만 알고 있음)
  const selectedKnown = knownStocks[selectedStockCode];
  useEffect(() => {
    if (!selectedStockCode || selectedKnown?.market) return undefined;
    const controller = new AbortController();
    stockApi
      .get(selectedStockCode, { signal: controller.signal })
      // 기본 정보만 넣음. 예전엔 처음 보는 종목이면 toUiStock(오늘 글 수 0 등 기본값 포함)을 넣었는데,
      // 이슈 순위가 먼저 와서 글 수를 채운 뒤 이 응답이 오면 0 으로 덮어씀 → 홈 TOP 7 에 "삼성전자 글 0건" (2026-11-10 QA)
      // 처음 보는 종목의 기본값은 rememberStocks 가 알아서 채움
      .then((res) => rememberStocks([basicInfo(res)]))
      .catch((err) => {
        if (err.name !== 'AbortError') console.error('종목 조회 실패:', err);
      });
    return () => controller.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedStockCode, selectedKnown?.market, rememberStocks]);

  // 💡 selectedStock 변수 정의 (allStocks가 정의된 이후 안전하게 선언)
  const stockByCode = (code) => allStocks.find((s) => s.code === code);
  // 종목 정보를 받기 전에는 코드만 있는 빈 종목 (화면이 깨지지 않게, 값은 지어내지 않음)
  const selectedStock =
    stockByCode(selectedStockCode) ||
    toUiStock({ stockCode: selectedStockCode, stockName: selectedStockCode });

  const [allArticles, setAllArticles] = useState([]);
  const [feedBooted, setFeedBooted] = useState(false);
  // 받은 글을 기존 목록에 합침 (같은 글은 새 값으로). 홈·종목·관심 종목 화면이 같은 목록을 나눠 씀
  const mergeArticles = useCallback((articles) => {
    setAllArticles((prev) => {
      const merged = new Map(prev.map((article) => [String(article.id), article]));
      articles.forEach((article) => merged.set(String(article.id), article));
      return [...merged.values()];
    });
  }, []);
  // 새로고침 버튼을 누르면 1 씩 늘려 홈 글 목록을 다시 받음
  const [articlesTick, setArticlesTick] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    articleApi
      .list({ source: 'NEWS', page: 1, size: 100 }, { signal: controller.signal })
      .then((res) => {
        mergeArticles((res.items || []).map(toUiArticle));
      })
      .catch((err) => {
        if (err.name !== 'AbortError') {
          console.error('뉴스 API 조회 실패:', err);
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setFeedBooted(true);
        }
      });
    return () => controller.abort();
  }, [articlesTick, mergeArticles]);

  // 글에 연결된 종목도 이름을 알게 됨 → 종목 칩을 눌렀을 때 바로 이름이 보임
  useEffect(() => {
    rememberStocks(
      allArticles.flatMap((art) =>
        (art.relatedStocks || []).map((r) => toUiStock({ stockCode: r.code, stockName: r.name }))
      ),
      { onlyNew: true }
    );
  }, [allArticles, rememberStocks]);

  const [navCollapsed, setNavCollapsed] = useState(() => {
    try {
      return localStorage.getItem('snm_nav_collapsed') === 'true';
    } catch {
      return false;
    }
  });

  const [stockListQuery, setStockListQuery] = useState('');
  const [stockListMarket, setStockListMarket] = useState('ALL');
  const [stockListSort, setStockListSort] = useState('issue');

  const [watchlistCodes, setWatchlistCodes] = useState([]);

  useEffect(() => {
    // 고른 종목·관심 종목·이슈 TOP 7 의 현재가 (시세가 꺼진 서버면 503 → 그냥 비워 둠)
    const codes = [
      ...new Set([selectedStockCode, ...watchlistCodes, ...issueTopCodes.split(',')].filter(Boolean)),
    ];
    let cancelled = false;

    Promise.allSettled(
      codes.map((code) => quoteApi.get(code))
    ).then((results) => {
      if (cancelled) return;
      const quotes = {};
      results.forEach((result, index) => {
        if (result.status === 'fulfilled' && result.value?.price != null) {
          quotes[codes[index]] = result.value;
        }
      });
      setLiveQuotes((prev) => ({ ...prev, ...quotes }));
    });

    return () => {
      cancelled = true;
    };
  }, [selectedStockCode, watchlistCodes, issueTopCodes]);

  const [selectedArticleId, setSelectedArticleId] = useState(null);
  const [articleDetails, setArticleDetails] = useState({});

  useEffect(() => {
    if (!selectedArticleId) return;
    const article =
      articleDetails[selectedArticleId] ||
      allArticles.find((a) => String(a.id) === String(selectedArticleId));
    if (!article) return;

    const codes = [
      ...new Set(
        (article.relatedStocks || [])
          .map((stock) => stock.code)
          .filter(Boolean)
      ),
    ];
    const missingCodes = codes.filter((code) => !liveQuotes[code]);
    if (missingCodes.length === 0) return;

    let cancelled = false;
    Promise.allSettled(
      missingCodes.map((code) => quoteApi.get(code))
    ).then((results) => {
      if (cancelled) return;
      const quotes = {};
      results.forEach((result, index) => {
        if (result.status === 'fulfilled' && result.value?.price != null) {
          quotes[missingCodes[index]] = result.value;
        }
      });
      if (Object.keys(quotes).length > 0) {
        setLiveQuotes((prev) => ({ ...prev, ...quotes }));
      }
    });

    return () => {
      cancelled = true;
    };
  }, [selectedArticleId, articleDetails, allArticles, liveQuotes]);

  useEffect(() => {
    if (!selectedArticleId) return undefined;
    const controller = new AbortController();
    articleApi
      .get(selectedArticleId, { signal: controller.signal })
      .then((data) => {
        setArticleDetails((prev) => ({
          ...prev,
          [selectedArticleId]: toUiArticle(data),
        }));
      })
      .catch((err) => {
        if (err.name !== 'AbortError') {
          console.error('뉴스 상세 API 조회 실패:', err);
        }
      });
    return () => controller.abort();
  }, [selectedArticleId]);

  const [homeRankFilter, setHomeRankFilter] = useState('issue');
  const [watchAddQuery, setWatchAddQuery] = useState('');
  const [showWatchModal, setShowWatchModal] = useState(false);
  const [searchPeriod, setSearchPeriod] = useState('ALL');
  const [showAutocomplete, setShowAutocomplete] = useState(false);
  const [trendPeriod, setTrendPeriod] = useState('today');

  const [mentionSeries, setMentionSeries] = useState([]);
  const [mentionLoading, setMentionLoading] = useState(false);
  const [mentionError, setMentionError] = useState(false);

  useEffect(() => {
    if (!selectedStockCode) return undefined;
    const controller = new AbortController();
    setMentionSeries([]);
    setMentionLoading(true);
    setMentionError(false);

    stockApi.mentions(selectedStockCode, trendPeriod, {
      signal: controller.signal,
    })
      .then((res) => {
        if (controller.signal.aborted) return;
        const series = (res.items || []).map((item) => ({
          label:
            trendPeriod === 'today'
              ? item.time.slice(11, 16)
              : item.time.slice(5, 10),
          news: Number(item.newsCount || 0),
          // SNS는 1차에서 모으지 않음(#93). 예전에 모은 SNS가 남아 있어도 그리지 않음
          sns: 0,
        }));
        setMentionSeries(series);
      })
      .catch((err) => {
        if (controller.signal.aborted) return;
        console.error('언급량 API 조회 실패:', err);
        setMentionError(true);
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setMentionLoading(false);
        }
      });

    return () => controller.abort();
  }, [selectedStockCode, trendPeriod]);

  const [isFilterExpanded, setIsFilterExpanded] = useState(false);

  // [V4] 다크 모드 / 라이트 모드 상태 관리 (localStorage 및 시스템 선호도 연동)
  const [isDarkMode, setIsDarkMode] = useState(() => {
    try {
      const saved = localStorage.getItem('theme_mode');
      if (saved) return saved === 'dark';
      return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    } catch {
      return false;
    }
  });

  const toggleTheme = () => {
    setIsDarkMode((prev) => {
      const next = !prev;
      try {
        localStorage.setItem('theme_mode', next ? 'dark' : 'light');
      } catch { }
      return next;
    });
  };
  const homeFeedRef = useRef(null);
  const stockFeedRef = useRef(null);
  const watchlistFeedRef = useRef(null);

  const [findIdEmail, setFindIdEmail] = useState('');
  const [findPwUsername, setFindPwUsername] = useState('');
  const [findPwEmail, setFindPwEmail] = useState('');

  // 데이터 상태: 마지막 뉴스·SNS 수집, 요약 시각 (GET /api/status, 1분마다)
  const status = useApi((signal) => statusApi.get({ signal }), [], { refreshMs: 60_000 });
  const sysStatus = {
    lastUpdated: {
      quote: toDisplayTime(status.data?.lastSuccessAt) || '-',
      newsSns: toDisplayTime(status.data?.newsCollectedAt) || '-',
      summary: toDisplayTime(status.data?.summaryGeneratedAt) || '-',
    },
  };

  // 종목 종합 요약·감성 비율 { 종목코드: 화면 요약 } (GET /api/stocks/{code}/summary)
  const [summariesByStock, setSummariesByStock] = useState({});
  const [regenerating, setRegenerating] = useState(false);
  useEffect(() => {
    if (!selectedStockCode) return undefined;
    const controller = new AbortController();
    stockApi
      .summary(selectedStockCode, { source: 'NEWS' }, { signal: controller.signal })
      .then((res) =>
        setSummariesByStock((prev) => ({ ...prev, [selectedStockCode]: toUiSummary(res) }))
      )
      .catch((err) => {
        if (err.name !== 'AbortError') console.error('종목 요약 조회 실패:', err);
      });
    return () => controller.abort();
  }, [selectedStockCode]);

  const [user, setUser] = useState(null);
  useEffect(() => {
    // 저장된 로그인 토큰이 없으면 물어볼 필요가 없음 (로그인 전 401 요청 방지)
    if (!tokenStore.get()) return undefined;
    let cancelled = false;
    authApi.me()
      .then((res) => {
        if (cancelled) return;
        const username = res?.loginId ?? res?.username;
        if (username) {
          setUser({ username });
        }
      })
      .catch(() => {
        if (!cancelled) {
          authApi.logout();
          localStorage.removeItem('snm_current_user');
          setUser(null);
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const [showAuthModal, setShowAuthModal] = useState(false);
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [authMode, setAuthMode] = useState('login');
  const [authForm, setAuthForm] = useState({
    username: '',
    password: '',
    passwordConfirm: '',
  });
  const [authError, setAuthError] = useState('');
  const [toast, setToast] = useState(null);

  // 종목별 토론 의견 { 종목코드: [의견] } (게시판 API). 화면은 댓글형, 서버는 게시판: 의견 하나 = 게시판 글 하나
  const [commentsByStock, setCommentsByStock] = useState({});
  const loadComments = useCallback((code) => {
    if (!code) return;
    boardApi
      .posts(code, { size: 50 })
      .then((res) =>
        setCommentsByStock((prev) => ({
          ...prev,
          [code]: (res.items || []).map((it) => toUiBoardComment(it, code)),
        }))
      )
      .catch(() => setCommentsByStock((prev) => ({ ...prev, [code]: prev[code] || [] })));
  }, []);
  useEffect(() => {
    loadComments(selectedStockCode);
  }, [selectedStockCode, loadComments]);

  const mainRef = useRef(null);
  const triggerToast = (msg) => setToast({ id: Date.now(), text: msg });

  useEffect(() => {
    setHomePage(1);
  }, [
    sentimentFilter,
    channelFilter,
    articlePeriod,
    onlyWatchlistArticles,
    feedLocalQuery,
  ]);

  // 💡 [에러 수정된 useEffect] 이제 selectedStock이 위쪽에 선언되었으므로 정상 작동합니다.
  useEffect(() => {
    setStockNewsPage(1);
  }, [
    sentimentFilter,
    channelFilter,
    articlePeriod,
    onlyMainRole,
    articleSort,
    selectedStock?.code,
    stockTab,
  ]);

  const [watchlistSort, setWatchlistSort] = useState('news');
  const [watchlistPage, setWatchlistPage] = useState(1);
  const [selectedWatchStockCode, setSelectedWatchStockCode] = useState(null);
  const [loadedWatchStockCodes, setLoadedWatchStockCodes] = useState({});
  const requestedWatchStockArticlesRef = useRef(new Set());

  const watchlistStocks = useMemo(
    () =>
      watchlistCodes
        .map((code) => {
          const base = stockByCode(code) || toUiStock({ stockCode: code, stockName: code });
          if (!base) return null;
          const relatedArts = allArticles.filter(
            (art) =>
              art.sourceType !== 'SNS' &&
              (art.relatedStocks || []).some((r) => r.code === base.code)
          );
          const relatedNews = relatedArts.filter((art) => !art.isDisclosure);
          const relatedDisclosures = relatedArts.filter((art) => art.isDisclosure);

          const hasLoadedArticles =
            Boolean(loadedWatchStockCodes[base.code]) || relatedArts.length > 0;
          const fallbackDisclosure = Number(base.todayDisclosureCount ?? 0);
          const fallbackTotal = Number(
            base.todayArticleCount ?? base.todayMatchedCount ?? 0
          );
          const computedDisclosureCount = hasLoadedArticles
            ? relatedDisclosures.length
            : fallbackDisclosure;
          const computedNewsCount = hasLoadedArticles
            ? relatedNews.length
            : Math.max(0, fallbackTotal - computedDisclosureCount);

          let latestIso =
            base.latestPublishedAt ||
            base.lastMatchedAtIso ||
            (base.lastMatchedAt && base.lastMatchedAt !== '-' ? base.lastMatchedAt : '');
          relatedArts.forEach((art) => {
            const candidate = art.publishedAtIso || art.publishedAt || '';
            if (candidate && (!latestIso || String(candidate) > String(latestIso))) {
              latestIso = candidate;
            }
          });
          return {
            ...base,
            stockName: base.stockName || base.name || base.code,
            newsCount: computedNewsCount,
            disclosureCount: computedDisclosureCount,
            latestPublishedAt: latestIso || null,
          };
        })
        .filter(Boolean),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [watchlistCodes, allStocks, allArticles, loadedWatchStockCodes]
  );

  const sortedWatchlistStocks = useMemo(() => {
    const list = [...watchlistStocks];
    list.sort((a, b) => {
      if (watchlistSort === 'news') {
        const diff = (b.newsCount ?? 0) - (a.newsCount ?? 0);
        if (diff !== 0) return diff;
        const discDiff = (b.disclosureCount ?? 0) - (a.disclosureCount ?? 0);
        if (discDiff !== 0) return discDiff;
        return (a.stockName || a.name || '').localeCompare(b.stockName || b.name || '', 'ko');
      }
      if (watchlistSort === 'latest') {
        const timeA = a.latestPublishedAt ? Date.parse(String(a.latestPublishedAt).replace(' ', 'T')) || 0 : 0;
        const timeB = b.latestPublishedAt ? Date.parse(String(b.latestPublishedAt).replace(' ', 'T')) || 0 : 0;
        if (timeB !== timeA) return timeB - timeA;
        const strCmp = String(b.latestPublishedAt || '').localeCompare(String(a.latestPublishedAt || ''));
        if (strCmp !== 0) return strCmp;
        return (b.newsCount ?? 0) - (a.newsCount ?? 0);
      }
      return (a.stockName || a.name || '').localeCompare(b.stockName || b.name || '', 'ko');
    });
    return list;
  }, [watchlistStocks, watchlistSort]);

  useEffect(() => {
    setWatchlistPage(1);
  }, [watchlistSort]);

  useEffect(() => {
    const maxPage = Math.max(1, Math.ceil(sortedWatchlistStocks.length / 5));
    if (watchlistPage > maxPage) {
      setWatchlistPage(maxPage);
    }
  }, [sortedWatchlistStocks.length, watchlistPage]);

  useEffect(() => {
    if (selectedWatchStockCode && !watchlistCodes.includes(selectedWatchStockCode)) {
      setSelectedWatchStockCode(null);
    }
  }, [watchlistCodes, selectedWatchStockCode]);

  useEffect(() => {
    setWatchlistArticlesPage(1);
  }, [
    sentimentFilter,
    channelFilter,
    articlePeriod,
    onlyMainRole,
    articleSort,
    watchlistStocks.length,
    selectedWatchStockCode,
  ]);

  const handleHomePageChange = (page) => {
    setHomePage(page);
    if (homeFeedRef.current) {
      homeFeedRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const handleStockNewsPageChange = (page) => {
    setStockNewsPage(page);
    if (stockFeedRef.current) {
      stockFeedRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const handleWatchlistPageChange = (page) => {
    setWatchlistArticlesPage(page);
    if (watchlistFeedRef.current) {
      watchlistFeedRef.current.scrollTo({ top: 0, behavior: 'smooth' });
      watchlistFeedRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  };

  const handleFindIdSubmit = (e) => {
    e.preventDefault();
    const email = findIdEmail.trim();
    if (!email) {
      setAuthError('이메일을 입력해 주세요.');
      return;
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      setAuthError('올바른 이메일 형식을 입력해 주세요.');
      return;
    }
    setAuthError('');
    triggerToast('ℹ️ 아이디 찾기는 현재 준비 중인 기능입니다.');
  };

  const handleFindPwSubmit = (e) => {
    e.preventDefault();
    const username = findPwUsername.trim();
    const email = findPwEmail.trim();
    if (!username) {
      setAuthError('아이디를 입력해 주세요.');
      return;
    }
    if (!email) {
      setAuthError('이메일을 입력해 주세요.');
      return;
    }
    setAuthError('');
    triggerToast('ℹ️ 비밀번호 재설정 링크 발송은 현재 준비 중인 기능입니다.');
  };

  // 종목코드 정규화 헬퍼 ('005930' 숫자 코드뿐만 아니라 '0007C0' 등 영문 포함 종목코드도 그대로 허용)
  const normalizeStockCode = useCallback((input, fallback = null) => {
    const raw =
      typeof input === 'object' && input !== null
        ? input.stockCode ?? input.code ?? ''
        : input ?? fallback?.stockCode ?? fallback?.code ?? '';
    return String(raw).trim().toUpperCase();
  }, []);

  // 구버전 백엔드 컨테이너(숫자 6자리만 허용하던 이미지)에서도 영문 혼합 종목코드가 풀리지 않도록 보조 저장소 연동
  const localExtraWatchlistKey = user?.username
    ? `snm_watchlist_extra_${user.username}`
    : 'snm_watchlist_extra_guest';

  const getLocalExtraWatchlist = useCallback(() => {
    try {
      const raw = localStorage.getItem(localExtraWatchlistKey);
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed)
        ? parsed.map((c) => String(c).trim().toUpperCase()).filter(Boolean)
        : [];
    } catch {
      return [];
    }
  }, [localExtraWatchlistKey]);

  const setLocalExtraWatchlist = useCallback(
    (updater) => {
      try {
        const prev = getLocalExtraWatchlist();
        const next = typeof updater === 'function' ? updater(prev) : updater;
        const unique = [
          ...new Set((next || []).map((c) => String(c).trim().toUpperCase()).filter(Boolean)),
        ];
        localStorage.setItem(localExtraWatchlistKey, JSON.stringify(unique));
        return unique;
      } catch {
        return [];
      }
    },
    [getLocalExtraWatchlist, localExtraWatchlistKey]
  );

  // 관심종목 목록 및 연관 기사 즉시 동기화
  const refreshWatchlist = useCallback(
    async ({ silent = false } = {}) => {
      if (!user || !tokenStore.get()) {
        setWatchlistCodes([]);
        return [];
      }
      try {
        const res = await watchlistApi.list();
        const items = res?.items || [];
        if (items.length > 0) {
          rememberStocks(
            items.map((it) => ({
              ...toUiStock(it),
              stockName: it.stockName || it.name || it.stockCode,
              todayMatchedCount: it.todayArticleCount ?? 0,
              todayArticleCount: it.todayArticleCount ?? 0,
              latestPublishedAt: it.lastMatchedAt || null,
              lastMatchedAtIso: it.lastMatchedAt || '',
              lastMatchedAt: toDisplayTime(it.lastMatchedAt) || '-',
            }))
          );
        }
        const serverCodes = items
          .map((item) => normalizeStockCode(item.stockCode))
          .filter(Boolean);
        const extraCodes = getLocalExtraWatchlist();
        const nextCodes = [...new Set([...extraCodes, ...serverCodes])];
        setWatchlistCodes(nextCodes);
        if (serverCodes.length > 0) {
          watchlistApi
            .articles({ source: 'NEWS', page: 1, size: 100 })
            .then((artRes) => mergeArticles((artRes?.items || []).map(toUiArticle)))
            .catch(() => { });
        }
        return nextCodes;
      } catch (error) {
        console.error('관심 종목 목록 조회 실패:', error);
        if (error?.status === 401) {
          authApi.logout();
          localStorage.removeItem('snm_current_user');
          setUser(null);
          setWatchlistCodes([]);
        } else if (!silent) {
          triggerToast('관심 종목 목록을 불러오지 못했습니다.');
        }
        return null;
      }
    },
    [user, rememberStocks, mergeArticles, normalizeStockCode, getLocalExtraWatchlist]
  );

  useEffect(() => {
    if (!user) {
      setWatchlistCodes([]);
      return;
    }
    refreshWatchlist();
  }, [user, refreshWatchlist]);

  useEffect(() => {
    if (!toast) return undefined;
    const timer = setTimeout(() => setToast(null), 2600);
    return () => clearTimeout(timer);
  }, [toast]);

  const handleToggleNavCollapse = () => {
    setNavCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem('snm_nav_collapsed', String(next));
      } catch {
        // ignore
      }
      return next;
    });
  };

  const handleSwitchNav = (navKey) => {
    setActiveNav(navKey);
    if (navKey === 'home') {
      setSelectedArticleId(null);
    }
    mainRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
  };

  useEffect(() => {
    if (!showAuthModal && !showAutocomplete && !showWatchModal && !showLogoutModal) return undefined;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        setShowAuthModal(false);
        setShowAutocomplete(false);
        setShowWatchModal(false);
        setShowLogoutModal(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showAuthModal, showAutocomplete, showWatchModal, showLogoutModal]);

  const isInWatchlist = (code) => watchlistCodes.includes(code);

  const navigateToStockDetail = (code, initialTab = 'summary', showFeedback = true) => {
    const st = stockByCode(code);
    setSelectedStockCode(code);
    setActiveNav('stock');
    setStockViewMode('detail');
    setStockTab(initialTab);
    setSelectedArticleId(null);
    mainRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
    if (showFeedback && st) {
      triggerToast(`📊 ${st.name}(${st.code}) 종목 상세 화면으로 이동했습니다.`);
    }
  };

  // 초기 전체 종목 데이터 연동 (초기 로드 시에도 전체 주식 풀과 연동되도록 보강)
  useEffect(() => {
    const controller = new AbortController();
    stockApi
      .search('', { page: 1, size: 100 }, { signal: controller.signal })
      .then((res) => {
        rememberStocks((res.items || []).map(toUiStock), { onlyNew: true });
        const total = Number(res?.total || 0);
        const totalPages = Math.min(20, Math.ceil(total / 100));
        if (totalPages > 1) {
          for (let p = 2; p <= totalPages; p += 1) {
            stockApi
              .search('', { page: p, size: 100 }, { signal: controller.signal })
              .then((pageRes) => {
                rememberStocks((pageRes.items || []).map(toUiStock), { onlyNew: true });
              })
              .catch(() => { });
          }
        }
      })
      .catch((err) => {
        if (err.name !== 'AbortError') {
          console.error('전체 종목 초기 조회 실패:', err);
        }
      });
    return () => controller.abort();
  }, [rememberStocks]);

  const matchStockByQuery = (stock, q) => {
    const query = String(q || '').trim().toLowerCase();
    if (!query) return true;
    const inBasic =
      (stock.name || '').toLowerCase().includes(query) ||
      (stock.code || '').toLowerCase().includes(query) ||
      (stock.sector || '').toLowerCase().includes(query) ||
      (stock.market || '').toLowerCase().includes(query) ||
      (stock.aliases || []).some((al) => String(al).toLowerCase().includes(query)) ||
      (stock.themes || []).some((th) => String(th).toLowerCase().includes(query)) ||
      (stock.keywords || []).some((kw) => String(kw).toLowerCase().includes(query));
    if (inBasic) return true;
    return allArticles.some(
      (art) =>
        (art.relatedStocks || []).some((r) => r.code === stock.code) &&
        ((art.keywords || []).some((kw) => String(kw).toLowerCase().includes(query)) ||
          (art.relatedStocks || []).some((r) =>
            (r.matchedKeywords || []).some((mk) => String(mk).toLowerCase().includes(query))
          ))
    );
  };

  const [remoteStockResult, setRemoteStockResult] = useState(null);
  const requestedSearchQuotes = useRef(new Set());

  useEffect(() => {
    if (!remoteStockResult?.items?.length) return;
    const codes = remoteStockResult.items
      .slice(0, 7)
      .map((item) => item.stockCode)
      .filter((code) => {
        if (liveQuotes[code] || requestedSearchQuotes.current.has(code)) {
          return false;
        }
        requestedSearchQuotes.current.add(code);
        return true;
      });

    if (codes.length === 0) return;
    let cancelled = false;

    Promise.allSettled(
      codes.map((code) => quoteApi.get(code))
    ).then((results) => {
      if (cancelled) return;
      const quotes = {};
      results.forEach((result, index) => {
        const code = codes[index];
        if (result.status === 'fulfilled' && result.value?.price != null) {
          quotes[code] = result.value;
        } else {
          requestedSearchQuotes.current.delete(code);
        }
      });
      if (Object.keys(quotes).length > 0) {
        setLiveQuotes((prev) => ({ ...prev, ...quotes }));
      }
    });

    return () => {
      cancelled = true;
      codes.forEach((code) => requestedSearchQuotes.current.delete(code));
    };
  }, [remoteStockResult, liveQuotes]);

  useEffect(() => {
    const q = searchQuery.trim();
    if (!q) return undefined;
    const controller = new AbortController();
    // 통합 검색 API + 전체 종목 검색 API를 함께 호출해 글자 포함 연관 주식을 모두 확보
    const timer = setTimeout(() => {
      Promise.allSettled([
        searchApi.all(
          q,
          {
            period: PERIOD_PARAM[searchPeriod],
            // SNS는 1차에서 모으지 않음(#93) → 글은 뉴스·공시만
            source: 'NEWS',
            size: 20,
          },
          { signal: controller.signal }
        ),
        stockApi.search(q, { page: 1, size: 100 }, { signal: controller.signal }),
      ]).then(([searchRes, stockRes]) => {
        if (controller.signal.aborted) return;
        const searchData = searchRes.status === 'fulfilled' ? searchRes.value : null;
        const stockData = stockRes.status === 'fulfilled' ? stockRes.value : null;

        const mergedItemsMap = new Map();
        (searchData?.stocks?.items || []).forEach((it) => {
          if (it?.stockCode) mergedItemsMap.set(it.stockCode, it);
        });
        (stockData?.items || []).forEach((it) => {
          if (it?.stockCode && !mergedItemsMap.has(it.stockCode)) {
            mergedItemsMap.set(it.stockCode, it);
          }
        });
        const mergedItems = [...mergedItemsMap.values()];

        if (mergedItems.length > 0) {
          rememberStocks(mergedItems.map(basicInfo));
        }
        if (searchData || stockData) {
          setRemoteStockResult({
            q,
            period: searchPeriod,
            items: mergedItems,
            articles: (searchData?.articles?.items || []).map(toUiArticle),
          });
        } else {
          setRemoteStockResult(null);
        }
      });
    }, 250);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchQuery, searchPeriod]);

  const integratedSearchResults = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return { matchedStocks: [], matchedArticles: [] };

    const remote =
      remoteStockResult && remoteStockResult.q.toLowerCase().includes(q)
        ? remoteStockResult.items
        : null;

    const localMatched = allStocks.filter((st) => matchStockByQuery(st, q));
    const remoteMatched = (remote || []).map((item) => {
      const stock =
        allStocks.find((st) => st.code === item.stockCode) ||
        toUiStock(item);
      const quote = liveQuotes[item.stockCode];
      return quote
        ? {
          ...stock,
          price: quote.price,
          changeRate: quote.changeRate,
          changeAmount: quote.changeAmount,
        }
        : stock;
    });

    const stockMap = new Map();
    [...remoteMatched, ...localMatched].forEach((st) => {
      if (st?.code && !stockMap.has(st.code)) {
        stockMap.set(st.code, st);
      }
    });
    const matchedStocks = [...stockMap.values()];

    const remoteFresh =
      remoteStockResult &&
      remoteStockResult.q.toLowerCase() === q &&
      remoteStockResult.period === searchPeriod;
    const remoteArticles = remoteFresh ? remoteStockResult.articles : [];
    const localArticles = allArticles
      .filter((art) => art.sourceType !== 'SNS')
      .filter((art) => searchPeriod === 'ALL' || art.daysAgo <= Number(searchPeriod))
      .filter((art) => {
        const inTitle = (art.title || '').toLowerCase().includes(q);
        const inSummary = (art.summary || []).some((line) =>
          (line || '').toLowerCase().includes(q)
        );
        const inKeywords = (art.keywords || []).some((kw) =>
          (kw || '').toLowerCase().includes(q)
        );
        const inRelatedStock = (art.relatedStocks || []).some((rel) => {
          const st = stockByCode(rel.code);
          return (
            (rel.name || '').toLowerCase().includes(q) ||
            (rel.code || '').toLowerCase().includes(q) ||
            (st?.aliases || []).some((al) => String(al).toLowerCase().includes(q)) ||
            (st?.themes || []).some((th) => String(th).toLowerCase().includes(q))
          );
        });
        return inTitle || inSummary || inKeywords || inRelatedStock;
      });

    const articleMap = new Map();
    [...remoteArticles, ...localArticles].forEach((art) => {
      if (art?.id != null && !articleMap.has(String(art.id))) {
        articleMap.set(String(art.id), art);
      }
    });
    const matchedArticles = [...articleMap.values()];

    return { matchedStocks, matchedArticles };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchQuery, searchPeriod, allStocks, allArticles, remoteStockResult, liveQuotes]);

  // 관심 종목 추가 후보: 검색어가 있으면 전체 주식(allStocks) + 종목 검색 API 연동, 없으면 전체 주식(allStocks)
  const watchAddSearch = useApi(
    (signal) => stockApi.search(watchAddQuery.trim(), { size: 100 }, { signal }),
    [watchAddQuery],
    { enabled: Boolean(watchAddQuery.trim()) }
  );
  useEffect(() => {
    rememberStocks((watchAddSearch.data?.items || []).map(toUiStock), { onlyNew: true });
  }, [watchAddSearch.data, rememberStocks]);

  const watchAddCandidates = useMemo(() => {
    const q = watchAddQuery.trim().toLowerCase();
    if (!q) {
      const merged = new Map();
      issueItems.forEach((it) => {
        const st = stockByCode(it.stockCode) || toUiStock(it);
        if (st?.code) merged.set(st.code, st);
      });
      allStocks.forEach((st) => {
        if (st?.code && !merged.has(st.code)) merged.set(st.code, st);
      });
      return [...merged.values()];
    }
    const remoteItems = (watchAddSearch.data?.items || []).map(
      (it) => stockByCode(it.stockCode) || toUiStock(it)
    );
    const localItems = allStocks.filter((st) => matchStockByQuery(st, q));
    const merged = new Map();
    [...remoteItems, ...localItems].forEach((st) => {
      if (st?.code && !merged.has(st.code)) {
        merged.set(st.code, stockByCode(st.code) || st);
      }
    });
    return [...merged.values()];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [watchAddQuery, watchAddSearch.data, issueItems, allStocks, allArticles]);

  // 서버 요약을 화면 칸으로. 아직 받기 전이거나 오늘 요약이 없으면 "준비 중"을 그대로 알림 (요약을 지어내지 않음)
  const loadedSummary = summariesByStock[selectedStockCode];
  // SNS 반응 요약은 1차 화면에서 뺌(#93) → 뉴스 요약이 있어야 "준비됨"
  const currentSummary = loadedSummary?.newsSummary
    ? {
      ...loadedSummary,
      headline: `${selectedStock.name} 오늘의 AI 종합 요약`,
      summary: loadedSummary.newsSummary,
    }
    : {
      updatedAt: '-',
      headline: loadedSummary ? `${selectedStock.name} 오늘 AI 요약 없음` : `${selectedStock.name} AI 요약 불러오는 중`,
      // "준비 중"이라고만 쓰면 영영 안 생기는 종목도 기다리게 됨 (2026-11-10 QA: 오늘 뉴스 종목 110개 중 22개는
      // AI 활용 금지 언론사 기사만 있어 요약이 생기지 않음) → 언제 생기고 왜 없을 수 있는지 알려 줌
      summary: loadedSummary
        ? '종목 요약은 1시간마다 만듭니다. AI 활용을 금지한 언론사 기사와 공시는 요약에 쓰지 않아서, 그런 글만 있는 종목은 요약이 없을 수 있습니다.'
        : 'AI 요약을 불러오는 중입니다.',
      newsSummary: '',
      snsSummary: '',
      sentimentRatio: loadedSummary?.sentimentRatio ?? null,
      sentimentByEvent: loadedSummary?.sentimentByEvent ?? null,
      sentimentByEventCount: loadedSummary?.sentimentByEventCount ?? 0,
    };

  // 요약이 없는 종목: 오늘 제목으로만 연결한 기사(AI 활용 금지 언론사)를 대신 보여 줌 → 빈 카드 대신 "무슨 소식이 있었나"
  const todayTitleOnly = useMemo(
    () =>
      allArticles
        .filter((art) => art.titleOnly && art.daysAgo === 0)
        .filter((art) => art.relatedStocks.some((r) => r.code === selectedStockCode))
        .slice(0, 5),
    [allArticles, selectedStockCode]
  );

  const trendSeries = mentionSeries;

  // 오늘 뉴스·SNS 글 수: 언급량 API(오늘, 1시간 단위)를 더함. 그래프 기간을 바꿔도 이 숫자는 오늘 기준
  const todayMentions = useApi(
    (signal) => stockApi.mentions(selectedStockCode, 'today', { signal }),
    [selectedStockCode],
    { enabled: Boolean(selectedStockCode) }
  );
  const todayCounts = useMemo(
    () =>
      (todayMentions.data?.items || []).reduce(
        (acc, pt) => ({
          news: acc.news + Number(pt.newsCount || 0),
          sns: acc.sns + Number(pt.snsCount || 0),
        }),
        { news: 0, sns: 0 }
      ),
    [todayMentions.data]
  );

  // 홈: 뉴스·공시 최신순 (SNS 글은 1차 화면에서 뺌)
  const homeFeedArticles = useMemo(
    () =>
      sortArticles(
        allArticles
          .filter((art) => art.sourceType !== 'SNS')
          .filter((art) => matchesChannel(art, channelFilter))
          .filter((art) => matchesSentiment(art, sentimentFilter))
          .filter((art) => {
            if (!onlyWatchlistArticles) return true;
            return art.relatedStocks.some((r) => watchlistCodes.includes(r.code));
          })
          .filter((art) => articlePeriod === 'ALL' || art.daysAgo <= Number(articlePeriod)),
        'latest',
        []
      ),
    [allArticles, channelFilter, sentimentFilter, onlyWatchlistArticles, watchlistCodes, articlePeriod]
  );

  useEffect(() => {
    if (activeNav !== 'stock' || stockViewMode !== 'detail' || stockTab !== 'news') {
      return undefined;
    }

    const controller = new AbortController();
    // 이 종목의 뉴스·공시 최근 100건 (API 한 번에 받을 수 있는 최대) → 공용 글 목록에 합침
    articleApi
      .list(
        { stockCode: selectedStockCode, source: 'NEWS', page: 1, size: 100 },
        { signal: controller.signal }
      )
      .then((res) => mergeArticles((res.items || []).map(toUiArticle)))
      .catch((err) => {
        if (err.name !== 'AbortError') {
          console.error('종목별 뉴스 조회 실패:', err);
        }
      });

    return () => controller.abort();
  }, [activeNav, stockViewMode, stockTab, selectedStockCode, mergeArticles]);

  // 종목 화면 뉴스·공시: "이 종목이 주인공인 글만", 정렬은 최신순 / 주인공 먼저
  const stockFeedArticles = useMemo(
    () =>
      sortArticles(
        allArticles
          .filter((art) => art.sourceType !== 'SNS')
          .filter((art) => art.relatedStocks.some((r) => r.code === selectedStockCode))
          .filter((art) => matchesSentiment(art, sentimentFilter))
          .filter((art) => articlePeriod === 'ALL' || art.daysAgo <= Number(articlePeriod))
          .filter((art) => !onlyMainRole || isMainFor(art, [selectedStockCode])),
        articleSort,
        [selectedStockCode]
      ),
    [allArticles, selectedStockCode, sentimentFilter, articlePeriod, onlyMainRole, articleSort]
  );

  // 종목 화면 뉴스·공시 탭은 글을 고르기 전에도 첫 글을 오른쪽에 보여 줌 → 그 글의 상세(연결 이유·근거 문장)도 받음
  const defaultStockArticleId =
    activeNav === 'stock' && stockViewMode === 'detail' && stockTab === 'news' && !selectedArticleId
      ? stockFeedArticles[0]?.id || null
      : null;
  const defaultStockArticleLoaded = Boolean(defaultStockArticleId && articleDetails[defaultStockArticleId]);
  useEffect(() => {
    if (!defaultStockArticleId || defaultStockArticleLoaded) return undefined;
    const controller = new AbortController();
    articleApi
      .get(defaultStockArticleId, { signal: controller.signal })
      .then((data) =>
        setArticleDetails((prev) => ({ ...prev, [defaultStockArticleId]: toUiArticle(data) }))
      )
      .catch((err) => {
        if (err.name !== 'AbortError') console.error('뉴스 상세 API 조회 실패:', err);
      });
    return () => controller.abort();
  }, [defaultStockArticleId, defaultStockArticleLoaded]);

  // 관심 종목 화면: 관심 종목 글 모아 보기 API (최근 100건) → 공용 글 목록에 합침
  useEffect(() => {
    if (activeNav !== 'watchlist' || !user || watchlistCodes.length === 0) return undefined;
    const controller = new AbortController();
    watchlistApi
      .articles({ source: 'NEWS', page: 1, size: 100 }, { signal: controller.signal })
      .then((res) => mergeArticles((res.items || []).map(toUiArticle)))
      .catch((err) => {
        if (err.name !== 'AbortError') console.error('관심 종목 글 조회 실패:', err);
      });
    return () => controller.abort();
  }, [activeNav, user, watchlistCodes, mergeArticles]);

  // 관심 종목 각 종목별 뉴스·공시 건수를 정확히 나누어 집계하기 위해 미조회 종목 기사를 보강 조회
  useEffect(() => {
    if (!user || watchlistCodes.length === 0) return undefined;
    const pendingCodes = watchlistCodes.filter(
      (code) => code && !requestedWatchStockArticlesRef.current.has(code)
    );
    if (pendingCodes.length === 0) return undefined;

    const controller = new AbortController();
    pendingCodes.forEach((code) => {
      requestedWatchStockArticlesRef.current.add(code);
      articleApi
        .list({ stockCode: code, source: 'NEWS', page: 1, size: 100 }, { signal: controller.signal })
        .then((res) => {
          mergeArticles((res?.items || []).map(toUiArticle));
          setLoadedWatchStockCodes((prev) => ({ ...prev, [code]: true }));
        })
        .catch((err) => {
          requestedWatchStockArticlesRef.current.delete(code);
          if (err.name !== 'AbortError') {
            console.error(`관심 종목(${code}) 기사 조회 실패:`, err);
          }
        });
    });

    return () => controller.abort();
  }, [user, watchlistCodes, mergeArticles]);

  // 관심 종목 화면: 선택된 관심 종목이 있으면 해당 종목 기사도 추가로 조회해 보강
  useEffect(() => {
    if (activeNav !== 'watchlist' || !user || !selectedWatchStockCode) return undefined;
    const controller = new AbortController();
    articleApi
      .list(
        { stockCode: selectedWatchStockCode, source: 'NEWS', page: 1, size: 100 },
        { signal: controller.signal }
      )
      .then((res) => {
        mergeArticles((res.items || []).map(toUiArticle));
        setLoadedWatchStockCodes((prev) => ({ ...prev, [selectedWatchStockCode]: true }));
      })
      .catch((err) => {
        if (err.name !== 'AbortError') console.error('선택 관심 종목 기사 조회 실패:', err);
      });
    return () => controller.abort();
  }, [activeNav, user, selectedWatchStockCode, mergeArticles]);

  const activeWatchFilterCodes = useMemo(
    () => (selectedWatchStockCode ? [selectedWatchStockCode] : watchlistCodes),
    [selectedWatchStockCode, watchlistCodes]
  );

  // 관심 종목 화면: 선택된 관심 종목(또는 전체 관심 종목) 뉴스·공시 목록
  const watchlistFeedArticles = useMemo(
    () =>
      sortArticles(
        allArticles
          .filter((art) => art.sourceType !== 'SNS')
          .filter((art) => art.relatedStocks.some((r) => activeWatchFilterCodes.includes(r.code)))
          .filter((art) => matchesChannel(art, channelFilter))
          .filter((art) => matchesSentiment(art, sentimentFilter))
          .filter((art) => articlePeriod === 'ALL' || art.daysAgo <= Number(articlePeriod))
          .filter((art) => !onlyMainRole || isMainFor(art, activeWatchFilterCodes)),
        articleSort,
        activeWatchFilterCodes
      ),
    [
      allArticles,
      activeWatchFilterCodes,
      channelFilter,
      sentimentFilter,
      articlePeriod,
      onlyMainRole,
      articleSort,
    ]
  );

  // 종목 탐색: 검색어가 있으면 종목 검색 API + 전체 종목(allStocks) 필터링, 없으면 이슈 종목 + 전체 종목
  const stockListSearch = useApi(
    (signal) => stockApi.search(stockListQuery.trim(), { size: 100 }, { signal }),
    [stockListQuery],
    { enabled: Boolean(stockListQuery.trim()) }
  );
  useEffect(() => {
    rememberStocks((stockListSearch.data?.items || []).map(toUiStock), { onlyNew: true });
  }, [stockListSearch.data, rememberStocks]);

  const filteredStockList = useMemo(() => {
    const q = stockListQuery.trim().toLowerCase();
    const mergedMap = new Map();
    if (q) {
      (stockListSearch.data?.items || []).forEach((it) => {
        const st = stockByCode(it.stockCode) || toUiStock(it);
        if (st?.code) mergedMap.set(st.code, st);
      });
      allStocks.forEach((st) => {
        if (st?.code && !mergedMap.has(st.code) && matchStockByQuery(st, q)) {
          mergedMap.set(st.code, st);
        }
      });
    } else {
      issueItems.forEach((it) => {
        const st = stockByCode(it.stockCode) || toUiStock(it);
        if (st?.code) mergedMap.set(st.code, st);
      });
      allStocks.forEach((st) => {
        if (st?.code && !mergedMap.has(st.code)) {
          mergedMap.set(st.code, st);
        }
      });
    }
    return [...mergedMap.values()]
      .filter((st) => (stockListMarket === 'ALL' ? true : st.market === stockListMarket))
      .sort((a, b) => {
        if (stockListSort === 'up') return (b.changeRate ?? -999) - (a.changeRate ?? -999);
        if (stockListSort === 'down') return (a.changeRate ?? 999) - (b.changeRate ?? 999);
        if (stockListSort === 'name') return a.name.localeCompare(b.name, 'ko');
        return (b.todayMatchedCount || 0) - (a.todayMatchedCount || 0);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allStocks, allArticles, stockListQuery, stockListSearch.data, issueItems, stockListMarket, stockListSort]);

  // 홈 오늘의 이슈 종목 TOP 7 (서버 순위). 급상승·급하락은 그중 현재가를 받은 종목을 등락률로 다시 정렬
  const homeRankedStocks = useMemo(() => {
    const list = issueItems.map((it) => stockByCode(it.stockCode)).filter(Boolean);
    if (homeRankFilter === 'up') {
      return list.sort((a, b) => (b.changeRate ?? -999) - (a.changeRate ?? -999)).slice(0, 7);
    }
    if (homeRankFilter === 'down') {
      return list.sort((a, b) => (a.changeRate ?? 999) - (b.changeRate ?? 999)).slice(0, 7);
    }
    return list.slice(0, 7);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allStocks, issueItems, homeRankFilter]);

  const currentComments = commentsByStock[selectedStockCode] || [];

  const requireLogin = (msg) => {
    triggerToast(msg);
    setAuthMode('login');
    setAuthError(msg);
    setShowAuthModal(true);
  };

  // 새로고침: 데이터 상태·이슈 순위·글 목록을 서버에서 다시 받음 (시각을 화면이 지어내지 않음)
  const handleRefreshData = () => {
    status.reload();
    issues.reload();
    setArticlesTick((t) => t + 1);
    triggerToast(`🔄 최신 데이터를 다시 불러왔습니다 (${nowTimeShort()})`);
  };

  // 종합 요약 다시 생성 (로그인 필요). AI 서버가 같은 종목은 10분에 1번만 새로 만들고, 그 사이엔 저장본을 돌려줌
  const handleRegenerateSummary = async () => {
    if (regenerating) return;
    if (!user) {
      requireLogin('🔒 AI 요약 다시 생성은 로그인이 필요합니다.');
      return;
    }
    const code = selectedStockCode;
    setRegenerating(true);
    try {
      const res = await stockApi.regenerate(code);
      setSummariesByStock((prev) => ({ ...prev, [code]: toUiSummary(res.summary) }));
      triggerToast(
        res.regenerated
          ? '🤖 AI 요약을 새로 만들었습니다.'
          : 'ℹ️ 최근 10분 안에 만든 요약이 있어 그대로 보여 드립니다.'
      );
    } catch (error) {
      console.error('요약 다시 생성 실패:', error);
      triggerToast('AI 요약 다시 생성에 실패했습니다. 잠시 뒤 다시 시도해 주세요.');
    } finally {
      setRegenerating(false);
    }
  };

  const watchlistPendingRef = useRef(new Set());

  const handleAddWatchlist = async (rawCode, candidate = null) => {
    if (!user || !tokenStore.get()) {
      requireLogin('관심종목 추가는 로그인이 필요합니다.');
      return false;
    }

    const code = normalizeStockCode(rawCode, candidate);
    if (!code) {
      triggerToast('종목코드를 확인해 주세요.');
      return false;
    }

    const baseStock =
      stockByCode(code) ||
      (candidate
        ? {
          ...toUiStock({
            stockCode: code,
            stockName: candidate.stockName || candidate.name || code,
            market: candidate.market || '',
            sector: candidate.sector || '',
          }),
          ...candidate,
          code,
          name: candidate.name || candidate.stockName || code,
        }
        : toUiStock({ stockCode: code, stockName: code }));

    if (watchlistCodes.includes(code)) {
      triggerToast(`ℹ️ 이미 관심종목에 등록된 종목입니다: ${baseStock.name}(${code})`);
      return false;
    }

    if (watchlistPendingRef.current.has(code)) {
      return false;
    }
    watchlistPendingRef.current.add(code);

    try {
      const res = await watchlistApi.add({ stockCode: code });
      const status = res?.status ?? 201;
      const isOk = status === 200 || status === 201 || Boolean(res?.stockCode);
      if (!isOk) {
        throw new Error('관심종목 등록 응답을 확인하지 못했습니다.');
      }

      const resolvedStock = res?.stockCode
        ? {
          ...baseStock,
          ...toUiStock(res),
          code: normalizeStockCode(res.stockCode, baseStock),
          name: res.stockName || baseStock.name || code,
          market: res.market || baseStock.market || '',
          sector: baseStock.sector || '',
          todayMatchedCount: res.todayArticleCount ?? baseStock.todayMatchedCount ?? 0,
          todayArticleCount: res.todayArticleCount ?? baseStock.todayArticleCount ?? 0,
          lastMatchedAt: toDisplayTime(res.lastMatchedAt) || baseStock.lastMatchedAt || '-',
        }
        : baseStock;

      rememberStocks([resolvedStock]);
      setLocalExtraWatchlist((prev) => prev.filter((c) => c !== code));
      setWatchlistCodes((prev) =>
        prev.includes(code) ? prev : [code, ...prev]
      );
      triggerToast(`★ ${resolvedStock.name}(${code}) 관심종목에 추가했습니다.`);
      await refreshWatchlist({ silent: true });
      return true;
    } catch (error) {
      console.error('관심종목 등록 실패:', error);
      // 구버전 백엔드 컨테이너(^[0-9]{6}$ 검증)에서 0007C0 같은 영문 포함 종목코드가 400으로 거절될 때 프론트 상태에 정상 등록 처리
      if (error?.status === 400 && /[A-Z]/i.test(code)) {
        rememberStocks([baseStock]);
        setLocalExtraWatchlist((prev) => (prev.includes(code) ? prev : [code, ...prev]));
        setWatchlistCodes((prev) =>
          prev.includes(code) ? prev : [code, ...prev]
        );
        triggerToast(`★ ${baseStock.name}(${code}) 관심종목에 추가했습니다.`);
        return true;
      }
      if (error?.status === 409 || error?.code === 'ALREADY_IN_WATCHLIST') {
        rememberStocks([baseStock], { onlyNew: true });
        setWatchlistCodes((prev) =>
          prev.includes(code) ? prev : [code, ...prev]
        );
        await refreshWatchlist({ silent: true });
        triggerToast(
          error?.message || `ℹ️ 이미 관심종목에 등록된 종목입니다: ${baseStock.name}(${code})`
        );
        return false;
      }
      if (error?.status === 401 || error?.code === 'UNAUTHORIZED') {
        setUser(null);
        setWatchlistCodes([]);
        requireLogin('🔒 로그인이 만료되었습니다. 다시 로그인해 주세요.');
        return false;
      }
      if (error?.status === 404 || error?.code === 'STOCK_NOT_FOUND') {
        triggerToast(error?.message || `종목을 찾을 수 없습니다 (${code}).`);
        return false;
      }
      triggerToast(error?.message || '관심종목 등록에 실패했습니다.');
      return false;
    } finally {
      watchlistPendingRef.current.delete(code);
    }
  };

  const handleRemoveWatchlist = async (rawCode) => {
    if (!user || !tokenStore.get()) {
      requireLogin('관심종목 삭제는 로그인이 필요합니다.');
      return false;
    }

    const code = normalizeStockCode(rawCode);
    if (!code) return false;

    if (watchlistPendingRef.current.has(code)) {
      return false;
    }
    watchlistPendingRef.current.add(code);

    const stock = stockByCode(code);
    try {
      setLocalExtraWatchlist((prev) => prev.filter((c) => c !== code));
      const res = await watchlistApi.remove(code);
      const status = res?.status ?? 204;
      const isOk = status === 200 || status === 204 || res?.ok !== false;
      if (!isOk) {
        throw new Error('관심종목 삭제 응답을 확인하지 못했습니다.');
      }
      setWatchlistCodes((prev) =>
        prev.filter((c) => c !== code)
      );
      triggerToast(`☆ ${stock?.name ?? code} 관심종목에서 삭제했습니다.`);
      await refreshWatchlist({ silent: true });
      return true;
    } catch (error) {
      console.error('관심종목 삭제 실패:', error);
      if (error?.status === 404 || error?.code === 'WATCHLIST_NOT_FOUND' || error?.status === 400) {
        setLocalExtraWatchlist((prev) => prev.filter((c) => c !== code));
        setWatchlistCodes((prev) => prev.filter((c) => c !== code));
        await refreshWatchlist({ silent: true });
        triggerToast(`☆ ${stock?.name ?? code} 관심종목에서 삭제했습니다.`);
        return true;
      }
      if (error?.status === 401 || error?.code === 'UNAUTHORIZED') {
        setUser(null);
        setWatchlistCodes([]);
        requireLogin('🔒 로그인이 만료되었습니다. 다시 로그인해 주세요.');
        return false;
      }
      triggerToast(error?.message || '관심종목 삭제에 실패했습니다.');
      return false;
    } finally {
      watchlistPendingRef.current.delete(code);
    }
  };

  const handleToggleWatchlist = async (rawCode, candidate = null) => {
    const code = normalizeStockCode(rawCode, candidate);
    if (!code) return;
    if (isInWatchlist(code)) {
      await handleRemoveWatchlist(code);
    } else {
      await handleAddWatchlist(code, candidate);
    }
  };

  const handleWatchAddSubmit = async (e) => {
    e.preventDefault();
    const rawQuery = watchAddQuery.trim();
    if (!rawQuery) {
      triggerToast('추가할 종목명·종목코드 또는 별칭을 입력해 주세요.');
      return;
    }

    const q = rawQuery.toLowerCase();
    let candidates = watchAddCandidates.filter((s) => matchStockByQuery(s, q));

    // 비동기 검색 응답 대기 중이거나 로컬 후보가 비어 있을 때 서버에서 즉시 조회
    if (candidates.length === 0) {
      try {
        const res = await stockApi.search(rawQuery, { page: 1, size: 20 });
        const fetched = (res?.items || []).map((it) => {
          const ui = toUiStock(it);
          return stockByCode(ui.code) || ui;
        });
        if (fetched.length > 0) {
          rememberStocks(fetched, { onlyNew: true });
          candidates = fetched;
        }
      } catch (err) {
        console.error('관심종목 빠른 추가 검색 실패:', err);
      }
    }

    if (candidates.length === 0) {
      triggerToast('일치하는 종목을 찾지 못했습니다.');
      return;
    }

    // 정확히 이름이 일치하거나 코드가 일치하는 종목이 있으면 우선 선택
    const exactMatch = candidates.find(
      (s) =>
        (s.name || '').toLowerCase() === q ||
        (s.code || '').toLowerCase() === q ||
        (s.aliases || []).some((al) => String(al).toLowerCase() === q)
    );
    if (exactMatch && isInWatchlist(exactMatch.code)) {
      triggerToast(`ℹ️ 이미 관심종목에 등록된 종목입니다: ${exactMatch.name}(${exactMatch.code})`);
      return;
    }

    const target =
      (exactMatch && !isInWatchlist(exactMatch.code) ? exactMatch : null) ||
      candidates.find((s) => !isInWatchlist(s.code));

    if (!target) {
      triggerToast('검색된 종목이 이미 모두 관심종목에 등록되어 있습니다.');
      return;
    }

    const added = await handleAddWatchlist(target.code, target);
    if (added) {
      setWatchAddQuery('');
    }
  };

  const handleSelectSearchStock = (stock) => {
    setSearchQuery('');
    setShowAutocomplete(false);
    navigateToStockDetail(stock.code, 'summary');
  };

  const handleSelectSearchArticle = (article) => {
    // 주인공 종목 화면의 뉴스·공시 탭으로 (relatedStocks 는 주인공 먼저)
    const primaryCode = article.relatedStocks[0]?.code || selectedStockCode;
    setSelectedStockCode(primaryCode);
    setActiveNav('stock');
    setStockViewMode('detail');
    setStockTab('news');
    setSelectedArticleId(article.id);
    setSearchQuery('');
    setShowAutocomplete(false);
    triggerToast(`📰 선택한 ${article.isDisclosure ? '공시' : '뉴스'} 상세 분석으로 이동했습니다.`);
  };

  const handleAuthSubmit = async (e) => {
    e.preventDefault();
    const id = authForm.username.trim();
    const pw = authForm.password;

    if (!id || !pw.trim()) {
      setAuthError('아이디와 비밀번호를 모두 입력해 주세요.');
      return;
    }

    try {
      setAuthError('');
      if (authMode === 'signup') {
        if (!/^[a-z0-9]{4,20}$/.test(id)) {
          setAuthError('아이디는 영문 소문자(a-z)와 숫자(0-9) 4~20자로 입력해 주세요.');
          return;
        }
        if (pw.length < 8 || pw.length > 64) {
          setAuthError('비밀번호는 8~64자로 입력해 주세요.');
          return;
        }
        if (pw !== authForm.passwordConfirm) {
          setAuthError('비밀번호 확인이 일치하지 않습니다.');
          return;
        }
        await authApi.signup(id, pw);
      }

      const result = await authApi.login(id, pw);
      if (!result?.accessToken) {
        throw new Error('로그인 토큰이 발급되지 않았습니다.');
      }

      localStorage.setItem('snm_current_user', id);
      setUser({ username: id });
      setShowAuthModal(false);
      setAuthForm({
        username: '',
        password: '',
        passwordConfirm: '',
      });
      setAuthError('');
      triggerToast(`👋 환영합니다, ${id}님!`);
    } catch (error) {
      console.error('인증 API 오류:', error);
      if (error?.status === 409 || error?.code === 'DUPLICATE_LOGIN_ID') {
        setAuthError('이미 사용 중인 아이디입니다. 다른 아이디를 입력해 주세요.');
      } else if (error?.message && error?.status === 400) {
        setAuthError(error.message);
      } else {
        setAuthError(
          authMode === 'signup'
            ? '회원가입 또는 로그인에 실패했습니다. 아이디(영문 소문자·숫자 4~20자)와 비밀번호(8~64자) 형식을 확인해 주세요.'
            : '로그인에 실패했습니다. 아이디와 비밀번호를 확인해 주세요.'
        );
      }
    }
  };

  const handleLogout = () => {
    setShowLogoutModal(true);
  };

  const confirmLogout = () => {
    setShowLogoutModal(false);
    authApi.logout();
    localStorage.removeItem('snm_current_user');
    setUser(null);
    setWatchlistCodes([]);
    setLoadedWatchStockCodes({});
    requestedWatchStockArticlesRef.current.clear();
    triggerToast('로그아웃되었습니다.');
  };

  // 게시판 오류 안내 (401 로그인 만료, 403 본인 글 아님 등은 서버 메시지를 그대로)
  const handleBoardError = (err, action) => {
    console.error(`종목토론 ${action} 실패:`, err);
    if (err?.status === 401) {
      requireLogin('🔒 로그인이 만료되었습니다. 다시 로그인해 주세요.');
      return;
    }
    triggerToast(err?.message ? `${action}하지 못했습니다: ${err.message}` : `${action}하지 못했습니다.`);
  };

  const handleAddCommentForStock = (stockCode, content) => {
    const targetCode = stockCode || selectedStockCode;
    // 화면은 댓글형, 서버는 게시판: 의견 하나 = 게시판 글 하나 (제목·본문에 같은 내용)
    boardApi
      .write(targetCode, content, content)
      .then(() => {
        loadComments(targetCode);
        triggerToast('💬 종목토론 의견이 등록되었습니다.');
      })
      .catch((err) => handleBoardError(err, '의견을 등록'));
  };

  const handleToggleLikeForStock = (stockCode, commentId) => {
    if (!user) {
      requireLogin('🔒 의견 공감은 로그인이 필요합니다.');
      return;
    }
    const targetCode = stockCode || selectedStockCode;
    // 공감 토글 결과(liked, likeCount)는 서버 답 그대로 (화면이 짐작하지 않음)
    boardApi
      .toggleLike(commentId)
      .then((res) =>
        setCommentsByStock((prev) => ({
          ...prev,
          [targetCode]: (prev[targetCode] || []).map((c) =>
            (c.commentId ?? c.id) === commentId
              ? { ...c, likedByMe: res.liked, likes: res.likeCount }
              : c
          ),
        }))
      )
      .catch((err) => handleBoardError(err, '공감'));
  };

  const handleDeleteCommentForStock = (stockCode, commentId) => {
    const targetCode = stockCode || selectedStockCode;
    boardApi
      .removePost(commentId)
      .then(() => {
        setCommentsByStock((prev) => ({
          ...prev,
          [targetCode]: (prev[targetCode] || []).filter(
            (c) => (c.commentId ?? c.id) !== commentId
          ),
        }));
        triggerToast('🗑️ 의견이 삭제되었습니다.');
      })
      .catch((err) => handleBoardError(err, '의견을 삭제'));
  };

  const commentsProps = {
    stock: selectedStock,
    comments: currentComments,
    user,
    tabKey: stockTab,
    onAdd: (content) => handleAddCommentForStock(selectedStockCode, content),
    onDelete: (cid) => handleDeleteCommentForStock(selectedStockCode, cid),
    onToggleLike: (cid) => handleToggleLikeForStock(selectedStockCode, cid),
    onRequireLogin: requireLogin,
  };

  const detailSharedProps = {
    allStocks,
    allArticles,
    liveQuotes,
    regenerating,
    onRegenerateSummary: handleRegenerateSummary,
    showComments: true,
    preferredStockCode: selectedStockCode,
    commentsByStock,
    user,
    onAddCommentForStock: handleAddCommentForStock,
    onDeleteCommentForStock: handleDeleteCommentForStock,
    onToggleLikeForStock: handleToggleLikeForStock,
    onRequireLogin: requireLogin,
    onNeedComments: loadComments,
  };

  const renderSearchAutocomplete = () => {
    if (!showAutocomplete || !searchQuery.trim()) return null;
    return (
      <div
        id="searchResult"
        className="autocomplete-dropdown"
        onMouseDown={(e) => e.preventDefault()}
        role="listbox"
        aria-label="통합 검색 자동완성 결과"
      >
        <div className="auto-filter-bar">
          <div className="auto-filter-group">
            {ARTICLE_PERIODS.map((p) => (
              <button
                key={p.key}
                type="button"
                className={`more-link2 ${searchPeriod === p.key ? 'active' : ''}`}
                onClick={() => setSearchPeriod(p.key)}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        <div className="auto-section-label">📈 매칭 종목 (클릭 시 종목 상세 이동)</div>
        {integratedSearchResults.matchedStocks.length === 0 ? (
          <div className="auto-empty">일치하는 종목이 없습니다.</div>
        ) : (
          integratedSearchResults.matchedStocks.map((s) => (
            <div key={s.code} className="auto-row">
              <button
                type="button"
                className="auto-item"
                onClick={() => handleSelectSearchStock(s)}
              >
                <span>
                  <strong>{s.name}</strong>{' '}
                  <span className="stock-code num">
                    ({s.code} · {s.market})
                  </span>
                </span>
                <span className="num">
                  {s.price !== null ? (
                    <span className={rateTone(s.changeRate)}>
                      {s.price.toLocaleString()}원 ({formatRate(s.changeRate)})
                    </span>
                  ) : s.analysisReady === false ? (
                    <span className="auto-action">{s.sector}</span>
                  ) : (
                    <span className="auto-action">매칭 {s.todayMatchedCount}건</span>
                  )}
                </span>
              </button>
              <button
                type="button"
                className="star-btn"
                title={isInWatchlist(s.code) ? '관심종목 해제' : '관심종목 추가'}
                aria-label={`${s.name} ${isInWatchlist(s.code) ? '관심종목 해제' : '관심종목 추가'}`}
                onClick={() => handleToggleWatchlist(s.code, s)}
              >
                {isInWatchlist(s.code) ? '★' : '☆'}
              </button>
            </div>
          ))
        )}

        <div className="auto-section-label">📰 매칭 뉴스·공시 (제목·3줄요약·키워드)</div>
        {integratedSearchResults.matchedArticles.length === 0 ? (
          <div className="auto-empty">조건에 일치하는 뉴스·공시가 없습니다.</div>
        ) : (
          integratedSearchResults.matchedArticles.map((art) => (
            <button
              key={art.id}
              type="button"
              className="auto-item"
              onClick={() => handleSelectSearchArticle(art)}
            >
              <span className="auto-article-title">
                <span className={`source-pill ${art.isDisclosure ? 'disclosure' : 'news'}`}>
                  {sourceLabelOf(art)}
                </span>
                <span>{art.title}</span>
              </span>
              <span className="stock-meta num">{art.publishedAt.slice(5)}</span>
            </button>
          ))
        )}
      </div>
    );
  };

  const renderQuickSwitch = () => {
    const extraStock = isInWatchlist(selectedStock.code) ? null : selectedStock;
    return (
      <nav className="quick-switch" aria-label="관심종목 빠른 전환">
        <span className="quick-label">⚡ 관심종목 퀵 스위치</span>
        <div
          className="quick-chips"
          style={{
            maxHeight: '84px',
            overflowY: 'auto',
            overflowX: 'hidden',
            flexWrap: 'wrap',
            flex: 1,
            minWidth: 0,
          }}
        >
          {extraStock && (
            <button
              type="button"
              className="quick-chip active"
              onClick={() => navigateToStockDetail(extraStock.code, stockTab, false)}
            >
              <span className="quick-chip-tag">선택됨</span>
              <span>{extraStock.name}</span>
              {extraStock.changeRate !== null && (
                <span className={`quick-chip-rate num ${rateTone(extraStock.changeRate)}`}>
                  {formatRate(extraStock.changeRate)}
                </span>
              )}
            </button>
          )}
          {watchlistStocks.map((st) => (
            <button
              key={st.code}
              type="button"
              className={`quick-chip ${st.code === selectedStockCode ? 'active' : ''}`}
              onClick={() => navigateToStockDetail(st.code, stockTab, true)}
            >
              <span>★ {st.name}</span>
              {st.changeRate !== null ? (
                <span className={`quick-chip-rate num ${rateTone(st.changeRate)}`}>
                  {formatRate(st.changeRate)}
                </span>
              ) : (
                <span className="quick-chip-rate num">{st.todayMatchedCount}건</span>
              )}
            </button>
          ))}
        </div>
        <button
          type="button"
          className="quick-manage-btn"
          onClick={() => setShowWatchModal(true)}
          aria-label="관심종목 관리 열기"
        >
          <span>⭐</span>
          <span>+ 관심종목 관리</span>
        </button>
      </nav>
    );
  };

  const renderHomeView = () => {
    // 감성 칩·오늘의 소식 요약 숫자 (판단 보류 = 감성을 판단하지 않은 글은 중립에 섞지 않고 따로 셈)
    const homeSentimentCounts = countSentiments(homeFeedArticles);

    const homeChannelCounts = {
      news: homeFeedArticles.filter((a) => !a.isDisclosure).length,
      disclosure: homeFeedArticles.filter((a) => a.isDisclosure).length,
    };

    let homeActiveSubFilterCount = 0;
    if (articlePeriod !== 'ALL') homeActiveSubFilterCount += 1;
    if (onlyWatchlistArticles) homeActiveSubFilterCount += 1;

    const filteredHomeArticles = (() => {
      const q = feedLocalQuery.trim().toLowerCase();
      if (!q) return homeFeedArticles;
      return homeFeedArticles.filter((art) => {
        const matchTitle = (art.title || '').toLowerCase().includes(q);
        const matchKeywords = (art.keywords || []).some((kw) =>
          kw.toLowerCase().includes(q)
        );
        const matchStocks = (art.relatedStocks || []).some(
          (st) =>
            (st.name || '').toLowerCase().includes(q) ||
            (st.code || '').toLowerCase().includes(q)
        );
        const matchPress = (art.press || '').toLowerCase().includes(q);
        return matchTitle || matchKeywords || matchStocks || matchPress;
      });
    })();

    const PAGE_SIZE = 5;
    const homeTotalPages = Math.max(1, Math.ceil(filteredHomeArticles.length / PAGE_SIZE));
    const currentHomeArticles = filteredHomeArticles.slice(
      (homePage - 1) * PAGE_SIZE,
      homePage * PAGE_SIZE
    );

    const selectedHomeArticle =
      articleDetails[selectedArticleId] ||
      homeFeedArticles.find((a) => a.id === selectedArticleId) ||
      null;

    return (
      <div className="wrapper">
        <section className="market-ticker-bar" aria-label="시장 지표 티커 바">
          <div className="ticker-label">
            <span className="live-dot" aria-hidden="true" />
            <span>시장 지표</span>
          </div>
          <div className="ticker-items">
            {MARKET_INDICES_DATA.map((idxItem) => (
              <div key={idxItem.key} className="ticker-item">
                <span className="ticker-name">{idxItem.name}</span>
                <span className="ticker-value num">{idxItem.value}</span>
                <span className="ticker-tag">{idxItem.changeText}</span>
              </div>
            ))}
          </div>
          <div className="ticker-notice">※ KIS Open API 연동 준비 중 (시세 대기)</div>
        </section>

        {/* [V7] A1: 상단 별도 필터 바를 제거하고 목록 카드 안으로 통합 */}

        <div className="split-layout">
          <div className="content-card" ref={homeFeedRef}>
            {/* [V7] A5: 목록 카드 상단에 얇은 한 줄 N-05 안내 배너 유지 (문구 축소/삭제 금지) */}
            <div className="llm-notice feed-top-banner">
              🤖 안내(N-05): AI 요약·기사 내용 판단은 투자 권유나 주가 예측이 아니며 틀릴 수 있습니다. 원문과 공시를 꼭 확인해 주세요.
            </div>

            <div className="card-header">
              <div className="card-title">
                📰 실시간 뉴스·공시 × 종목 AI 매칭 소식{' '}
                <span className="count-badge num">{filteredHomeArticles.length}</span>
              </div>
              <span className="card-caption">
                글 클릭 시 우측 상세 분석 · #종목칩 클릭 시 종목 상세 화면 이동
              </span>
            </div>

            {/* [V7] A1: 순서 1 [목록 검색창] */}
            <div className="feed-local-search-bar">
              <input
                type="text"
                className="feed-local-search-input"
                placeholder="종목명·키워드로 이 목록 검색"
                aria-label="실시간 소식 목록 전용 검색"
                value={feedLocalQuery}
                onChange={(e) => {
                  setFeedLocalQuery(e.target.value);
                  setHomePage(1);
                }}
              />
              {feedLocalQuery && (
                <button
                  type="button"
                  className="clear-search-btn"
                  aria-label="목록 검색어 지우기"
                  onClick={() => {
                    setFeedLocalQuery('');
                    setHomePage(1);
                  }}
                >
                  ✕
                </button>
              )}
            </div>

            {/* [V7] A1: 순서 2 [채널 탭 · 감성 칩 · 정렬 select를 한 줄 배치] */}
            <div className="unified-feed-toolbar">
              <div className="feed-toolbar-left">
                {/* 출처 탭: 뉴스 / 공시 (SNS는 1차에서 모으지 않음) */}
                <div className="seg-group" role="group" aria-label="출처 필터">
                  {CHANNEL_FILTERS.map((ch) => (
                    <button
                      key={ch.key}
                      type="button"
                      className={`more-link2 seg-btn ${channelFilter === ch.key ? 'active' : ''}`}
                      onClick={() => {
                        setChannelFilter(ch.key);
                        setHomePage(1);
                      }}
                    >
                      {ch.label}
                    </button>
                  ))}
                </div>

                {/* [V7] A2: 기사 내용 칩에 건수 표시("긍정 12"), 0건 칩 흐리게, ● 아이콘 통일 */}
                <div className="sentiment-filter-chips" role="group" aria-label="기사 내용 필터 칩">
                  {sentimentChips(homeSentimentCounts).map((chip) => {
                    const isActive = sentimentFilter === chip.key;
                    const isZero = chip.count === 0 && chip.key !== 'ALL';
                    return (
                      <button
                        key={chip.key}
                        type="button"
                        className={`more-link2 sentiment-chip-btn ${chip.cls} ${isActive ? 'active' : ''} ${isZero ? 'zero-count' : ''}`}
                        onClick={() => {
                          setSentimentFilter(chip.key);
                          setHomePage(1);
                        }}
                        aria-pressed={isActive}
                      >
                        <span className="chip-dot-icon">●</span>
                        <span>{chip.label} {chip.count}</span>
                      </button>
                    );
                  })}
                </div>

              </div>

              {/* [V7] A1: 우측 상세 필터 버튼 */}
              <div className="feed-toolbar-right">
                <button
                  type="button"
                  className={`more-link2 filter-toggle-btn ${homeActiveSubFilterCount > 0 ? 'active' : ''}`}
                  onClick={() => setIsFilterExpanded((prev) => !prev)}
                  aria-expanded={isFilterExpanded}
                  aria-label="상세 필터 접기/펼치기"
                >
                  <span>⚙️ 상세 필터</span>
                  {homeActiveSubFilterCount > 0 && (
                    <span className="filter-count-badge num">{homeActiveSubFilterCount}</span>
                  )}
                  <span>{isFilterExpanded ? '▲' : '▼'}</span>
                </button>
              </div>
            </div>

            {/* [V7] A1: 서브 필터 드롭다운 (감성 항목 완전히 삭제됨) */}
            {isFilterExpanded && (
              <div className="sub-filter-row">
                <div className="sub-filter-group" role="group" aria-label="기간 필터">
                  <span className="sub-filter-label">기간</span>
                  {ARTICLE_PERIODS.map((ap) => (
                    <button
                      key={ap.key}
                      type="button"
                      className={`more-link2 filter-chip ${articlePeriod === ap.key ? 'active' : ''}`}
                      onClick={() => {
                        setArticlePeriod(ap.key);
                        setHomePage(1);
                      }}
                    >
                      {ap.label}
                    </button>
                  ))}
                </div>

                <div className="sub-filter-group" role="group" aria-label="관심종목 글만 보기">
                  <button
                    type="button"
                    className={`more-link2 filter-chip ${onlyWatchlistArticles ? 'active' : ''}`}
                    onClick={() => {
                      setOnlyWatchlistArticles((prev) => !prev);
                      setHomePage(1);
                    }}
                  >
                    ★ 관심종목 글만
                  </button>
                </div>

                {homeActiveSubFilterCount > 0 && (
                  <button
                    type="button"
                    className="more-link2 reset-btn"
                    onClick={() => {
                      setArticlePeriod('ALL');
                      setOnlyWatchlistArticles(false);
                      setHomePage(1);
                    }}
                  >
                    초기화 ↺
                  </button>
                )}
              </div>
            )}

            {filteredHomeArticles.length === 0 && feedLocalQuery ? (
              <div className="empty-state">
                <div className="empty-icon">🔍</div>
                <div className="empty-title">검색 결과가 없어요</div>
                <div className="empty-sub">
                  ‘{feedLocalQuery}’에 해당하는 뉴스·공시를 찾을 수 없습니다.
                </div>
                <button
                  type="button"
                  className="more-link2 reset-btn"
                  style={{ marginTop: '10px' }}
                  onClick={() => {
                    setFeedLocalQuery('');
                    setHomePage(1);
                  }}
                >
                  검색어 지우기 ✕
                </button>
              </div>
            ) : (
              <>
                <ArticleList
                  articles={currentHomeArticles}
                  selectedId={selectedHomeArticle?.id}
                  onSelect={(artId) =>
                    setSelectedArticleId((prev) => (prev === artId ? null : artId))
                  }
                  onSelectStock={(code) => navigateToStockDetail(code, 'summary')}
                  loading={!feedBooted}
                />
                <Pagination
                  currentPage={homePage}
                  totalPages={homeTotalPages}
                  totalItems={filteredHomeArticles.length}
                  onPageChange={handleHomePageChange}
                />
              </>
            )}
          </div>

          <aside className="sticky-detail-panel" aria-label="우측 요약 및 상세 분석 패널">
            {selectedHomeArticle ? (
              <div className="panel">
                <ArticleDetail
                  {...detailSharedProps}
                  article={selectedHomeArticle}
                  onSelectStock={(code) => navigateToStockDetail(code, 'summary')}
                  onSelectArticle={(artId) => setSelectedArticleId(artId)}
                  onClose={() => setSelectedArticleId(null)}
                />
              </div>
            ) : (
              <div className="side-stack">
                <div className="content-card">
                  <div className="card-header">
                    <div className="card-title">🔥 오늘의 이슈 종목 TOP 7</div>
                    <div className="header-btn-group">
                      <button
                        type="button"
                        className={`more-link2 ${homeRankFilter === 'issue' ? 'active' : ''}`}
                        onClick={() => setHomeRankFilter('issue')}
                      >
                        이슈급증
                      </button>
                      <button
                        type="button"
                        className={`more-link2 ${homeRankFilter === 'up' ? 'active' : ''}`}
                        onClick={() => setHomeRankFilter('up')}
                      >
                        급상승
                      </button>
                      <button
                        type="button"
                        className={`more-link2 ${homeRankFilter === 'down' ? 'active' : ''}`}
                        onClick={() => setHomeRankFilter('down')}
                      >
                        급하락
                      </button>
                    </div>
                  </div>

                  <table className="stock-table compact-table">
                    <thead>
                      <tr>
                        <th>순위 · 종목명</th>
                        <th className="num-col">현재가</th>
                        <th className="num-col">등락률</th>
                        <th className="num-col" title="같은 소식을 여러 곳이 쓰면 소식은 1건으로 셉니다">글 · 소식</th>
                      </tr>
                    </thead>
                    <tbody>
                      {homeRankedStocks.map((st, idx) => {
                        const rankClass = idx < 3 ? `rank-${idx + 1}` : '';
                        return (
                          <tr
                            key={st.code}
                            tabIndex={0}
                            aria-label={`${idx + 1}위 ${st.name} 종목 상세로 이동`}
                            onClick={() => navigateToStockDetail(st.code, 'summary')}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' || e.key === ' ') {
                                e.preventDefault();
                                navigateToStockDetail(st.code, 'summary');
                              }
                            }}
                          >
                            <td>
                              <span className={`rank-badge num ${rankClass}`}>{idx + 1}</span>
                              <strong>{st.name}</strong>
                            </td>
                            <td className="num-col num">
                              <QuotePrice price={st.price} />
                            </td>
                            <td className="num-col num">
                              <QuoteRate rate={st.changeRate} size="sm" />
                            </td>
                            <td className="num-col num">
                              <strong>글 {st.todayMatchedCount}건</strong>
                              {st.todayEventCount != null && (
                                <div className="stock-meta num">
                                  소식 {st.todayEventCount}건
                                  {st.todayDisclosureCount > 0 && (
                                    <span title="오늘 공시 수 (순위는 뉴스 기사 수로만 매김)"> · 공시 {st.todayDisclosureCount}</span>
                                  )}
                                </div>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>

                  <div className="card-footer-link">
                    <button
                      type="button"
                      className="more-link"
                      onClick={() => {
                        setActiveNav('stock');
                        setStockViewMode('list');
                      }}
                    >
                      전체 종목 시세·순위 탐색 &gt;
                    </button>
                  </div>
                </div>

                {/* [V7] A4: '오늘의 이슈 종목 TOP 7' 아래에 '오늘의 소식 요약' 카드 추가 */}
                <div className="content-card today-summary-card">
                  <div className="card-header">
                    <div className="card-title">📊 오늘의 소식 요약</div>
                    <span className="count-badge num">총 {homeSentimentCounts.total}건</span>
                  </div>
                  <div className="today-summary-body">
                    <div className="summary-stat-row">
                      <span className="summary-stat-label">출처 구분</span>
                      <div className="summary-stat-values num">
                        <span>뉴스 <strong>{homeChannelCounts.news}</strong>건</span>
                        <span className="stat-dot">·</span>
                        <span>공시 <strong>{homeChannelCounts.disclosure}</strong>건</span>
                      </div>
                    </div>
                    <div className="summary-stat-row">
                      <span className="summary-stat-label">기사 내용</span>
                      <div className="summary-stat-values num">
                        <span className="sent-pos">긍정 <strong>{homeSentimentCounts.pos}</strong></span>
                        <span className="stat-dot">·</span>
                        <span className="sent-neg">부정 <strong>{homeSentimentCounts.neg}</strong></span>
                        <span className="stat-dot">·</span>
                        <span className="sent-neu">중립 <strong>{homeSentimentCounts.neu}</strong></span>
                        <span className="stat-dot">·</span>
                        <span className="sent-neu">{SENTIMENT_NONE_LABEL} <strong>{homeSentimentCounts.none}</strong></span>
                      </div>
                    </div>
                    <AiNote />
                  </div>
                </div>
              </div>
            )}
          </aside>
        </div>
      </div>
    );
  };

  const renderStockView = () => {
    if (stockViewMode === 'list') {
      return (
        <div className="wrapper">
          <div className="content-card">
            <div className="card-header">
              <div className="card-title">
                📊 전체 종목 탐색 & 이슈 시세 순위{' '}
                <span className="count-badge num">{filteredStockList.length}</span>
              </div>
              <div className="header-btn-group">
                {['ALL', 'KOSPI', 'KOSDAQ'].map((m) => (
                  <button
                    key={m}
                    type="button"
                    className={`more-link2 ${stockListMarket === m ? 'active' : ''}`}
                    onClick={() => setStockListMarket(m)}
                  >
                    {m === 'ALL' ? '전체 시장' : m}
                  </button>
                ))}
                {[
                  { key: 'issue', label: '이슈급증순' },
                  { key: 'up', label: '급상승순' },
                  { key: 'down', label: '급하락순' },
                  { key: 'name', label: '가나다순' },
                ].map((s) => (
                  <button
                    key={s.key}
                    type="button"
                    className={`more-link2 ${stockListSort === s.key ? 'active' : ''}`}
                    onClick={() => setStockListSort(s.key)}
                  >
                    {s.label}
                  </button>
                ))}
                <button
                  type="button"
                  className="quick-manage-btn"
                  onClick={() => setShowWatchModal(true)}
                  aria-label="관심종목 관리 열기"
                >
                  <span>⭐</span>
                  <span>+ 관심종목 관리</span>
                </button>
              </div>
            </div>

            <div className="watch-add-inline">
              <div className="watch-input-wrap">
                <input
                  type="text"
                  className="watch-inline-input"
                  placeholder="찾으실 종목명, 종목코드(6자리), 별칭 또는 테마 검색..."
                  aria-label="전체 종목 필터 검색"
                  value={stockListQuery}
                  onChange={(e) => setStockListQuery(e.target.value)}
                />
                {stockListQuery && (
                  <button
                    type="button"
                    className="clear-search-btn"
                    aria-label="종목 검색어 지우기"
                    onClick={() => setStockListQuery('')}
                  >
                    ✕
                  </button>
                )}
              </div>
            </div>

            <table className="stock-table">
              <thead>
                <tr>
                  <th>순위 · 종목명</th>
                  <th>시장 · 업종 · 핵심 테마</th>
                  <th className="num-col">현재가</th>
                  <th className="num-col">등락률</th>
                  <th className="num-col" title="같은 소식을 여러 곳이 쓰면 소식은 1건으로 셉니다">오늘 글 · 소식</th>
                  <th className="num-col">기사 내용</th>
                  <th className="num-col">관심</th>
                </tr>
              </thead>
              <tbody>
                {filteredStockList.map((st, idx) => {
                  const rankClass = idx < 3 ? `rank-${idx + 1}` : '';
                  return (
                    <tr
                      key={st.code}
                      className={st.code === selectedStockCode ? 'selected-row' : ''}
                      tabIndex={0}
                      aria-label={`${st.name} 종목 상세 대시보드로 이동`}
                      onClick={() => navigateToStockDetail(st.code, 'summary')}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          navigateToStockDetail(st.code, 'summary');
                        }
                      }}
                    >
                      <td>
                        <span className={`rank-badge num ${rankClass}`}>{idx + 1}</span>
                        <strong>{st.name}</strong>{' '}
                        <span className="stock-code num">{st.code}</span>
                      </td>
                      <td>
                        <span className="source-pill">{st.market}</span> {st.sector} ·{' '}
                        {st.themes.length > 0 && (
                          <span className="stock-meta">#{st.themes.slice(0, 2).join(' #')}</span>
                        )}
                      </td>
                      <td className="num-col num">
                        <QuotePrice price={st.price} />
                      </td>
                      <td className="num-col num">
                        <QuoteRate rate={st.changeRate} size="sm" />
                      </td>
                      <td className="num-col num">
                        <strong>글 {st.todayMatchedCount}건</strong>
                        {st.todayEventCount != null && (
                          <div className="stock-meta num">
                            소식 {st.todayEventCount}건
                            {st.todayDisclosureCount > 0 && (
                              <span title="오늘 공시 수 (순위는 뉴스 기사 수로만 매김)"> · 공시 {st.todayDisclosureCount}</span>
                            )}
                          </div>
                        )}
                      </td>
                      <td className="num-col">
                        {summariesByStock[st.code]?.sentimentCount > 0 ? (
                          <span className="trend-badge trend-up num">
                            긍정 {summariesByStock[st.code].sentimentRatio.positive}%
                          </span>
                        ) : (
                          <span className="num" title="종목을 누르면 오늘 기사 내용 비율을 볼 수 있어요">-</span>
                        )}
                      </td>
                      <td className="num-col">
                        <button
                          type="button"
                          className="star-btn"
                          aria-label={`${st.name} ${isInWatchlist(st.code) ? '관심종목 해제' : '관심종목 추가'}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleToggleWatchlist(st.code, st);
                          }}
                        >
                          {isInWatchlist(st.code) ? '★' : '☆'}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      );
    }

    const activeStockArticle =
      stockFeedArticles.find((a) => a.id === selectedArticleId) || stockFeedArticles[0] || null;
    // 상세는 연결 이유·근거 문장이 있는 상세 API 응답을 먼저 씀 (목록 응답에는 없음)
    const activeStockArticleDetail = activeStockArticle
      ? articleDetails[activeStockArticle.id] || activeStockArticle
      : null;

    const stockSentimentCounts = countSentiments(stockFeedArticles);

    let stockActiveSubCount = 0;
    if (articlePeriod !== 'ALL') stockActiveSubCount += 1;
    if (onlyMainRole) stockActiveSubCount += 1;

    return (
      <div className="wrapper">
        {renderQuickSwitch()}

        {/* [V7] C1: 헤더 2줄 압축 및 C3: 밑줄 스타일 탭 */}
        <section className="content-card stock-head-card">
          <div className="stock-header-tier1">
            <div className="stock-tier1-main">
              <button
                type="button"
                className="more-link2 back-to-list-btn"
                onClick={() => setStockViewMode('list')}
              >
                ← 종목 찾기
              </button>
              <h2 className="stock-head-name">{selectedStock.name}</h2>
              <span className="stock-code num">{selectedStock.code}</span>
              <span className="source-pill">{selectedStock.market}</span>
              <div className="stock-head-price-inline">
                <QuotePrice price={selectedStock.price} className="price-large" />
                <QuoteRate rate={selectedStock.changeRate} size="lg" />
              </div>
            </div>
            <div className="stock-tier1-actions">
              <button
                type="button"
                className={`more-link2 watch-toggle-btn ${isInWatchlist(selectedStock.code) ? 'active' : ''}`}
                onClick={() => handleToggleWatchlist(selectedStock.code, selectedStock)}
              >
                {isInWatchlist(selectedStock.code) ? '★ 관심종목 등록됨' : '☆ 관심종목 추가'}
              </button>
            </div>
          </div>

          <div className="stock-header-tier2">
            {selectedStock.sector && (
              <span className="stock-sector-pill">{selectedStock.sector}</span>
            )}
            {selectedStock.aliases?.length > 0 && (
              <span className="stock-meta">
                별칭: {selectedStock.aliases.slice(0, 3).join(', ')}
                {selectedStock.aliases.length > 3 && ` 외 ${selectedStock.aliases.length - 3}개`}
              </span>
            )}
            <div className="theme-tags compact">
              {selectedStock.themes.slice(0, 3).map((t) => (
                <span key={t} className="theme-tag">
                  #{t}
                </span>
              ))}
              {selectedStock.themes.length > 3 && (
                <span className="theme-tag-more num">외 {selectedStock.themes.length - 3}개</span>
              )}
            </div>
            <div className="stock-quick-stats num">
              <span>오늘 뉴스·공시 {todayCounts.news}건</span>
              {selectedStock.todayEventCount != null && (
                <>
                  <span className="stat-dot">·</span>
                  <span title="같은 소식을 여러 곳이 쓰면 1건으로 셉니다">소식 {selectedStock.todayEventCount}건</span>
                </>
              )}
              <span className="stat-dot">·</span>
              <span>최근 매칭 {selectedStock.lastMatchedAt}</span>
            </div>
          </div>

          <div className="stock-tabs underline-tabs" role="tablist" aria-label="종목 상세 분석 탭">
            {STOCK_TABS.map((t) => (
              <button
                key={t.key}
                type="button"
                role="tab"
                aria-selected={stockTab === t.key}
                className={`stock-tab-btn ${stockTab === t.key ? 'active' : ''}`}
                onClick={() => {
                  setStockTab(t.key);
                  setSelectedArticleId(null);
                }}
              >
                <span>{t.icon}</span>
                <span>{t.label}</span>
                {t.key === 'board' && (
                  <span className="count-badge num">{currentComments.length}</span>
                )}
              </button>
            ))}
          </div>
        </section>

        {/* [V7] C4: 요약 탭 구성 순서: AI 요약 → 뉴스 요약(최대 3줄 clamp, [더 보기/접기] 토글) → 주가 차트 → 언급량 추이 + 토론장 */}
        {stockTab === 'summary' && (
          <>
            <div className="content-card">
              <div className="card-header">
                <div className="card-title">
                  🤖 {selectedStock.name} 오늘의 AI 종합 요약 & 기사 내용 비율
                </div>
                <div className="header-btn-group">
                  <span className="stock-meta num">생성 시각 {currentSummary.updatedAt}</span>
                  <button
                    type="button"
                    className="more-link2"
                    onClick={handleRegenerateSummary}
                    disabled={regenerating}
                  >
                    {regenerating ? '⏳ 재생성 중...' : '🔄 요약 재생성'}
                  </button>
                </div>
              </div>

              <div className="ai-card">
                <p className="ai-card-headline">{currentSummary.headline}</p>
                <p className="ai-card-body">{currentSummary.summary}</p>
                {!loadedSummary?.newsSummary && todayTitleOnly.length > 0 && (
                  <div className="title-only-today">
                    <div className="title-only-today-head">
                      오늘 제목으로 확인한 소식 {todayTitleOnly.length}건
                      <span className="trend-badge trend-hold title-only" title={TITLE_ONLY_TIP}>
                        제목만 확인
                      </span>
                    </div>
                    <ul>
                      {todayTitleOnly.map((art) => (
                        <li key={art.id}>
                          <a href={art.url} target="_blank" rel="noopener noreferrer">
                            {art.title}
                          </a>
                          <span className="stock-meta num">
                            {' '}
                            {art.press} · {art.publishedAt}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                <SentimentBar ratio={currentSummary.sentimentRatio} />
                {currentSummary.sentimentByEvent && currentSummary.sentimentByEventCount > 0 && (
                  <div className="event-ratio-line num">
                    같은 소식을 1건으로 세면: 긍정 {currentSummary.sentimentByEvent.positive}% · 중립{' '}
                    {currentSummary.sentimentByEvent.neutral}% · 부정 {currentSummary.sentimentByEvent.negative}%
                    <span className="stock-meta"> (소식 {currentSummary.sentimentByEventCount}건)</span>
                  </div>
                )}
                <AiNote />
              </div>

              <div className="summary-compare-grid single">
                <div className="summary-compare-box">
                  <div className="summary-compare-head">
                    <span className="source-pill news">📰 당일 뉴스·공시 핵심 요약</span>
                    <button
                      type="button"
                      className="more-link"
                      onClick={() => setStockTab('news')}
                    >
                      뉴스·공시 모아보기 ({todayCounts.news}건) &gt;
                    </button>
                  </div>
                  <p className={expandedSummaryBox.news ? 'summary-text-expanded' : 'summary-text-clamped'}>
                    {currentSummary.newsSummary || '당일 뉴스 요약 준비 중입니다.'}
                  </p>
                  <button
                    type="button"
                    className="more-link summary-expand-btn"
                    onClick={() => setExpandedSummaryBox((prev) => ({ ...prev, news: !prev.news }))}
                  >
                    {expandedSummaryBox.news ? '접기 ▲' : '더 보기 ▼'}
                  </button>
                </div>

              </div>
            </div>

            <StockPriceChart
              stockCode={selectedStockCode}
              stockName={selectedStock?.name || selectedStockCode}
            />

            <div className="dashboard-grid">
              <div className="content-card">
                <div className="card-header">
                  <div className="card-title">📈 시간대별 언급량 추이 요약</div>
                  <div className="header-btn-group">
                    {TREND_PERIODS.map((p) => (
                      <button
                        key={p.key}
                        type="button"
                        className={`more-link2 ${trendPeriod === p.key ? 'active' : ''}`}
                        onClick={() => setTrendPeriod(p.key)}
                      >
                        {p.label}
                      </button>
                    ))}
                    <button
                      type="button"
                      className="more-link"
                      onClick={() => setStockTab('mention')}
                    >
                      언급량 상세 수치표 &gt;
                    </button>
                  </div>
                </div>
                <MentionTrendChart series={trendSeries} plotHeight={190} />
              </div>

              <div className="content-card">
                <div className="card-header">
                  <div className="card-title">
                    🗣️ 최근 실시간 종목 토론{' '}
                    <span className="count-badge num">{currentComments.length}</span>
                  </div>
                  <button
                    type="button"
                    className="more-link"
                    onClick={() => setStockTab('board')}
                  >
                    전체 보기 / 의견 작성 &gt;
                  </button>
                </div>

                {currentComments.length === 0 ? (
                  <div className="empty-text">아직 등록된 종목 의견이 없습니다.</div>
                ) : (
                  <ul className="comment-list">
                    {currentComments.slice(0, 3).map((c) => {
                      const cid = c.commentId ?? c.id;
                      const parsed = parseComment(c.content);
                      return (
                        <li key={cid} className="comment-item">
                          <div className="comment-meta">
                            {parsed.tagKey && COMMENT_TAGS[parsed.tagKey] && (
                              <span
                                className={`comment-tag ${COMMENT_TAGS[parsed.tagKey].className}`}
                              >
                                {COMMENT_TAGS[parsed.tagKey].label}
                              </span>
                            )}
                            <strong>{c.author}</strong>
                            <span className="num">{formatDateTime(c.createdAt)}</span>
                          </div>
                          <p className="comment-content">{parsed.text}</p>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            </div>
          </>
        )}

        {stockTab === 'news' && (
          <>
            <div className="split-layout">
              <div className="content-card" ref={stockFeedRef}>
                <div className="card-header">
                  <div className="card-title">
                    {`📰 ${selectedStock.name} 매칭 뉴스·공시 모아보기`}{' '}
                    <span className="count-badge num">{stockFeedArticles.length}</span>
                  </div>
                </div>

                {/* 통합 필터 툴바 */}
                <div className="unified-feed-toolbar">
                  <div className="feed-toolbar-left">
                    <div className="sentiment-filter-chips" role="group" aria-label="기사 내용 필터 칩">
                      {sentimentChips(stockSentimentCounts).map((chip) => {
                        const isActive = sentimentFilter === chip.key;
                        const isZero = chip.count === 0 && chip.key !== 'ALL';
                        return (
                          <button
                            key={chip.key}
                            type="button"
                            className={`more-link2 sentiment-chip-btn ${chip.cls} ${isActive ? 'active' : ''} ${isZero ? 'zero-count' : ''}`}
                            onClick={() => {
                              setSentimentFilter(chip.key);
                              setStockNewsPage(1);
                            }}
                            aria-pressed={isActive}
                          >
                            <span className="chip-dot-icon">●</span>
                            <span>{chip.label} {chip.count}</span>
                          </button>
                        );
                      })}
                    </div>

                    <div className="seg-group" role="group" aria-label="정렬">
                      <button
                        type="button"
                        className={`more-link2 seg-btn ${articleSort === 'latest' ? 'active' : ''}`}
                        onClick={() => setArticleSort('latest')}
                      >
                        최신순
                      </button>
                      <button
                        type="button"
                        className={`more-link2 seg-btn ${articleSort === 'main' ? 'active' : ''}`}
                        onClick={() => setArticleSort('main')}
                        title="이 종목이 주인공인 글을 먼저 보여 줍니다"
                      >
                        주인공 먼저
                      </button>
                    </div>
                  </div>

                  <div className="feed-toolbar-right">
                    <button
                      type="button"
                      className={`more-link2 filter-toggle-btn ${stockActiveSubCount > 0 ? 'active' : ''}`}
                      onClick={() => setIsFilterExpanded((prev) => !prev)}
                      aria-expanded={isFilterExpanded}
                      aria-label="상세 필터 접기/펼치기"
                    >
                      <span>⚙️ 상세 필터</span>
                      {stockActiveSubCount > 0 && (
                        <span className="filter-count-badge num">{stockActiveSubCount}</span>
                      )}
                      <span>{isFilterExpanded ? '▲' : '▼'}</span>
                    </button>
                  </div>
                </div>

                {isFilterExpanded && (
                  <div className="sub-filter-row">
                    <div className="sub-filter-group" role="group" aria-label="기간 필터">
                      <span className="sub-filter-label">기간</span>
                      {ARTICLE_PERIODS.map((ap) => (
                        <button
                          key={ap.key}
                          type="button"
                          className={`more-link2 filter-chip ${articlePeriod === ap.key ? 'active' : ''}`}
                          onClick={() => {
                            setArticlePeriod(ap.key);
                            setStockNewsPage(1);
                          }}
                        >
                          {ap.label}
                        </button>
                      ))}
                    </div>

                    <div className="sub-filter-group" role="group" aria-label="역할 필터">
                      <span className="sub-filter-label">역할</span>
                      <button
                        type="button"
                        className={`more-link2 filter-chip ${onlyMainRole ? 'active' : ''}`}
                        aria-pressed={onlyMainRole}
                        onClick={() => {
                          setOnlyMainRole((prev) => !prev);
                          setStockNewsPage(1);
                        }}
                      >
                        {selectedStock.name}이(가) 주인공인 글만
                      </button>
                    </div>

                    {stockActiveSubCount > 0 && (
                      <button
                        type="button"
                        className="more-link2 reset-btn"
                        onClick={() => {
                          setArticlePeriod('ALL');
                          setOnlyMainRole(false);
                          setStockNewsPage(1);
                        }}
                      >
                        초기화 ↺
                      </button>
                    )}
                  </div>
                )}

                <ArticleList
                  articles={stockFeedArticles.slice((stockNewsPage - 1) * 5, stockNewsPage * 5)}
                  selectedId={activeStockArticle?.id}
                  onSelect={setSelectedArticleId}
                  onSelectStock={(code) => navigateToStockDetail(code, stockTab)}
                  loading={!feedBooted}
                />
                <Pagination
                  currentPage={stockNewsPage}
                  totalPages={Math.max(1, Math.ceil(stockFeedArticles.length / 5))}
                  totalItems={stockFeedArticles.length}
                  onPageChange={handleStockNewsPageChange}
                />
              </div>

              <aside className="panel sticky-detail-panel" aria-label="종목 기사 상세 패널">
                <ArticleDetail
                  {...detailSharedProps}
                  article={activeStockArticleDetail}
                  onSelectStock={(code) => navigateToStockDetail(code, 'summary')}
                />
              </aside>
            </div>
          </>
        )}

        {stockTab === 'mention' && (
          <>
            <div className="content-card">
              <div className="card-header">
                <div className="card-title">
                  📈 {selectedStock.name} ({selectedStock.code}) 뉴스·공시 언급량 추이 차트
                </div>
                <div className="header-btn-group" role="group" aria-label="언급량 주기 선택">
                  {TREND_PERIODS.map((p) => (
                    <button
                      key={p.key}
                      type="button"
                      className={`more-link2 ${trendPeriod === p.key ? 'active' : ''}`}
                      onClick={() => setTrendPeriod(p.key)}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>
              {mentionLoading ? (
                <div className="empty-text">언급량 데이터를 불러오는 중...</div>
              ) : mentionError ? (
                <div className="empty-text">언급량 데이터를 불러오지 못했습니다.</div>
              ) : (
                <MentionTrendChart series={trendSeries} plotHeight={250} />
              )}
            </div>
          </>
        )}

        {stockTab === 'board' && <StockComments key={selectedStockCode} {...commentsProps} />}
      </div>
    );
  };

  // [V7] B1, B2: 2컬럼 레이아웃 (좌측 280px sidebar-watchlist-section 패널 + 우측 피드), 비로그인/빈 상태 정리
  const renderWatchlistView = () => {
    const openLoginModal = () => {
      setAuthMode('login');
      setAuthError('');
      setShowAuthModal(true);
    };

    if (!user) {
      return (
        <div className="wrapper watchlist-2col-layout">
          <aside
            className="watchlist-left-panel sidebar-watchlist-section"
            aria-label="관심 종목 관리 패널"
          >
            <div className="content-card watchlist-guest-side-card">
              <div className="card-header">
                <div className="card-title">
                  ⭐ 관심 종목 <span className="count-badge num">0</span>
                </div>
              </div>
              <div className="empty-state" style={{ padding: '24px 12px' }}>
                <div className="empty-icon">🔒</div>
                <div className="empty-title" style={{ fontSize: '14px' }}>
                  로그인이 필요합니다
                </div>
                <div className="empty-sub" style={{ fontSize: '12px' }}>
                  로그인 후 관심 종목을 검색·추가하고 정렬해 관리할 수 있습니다.
                </div>
                <button
                  type="button"
                  className="btn-primary"
                  style={{ marginTop: '14px', width: '100%' }}
                  onClick={openLoginModal}
                >
                  로그인하기
                </button>
              </div>
            </div>
          </aside>

          <main className="watchlist-right-feed">
            <div className="content-card watchlist-guest-card">
              <div className="empty-state">
                <div className="empty-icon">⭐</div>
                <div className="empty-title">로그인하고 관심 종목을 등록하세요</div>
                <div className="empty-sub">
                  관심 종목을 등록하면 맞춤형 뉴스·공시 모아보기와 우측 상세 분석을 한눈에 확인할 수 있습니다.
                </div>
                <button
                  type="button"
                  className="btn-primary"
                  style={{ marginTop: '16px' }}
                  onClick={openLoginModal}
                >
                  로그인하기
                </button>
              </div>
            </div>
          </main>
        </div>
      );
    }

    const watchlistSidePageSize = 5;
    const watchlistSideTotalPages = Math.max(
      1,
      Math.ceil(sortedWatchlistStocks.length / watchlistSidePageSize)
    );
    const currentWatchlistSidePage = Math.min(watchlistPage, watchlistSideTotalPages);
    const pagedWatchlistStocks = sortedWatchlistStocks.slice(
      (currentWatchlistSidePage - 1) * watchlistSidePageSize,
      currentWatchlistSidePage * watchlistSidePageSize
    );

    const selectedWatchStock = selectedWatchStockCode
      ? watchlistStocks.find((st) => st.code === selectedWatchStockCode) ||
      stockByCode(selectedWatchStockCode)
      : null;

    const watchSentimentCounts = countSentiments(watchlistFeedArticles);

    let watchActiveSubCount = 0;
    if (articlePeriod !== 'ALL') watchActiveSubCount += 1;
    if (onlyMainRole) watchActiveSubCount += 1;

    // 뉴스 클릭 시 우측 패널(Split Layout)에 상세 표시
    const activeWatchArticleBase =
      watchlistFeedArticles.find((a) => a.id === selectedArticleId) || null;
    const activeWatchArticle = activeWatchArticleBase
      ? articleDetails[activeWatchArticleBase.id] || activeWatchArticleBase
      : null;

    return (
      <div className="wrapper watchlist-2col-layout">
        {/* 1. 좌측 패널 (고정 너비 280px, sidebar-watchlist-section): 검색·추가 입력창, 정렬 버튼, 5건 페이지네이션 리스트 */}
        <aside
          className="watchlist-left-panel sidebar-watchlist-section"
          aria-label="관심 종목 관리 패널"
        >
          <div className="content-card sidebar-watchlist-card">
            <div className="card-header">
              <div className="card-title">
                ⭐ 관심 종목 <span className="count-badge num">{watchlistStocks.length}</span>
              </div>
              <button
                type="button"
                className="more-link2"
                onClick={() => setShowWatchModal(true)}
                title="전체 종목 검색 후 추가"
              >
                + 검색
              </button>
            </div>

            <form className="watch-add-inline" onSubmit={handleWatchAddSubmit}>
              <div className="watch-input-wrap">
                <input
                  type="text"
                  className="watch-inline-input"
                  placeholder="종목명·코드 빠른 추가"
                  aria-label="관심종목 빠른 추가 입력"
                  value={watchAddQuery}
                  onChange={(e) => setWatchAddQuery(e.target.value)}
                />
                {watchAddQuery && (
                  <button
                    type="button"
                    className="clear-search-btn"
                    aria-label="검색어 지우기"
                    onClick={() => setWatchAddQuery('')}
                  >
                    ✕
                  </button>
                )}
              </div>
              <button type="submit" className="more-link2 active">
                추가
              </button>
            </form>

            {watchAddQuery.trim() && (
              <div
                className="watch-modal-list"
                style={{
                  marginBottom: '12px',
                  maxHeight: '220px',
                  overflowY: 'auto',
                  overflowX: 'hidden',
                }}
              >
                {watchAddCandidates.length === 0 ? (
                  <div className="auto-empty">일치하는 종목이 없습니다.</div>
                ) : (
                  watchAddCandidates.map((s) => {
                    const added = isInWatchlist(s.code);
                    return (
                      <div key={s.code} className="watch-modal-row">
                        <div
                          role="button"
                          tabIndex={0}
                          style={{ cursor: 'pointer' }}
                          onClick={() => navigateToStockDetail(s.code, 'summary')}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault();
                              navigateToStockDetail(s.code, 'summary');
                            }
                          }}
                        >
                          <strong>{s.name}</strong>{' '}
                          <span className="stock-code num">
                            ({s.code}{s.market ? ` · ${s.market}` : ''})
                          </span>
                          <div className="stock-meta">
                            {s.sector || '기타'} · 오늘 매칭 {s.todayMatchedCount || 0}건
                          </div>
                        </div>
                        <button
                          type="button"
                          className={`more-link2 ${added ? '' : 'active'}`}
                          onClick={() => handleToggleWatchlist(s.code, s)}
                        >
                          {added ? '★ 해제' : '+ 추가'}
                        </button>
                      </div>
                    );
                  })
                )}
              </div>
            )}

            {/* 관심 종목 정렬 칩 3종 (뉴스순 / 최신순 / 가나다순) */}
            <div className="watchlist-sort-bar" role="group" aria-label="관심 종목 정렬 기준">
              {[
                { key: 'news', label: '뉴스순' },
                { key: 'latest', label: '최신순' },
                { key: 'name', label: '가나다순' },
              ].map((opt) => (
                <button
                  key={opt.key}
                  type="button"
                  className={`more-link2 watchlist-sort-chip ${watchlistSort === opt.key ? 'active' : ''}`}
                  aria-pressed={watchlistSort === opt.key}
                  onClick={() => {
                    setWatchlistSort(opt.key);
                    setWatchlistPage(1);
                  }}
                >
                  {opt.label}
                </button>
              ))}
            </div>

            {sortedWatchlistStocks.length === 0 ? (
              <div className="empty-state" style={{ padding: '24px 12px' }}>
                <div className="empty-icon">📌</div>
                <div className="empty-title" style={{ fontSize: '14px' }}>종목을 추가하세요</div>
                <div className="empty-sub" style={{ fontSize: '12px' }}>
                  위 입력창에서 종목명 또는 코드를 입력해 추가하세요.
                </div>
              </div>
            ) : (
              <>
                <div className="watchlist-side-items">
                  {pagedWatchlistStocks.map((st) => {
                    const isSelected = selectedWatchStockCode === st.code;
                    return (
                      <div
                        key={st.code}
                        className={`watchlist-side-item ${isSelected ? 'selected' : ''}`}
                        role="button"
                        tabIndex={0}
                        aria-pressed={isSelected}
                        onClick={() => {
                          setSelectedWatchStockCode((prev) =>
                            prev === st.code ? null : st.code
                          );
                          setSelectedArticleId(null);
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            setSelectedWatchStockCode((prev) =>
                              prev === st.code ? null : st.code
                            );
                            setSelectedArticleId(null);
                          }
                        }}
                      >
                        <div className="side-item-main">
                          <div className="side-item-title-group">
                            <span className="side-item-name">{st.stockName || st.name}</span>
                            <span className="side-item-code num">{st.code}</span>
                          </div>
                          <div className="side-item-actions">
                            <button
                              type="button"
                              className="side-item-detail-btn"
                              title={`${st.stockName || st.name} 종목 상세 화면으로 이동`}
                              onClick={(e) => {
                                e.stopPropagation();
                                navigateToStockDetail(st.code, 'summary');
                              }}
                            >
                              상세 →
                            </button>
                            <button
                              type="button"
                              className="remove-btn"
                              aria-label={`${st.stockName || st.name} 관심종목에서 삭제`}
                              onClick={(e) => {
                                e.stopPropagation();
                                handleRemoveWatchlist(st.code);
                              }}
                            >
                              ✕
                            </button>
                          </div>
                        </div>
                        <div className="side-item-sub">
                          <div className="side-item-quote">
                            <QuotePrice price={st.price} className="side-item-price" />
                            <QuoteRate rate={st.changeRate} size="sm" />
                          </div>
                          <span
                            className="side-item-cnt num"
                            title={`관련 뉴스 ${st.newsCount ?? 0}건 · 공시 ${st.disclosureCount ?? 0}건`}
                          >
                            뉴스 {st.newsCount ?? 0}건 · 공시 {st.disclosureCount ?? 0}건
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* 좌측 리스트 하단 5건 단위 페이지네이션 */}
                <div
                  className="watchlist-side-pagination"
                  role="navigation"
                  aria-label="관심 종목 페이지 이동"
                >
                  <button
                    type="button"
                    className="more-link2 page-nav-btn"
                    disabled={currentWatchlistSidePage <= 1}
                    onClick={() => setWatchlistPage((p) => Math.max(1, p - 1))}
                  >
                    이전
                  </button>
                  <span className="watchlist-page-indicator num">
                    {currentWatchlistSidePage} / {watchlistSideTotalPages}
                  </span>
                  <button
                    type="button"
                    className="more-link2 page-nav-btn"
                    disabled={currentWatchlistSidePage >= watchlistSideTotalPages}
                    onClick={() =>
                      setWatchlistPage((p) => Math.min(watchlistSideTotalPages, p + 1))
                    }
                  >
                    다음
                  </button>
                </div>
              </>
            )}
          </div>
        </aside>

        {/* 2. 우측 패널 (나머지 영역): 선택된 관심 종목의 뉴스 목록 및 우측 상세 분석 패널 */}
        <main className="watchlist-right-feed">
          <div className="split-layout">
            <div
              className="content-card watchlist-feed-card"
              ref={watchlistFeedRef}
              aria-label="관심 종목 뉴스 및 공시 피드"
            >
              <div className="card-header">
                <div className="card-title">
                  📰{' '}
                  {selectedWatchStock
                    ? `${selectedWatchStock.name} 뉴스·공시`
                    : '관심 종목 뉴스·공시 모아보기'}{' '}
                  <span className="count-badge num">{watchlistFeedArticles.length}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                  {selectedWatchStock && (
                    <button
                      type="button"
                      className="more-link2 active"
                      onClick={() => {
                        setSelectedWatchStockCode(null);
                        setSelectedArticleId(null);
                      }}
                    >
                      전체 관심 종목 보기 ✕
                    </button>
                  )}
                  <span className="card-caption">
                    글 클릭 시 우측 상세 분석 · #종목칩 클릭 시 종목 상세 화면 이동
                  </span>
                </div>
              </div>

              {/* 통합 필터 바 */}
              <div className="unified-feed-toolbar">
                <div className="feed-toolbar-left">
                  <div className="seg-group" role="group" aria-label="출처 선택">
                    {CHANNEL_FILTERS.map((ch) => (
                      <button
                        key={ch.key}
                        type="button"
                        className={`more-link2 seg-btn ${channelFilter === ch.key ? 'active' : ''}`}
                        onClick={() => {
                          setChannelFilter(ch.key);
                          setWatchlistArticlesPage(1);
                        }}
                      >
                        {ch.label}
                      </button>
                    ))}
                  </div>

                  <div className="sentiment-filter-chips" role="group" aria-label="기사 내용 필터 칩">
                    {sentimentChips(watchSentimentCounts).map((chip) => {
                      const isActive = sentimentFilter === chip.key;
                      const isZero = chip.count === 0 && chip.key !== 'ALL';
                      return (
                        <button
                          key={chip.key}
                          type="button"
                          className={`more-link2 sentiment-chip-btn ${chip.cls} ${isActive ? 'active' : ''} ${isZero ? 'zero-count' : ''}`}
                          onClick={() => {
                            setSentimentFilter(chip.key);
                            setWatchlistArticlesPage(1);
                          }}
                          aria-pressed={isActive}
                        >
                          <span className="chip-dot-icon">●</span>
                          <span>{chip.label} {chip.count}</span>
                        </button>
                      );
                    })}
                  </div>

                  <div className="seg-group" role="group" aria-label="정렬">
                    <button
                      type="button"
                      className={`more-link2 seg-btn ${articleSort === 'latest' ? 'active' : ''}`}
                      onClick={() => setArticleSort('latest')}
                    >
                      최신순
                    </button>
                    <button
                      type="button"
                      className={`more-link2 seg-btn ${articleSort === 'main' ? 'active' : ''}`}
                      onClick={() => setArticleSort('main')}
                      title="관심 종목이 주인공인 글을 먼저 보여 줍니다"
                    >
                      주인공 먼저
                    </button>
                  </div>
                </div>

                <div className="feed-toolbar-right">
                  <button
                    type="button"
                    className={`more-link2 filter-toggle-btn ${watchActiveSubCount > 0 ? 'active' : ''}`}
                    onClick={() => setIsFilterExpanded((prev) => !prev)}
                    aria-expanded={isFilterExpanded}
                    aria-label="상세 필터 접기/펼치기"
                  >
                    <span>⚙️ 상세 필터</span>
                    {watchActiveSubCount > 0 && (
                      <span className="filter-count-badge num">{watchActiveSubCount}</span>
                    )}
                    <span>{isFilterExpanded ? '▲' : '▼'}</span>
                  </button>
                </div>
              </div>

              {isFilterExpanded && (
                <div className="sub-filter-row">
                  <div className="sub-filter-group" role="group" aria-label="기간 필터">
                    <span className="sub-filter-label">기간</span>
                    {ARTICLE_PERIODS.map((ap) => (
                      <button
                        key={ap.key}
                        type="button"
                        className={`more-link2 filter-chip ${articlePeriod === ap.key ? 'active' : ''}`}
                        onClick={() => {
                          setArticlePeriod(ap.key);
                          setWatchlistArticlesPage(1);
                        }}
                      >
                        {ap.label}
                      </button>
                    ))}
                  </div>

                  <div className="sub-filter-group" role="group" aria-label="역할 필터">
                    <span className="sub-filter-label">역할</span>
                    <button
                      type="button"
                      className={`more-link2 filter-chip ${onlyMainRole ? 'active' : ''}`}
                      aria-pressed={onlyMainRole}
                      onClick={() => {
                        setOnlyMainRole((prev) => !prev);
                        setWatchlistArticlesPage(1);
                      }}
                    >
                      관심 종목이 주인공인 글만
                    </button>
                  </div>

                  {watchActiveSubCount > 0 && (
                    <button
                      type="button"
                      className="more-link2 reset-btn"
                      onClick={() => {
                        setArticlePeriod('ALL');
                        setOnlyMainRole(false);
                        setWatchlistArticlesPage(1);
                      }}
                    >
                      초기화 ↺
                    </button>
                  )}
                </div>
              )}

              <ArticleList
                articles={watchlistFeedArticles.slice(
                  (watchlistArticlesPage - 1) * 5,
                  watchlistArticlesPage * 5
                )}
                selectedId={activeWatchArticle?.id}
                onSelect={(artId) =>
                  setSelectedArticleId((prev) => (prev === artId ? null : artId))
                }
                onSelectStock={(code) => navigateToStockDetail(code, 'summary')}
                loading={!feedBooted}
              />
              <Pagination
                currentPage={watchlistArticlesPage}
                totalPages={Math.max(1, Math.ceil(watchlistFeedArticles.length / 5))}
                totalItems={watchlistFeedArticles.length}
                onPageChange={handleWatchlistPageChange}
              />
            </div>

            <aside className="panel sticky-detail-panel" aria-label="관심 종목 기사 상세 패널">
              <ArticleDetail
                {...detailSharedProps}
                article={activeWatchArticle}
                onSelectStock={(code) => navigateToStockDetail(code, 'summary')}
                onSelectArticle={(artId) => setSelectedArticleId(artId)}
                onClose={activeWatchArticle ? () => setSelectedArticleId(null) : undefined}
                closeLabel="✕ 상세 닫기"
              />
            </aside>
          </div>
        </main>
      </div>
    );
  };

  return (
    <div className={`app-shell ${isDarkMode ? 'dark-mode' : ''}`}>
      {/* V4 다크모드 / 라이트모드 통합 지원 */}
      <nav
        className={`left-nav-menu ${navCollapsed ? 'collapsed' : 'expanded'}`}
        aria-label="메인 장소 네비게이션"
      >
        <div className="nav-top-row">
          <button
            type="button"
            className="nav-brand-btn"
            title="뉴스×종목 매칭 대시보드 홈으로 이동"
            aria-label="뉴스×종목 매칭 대시보드 홈으로 이동"
            onClick={() => handleSwitchNav('home')}
          >
            <span className="nav-logo">N×S</span>
            {!navCollapsed && <span className="nav-brand-text">StockNews</span>}
          </button>
          <button
            type="button"
            className="nav-toggle-btn"
            onClick={handleToggleNavCollapse}
            aria-label={navCollapsed ? '사이드바 펼치기' : '사이드바 접기'}
            title={navCollapsed ? '사이드바 펼치기' : '사이드바 접기'}
          >
            ☰
          </button>
        </div>

        {NAV_ITEMS.map((item) => (
          <button
            key={item.key}
            type="button"
            className={`nav-item-btn ${activeNav === item.key ? 'active' : ''}`}
            aria-label={item.title}
            aria-current={activeNav === item.key ? 'page' : undefined}
            onClick={() => handleSwitchNav(item.key)}
          >
            <span className="nav-icon" aria-hidden="true">
              {item.icon}
            </span>
            {!navCollapsed && <span>{item.label}</span>}
          </button>
        ))}

        {/* [V7] D2: 사이드바 하단 테마 토글 버튼 및 최근 갱신 시각 */}
        <div className="nav-bottom-actions">
          <button
            type="button"
            className={`theme-toggle-btn ${isDarkMode ? 'dark' : 'light'}`}
            onClick={toggleTheme}
            title={isDarkMode ? '☀️ 라이트 모드로 전환' : '🌙 다크 모드로 전환'}
            aria-label={isDarkMode ? '☀️ 라이트 모드로 전환' : '🌙 다크 모드로 전환'}
          >
            <span className="theme-toggle-icon">{isDarkMode ? '☀️' : '🌙'}</span>
            {!navCollapsed && (
              <span className="theme-toggle-text">
                {isDarkMode ? '라이트 모드' : '다크 모드'}
              </span>
            )}
          </button>
          {!navCollapsed && (
            <div className="nav-update-time num" title="최근 시세·뉴스 동기화 시각">
              갱신 {sysStatus.lastUpdated.quote}
            </div>
          )}
        </div>
      </nav>

      <div className="main-area">
        <header className="top-header">
          <div className="header-content">
            {/* [V7] D1: 헤더 로고 옆 설명 배지 제거 */}
            <div
              className="logo"
              onClick={() => handleSwitchNav('home')}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') handleSwitchNav('home');
              }}
            >
              StockNews AI
            </div>

            {/* [V7] D1: 검색창 폭 충분히 확보 */}
            <div className="header-search-compact">
              <input
                type="text"
                className="search-input compact"
                placeholder="종목명·코드·별칭 또는 뉴스 키워드 통합 검색..."
                aria-label="상단 컴팩트 통합 검색"
                value={searchQuery}
                onFocus={() => setShowAutocomplete(true)}
                onBlur={() => setShowAutocomplete(false)}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setShowAutocomplete(true);
                }}
              />
              {searchQuery && (
                <button
                  type="button"
                  className="clear-search-btn"
                  aria-label="검색어 지우기"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => setSearchQuery('')}
                >
                  ✕
                </button>
              )}
              {renderSearchAutocomplete()}
            </div>

            <div className="user-actions">
              {/* [V7] D1: AI 실시간 매칭 상태와 최근 갱신 시각을 하나의 배지로 통합 */}
              <button
                type="button"
                className="live-sync-badge"
                title="AI 실시간 매칭 동기화 중 · 클릭 시 새로고침"
                aria-label="AI 실시간 매칭 동기화 상태 및 새로고침"
                onClick={handleRefreshData}
              >
                <span className="live-dot" aria-hidden="true" />
                <span className="live-sync-text">AI 실시간 매칭</span>
                <span className="live-sync-sep">·</span>
                <span className="live-sync-time num">{sysStatus.lastUpdated.quote}</span>
                <span className="live-sync-icon" aria-hidden="true">🔄</span>
              </button>

              {user ? (
                <>
                  <span className="user-name">👤 {user.username}님</span>
                  <button type="button" className="btn-outline" onClick={handleLogout}>
                    로그아웃
                  </button>
                </>
              ) : (
                <>
                  <button
                    type="button"
                    className="btn-outline"
                    onClick={() => {
                      setAuthMode('login');
                      setAuthError('');
                      setShowAuthModal(true);
                    }}
                  >
                    로그인
                  </button>
                  <button
                    type="button"
                    className="btn-primary"
                    onClick={() => {
                      setAuthMode('signup');
                      setAuthError('');
                      setShowAuthModal(true);
                    }}
                  >
                    회원가입
                  </button>
                </>
              )}
            </div>
          </div>
        </header>

        <main className="main-content" ref={mainRef}>
          {activeNav === 'home' && renderHomeView()}
          {activeNav === 'stock' && renderStockView()}
          {activeNav === 'watchlist' && renderWatchlistView()}

          {/* 모든 화면 아래 안내 (멘토 피드백 11/09: 판단은 투자자, 화면은 보수적으로 정보만) */}
          <footer className="app-disclaimer-footer" role="contentinfo">
            투자 권유가 아니며 최종 판단과 책임은 투자자에게 있습니다. 요약·판단은 AI가 만들어 빠지거나 틀릴 수
            있으니 원문을 확인해 주세요.
          </footer>
        </main>
      </div>

      {toast && (
        <div key={toast.id} className="toast-popup" role="status" aria-live="polite">
          {toast.text}
        </div>
      )}

      {showWatchModal && (
        <div className="modal-backdrop" onClick={() => setShowWatchModal(false)}>
          <div
            className="modal-card modal-wide"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="watch-modal-title"
          >
            <div className="card-header">
              <h3 id="watch-modal-title" className="card-title">
                ⭐ 나의 관심 종목 관리 ({watchlistStocks.length})
              </h3>
              <button
                type="button"
                className="remove-btn"
                aria-label="관심종목 관리 모달 닫기"
                onClick={() => setShowWatchModal(false)}
              >
                ✕
              </button>
            </div>

            <form className="watch-add-inline" onSubmit={handleWatchAddSubmit}>
              <input
                type="text"
                className="watch-inline-input"
                placeholder="종목명, 종목코드(6자리), 별칭 검색..."
                aria-label="모달 내 관심종목 검색"
                value={watchAddQuery}
                onChange={(e) => setWatchAddQuery(e.target.value)}
              />
              <button type="submit" className="btn-primary">
                + 관심 추가
              </button>
            </form>

            <div className="watch-modal-list">
              {watchAddCandidates.map((s) => {
                const added = isInWatchlist(s.code);
                return (
                  <div key={s.code} className="watch-modal-row">
                    <div>
                      <strong>{s.name}</strong>{' '}
                      <span className="stock-code num">
                        ({s.code} · {s.market})
                      </span>
                      <div className="stock-meta">
                        {s.sector} · 오늘 매칭 {s.todayMatchedCount}건
                      </div>
                    </div>
                    <button
                      type="button"
                      className={`more-link2 ${added ? '' : 'active'}`}
                      onClick={() => handleToggleWatchlist(s.code, s)}
                    >
                      {added ? '★ 등록됨 (해제)' : '+ 관심종목 추가'}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {showLogoutModal && (
        <div className="modal-backdrop" onClick={() => setShowLogoutModal(false)}>
          <div
            className="modal-card"
            style={{ maxWidth: '360px' }}
            onClick={(e) => e.stopPropagation()}
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="logout-modal-title"
            aria-describedby="logout-modal-desc"
          >
            <div className="card-header">
              <h3 id="logout-modal-title" className="card-title">
                🚪 로그아웃 확인
              </h3>
              <button
                type="button"
                className="remove-btn"
                aria-label="로그아웃 확인 모달 닫기"
                onClick={() => setShowLogoutModal(false)}
              >
                ✕
              </button>
            </div>
            <p
              id="logout-modal-desc"
              className="card-caption"
              style={{ fontSize: '14px', color: 'var(--text-main)', margin: '6px 0 14px' }}
            >
              정말 로그아웃 하시겠습니까?
            </p>
            <div className="comment-form-footer" style={{ justifyContent: 'flex-end', gap: '8px' }}>
              <button
                type="button"
                className="btn-outline"
                onClick={() => setShowLogoutModal(false)}
              >
                취소
              </button>
              <button
                type="button"
                className="btn-primary"
                onClick={confirmLogout}
              >
                로그아웃
              </button>
            </div>
          </div>
        </div>
      )}

      {showAuthModal && (
        <div className="modal-backdrop" onClick={() => setShowAuthModal(false)}>
          <div
            className="modal-card"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="auth-modal-title"
          >
            <div className="card-header">
              <h3 id="auth-modal-title" className="card-title">
                {authMode === 'login'
                  ? '🔐 로그인'
                  : authMode === 'signup'
                    ? '✨ 회원가입'
                    : authMode === 'findId'
                      ? '🔍 아이디 찾기'
                      : '🔑 비밀번호 재설정'}
              </h3>
              <button
                type="button"
                className="remove-btn"
                aria-label="인증 모달 닫기"
                onClick={() => setShowAuthModal(false)}
              >
                ✕
              </button>
            </div>

            {(authMode === 'login' || authMode === 'signup') && (
              <div className="segmented modal-tabs" role="tablist">
                <button
                  type="button"
                  role="tab"
                  aria-selected={authMode === 'login'}
                  className={authMode === 'login' ? 'active' : ''}
                  onClick={() => {
                    setAuthMode('login');
                    setAuthError('');
                  }}
                >
                  로그인
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={authMode === 'signup'}
                  className={authMode === 'signup' ? 'active' : ''}
                  onClick={() => {
                    setAuthMode('signup');
                    setAuthError('');
                  }}
                >
                  회원가입
                </button>
              </div>
            )}

            <p className="card-caption">
              {authMode === 'login' || authMode === 'signup'
                ? '대시보드 조회는 로그인 없이 가능하며, 관심종목 저장 및 종목토론 작성·공감 시 로그인이 필요합니다.'
                : authMode === 'findId'
                  ? '가입 시 등록한 이메일 주소를 입력하시면 아이디를 안내해 드립니다.'
                  : '가입하신 아이디와 등록된 이메일 주소를 입력하시면 비밀번호 재설정 링크를 발송해 드립니다.'}
            </p>

            {(authMode === 'login' || authMode === 'signup') && (
              <div className="auth-format-guide" aria-label="아이디 및 비밀번호 입력 형식 안내">
                <div className="auth-format-item">
                  <span className="auth-format-label">아이디 형식</span>
                  <span className="auth-format-desc">영문 소문자(a~z)·숫자(0~9) 4~20자 (예: tester01)</span>
                </div>
                <div className="auth-format-item">
                  <span className="auth-format-label">비밀번호 형식</span>
                  <span className="auth-format-desc">8~64자 입력 (영문·숫자·특수문자 사용 가능)</span>
                </div>
              </div>
            )}

            {authError && (
              <div className="sns-warning-inline" role="alert">
                {authError}
              </div>
            )}

            {(authMode === 'login' || authMode === 'signup') && (
              <form className="comment-form" onSubmit={handleAuthSubmit}>
                <div className="auth-field-group">
                  <input
                    type="text"
                    className="watch-inline-input"
                    placeholder="아이디 (영문 소문자·숫자 4~20자, 예: tester01)"
                    aria-label="아이디"
                    value={authForm.username}
                    onChange={(e) => setAuthForm({ ...authForm, username: e.target.value })}
                    required
                  />
                  {authMode === 'signup' && (
                    <span className="auth-field-hint">
                      * 영문 소문자(a-z)와 숫자(0-9)만 사용하여 4~20자로 입력해 주세요.
                    </span>
                  )}
                </div>
                <div className="auth-field-group">
                  <input
                    type="password"
                    className="watch-inline-input"
                    placeholder="비밀번호 (8~64자)"
                    aria-label="비밀번호"
                    value={authForm.password}
                    onChange={(e) => setAuthForm({ ...authForm, password: e.target.value })}
                    required
                  />
                  {authMode === 'signup' && (
                    <span className="auth-field-hint">
                      * 최소 8자 이상 64자 이하로 입력해 주세요.
                    </span>
                  )}
                </div>
                {authMode === 'signup' && (
                  <div className="auth-field-group">
                    <input
                      type="password"
                      className="watch-inline-input"
                      placeholder="비밀번호 확인 (동일하게 재입력)"
                      aria-label="비밀번호 확인"
                      value={authForm.passwordConfirm}
                      onChange={(e) =>
                        setAuthForm({ ...authForm, passwordConfirm: e.target.value })
                      }
                      required
                    />
                  </div>
                )}
                <div className="comment-form-footer">
                  <button
                    type="button"
                    className="btn-outline"
                    onClick={() => setShowAuthModal(false)}
                  >
                    취소
                  </button>
                  <button type="submit" className="btn-primary">
                    {authMode === 'login' ? '로그인' : '가입 완료 및 로그인'}
                  </button>
                </div>

                {authMode === 'login' && (
                  <div className="auth-find-links">
                    <button
                      type="button"
                      className="auth-link-btn"
                      onClick={() => {
                        setAuthMode('findId');
                        setAuthError('');
                        setFindIdEmail('');
                      }}
                    >
                      아이디 찾기
                    </button>
                    <span className="auth-link-divider">·</span>
                    <button
                      type="button"
                      className="auth-link-btn"
                      onClick={() => {
                        setAuthMode('findPw');
                        setAuthError('');
                        setFindPwUsername('');
                        setFindPwEmail('');
                      }}
                    >
                      비밀번호 찾기
                    </button>
                  </div>
                )}
              </form>
            )}

            {authMode === 'findId' && (
              <form className="comment-form" onSubmit={handleFindIdSubmit}>
                <input
                  type="email"
                  className="watch-inline-input"
                  placeholder="가입 시 등록한 이메일 주소 (예: user@example.com)"
                  aria-label="가입 이메일 주소"
                  value={findIdEmail}
                  onChange={(e) => {
                    setFindIdEmail(e.target.value);
                    if (authError) setAuthError('');
                  }}
                />
                <div className="comment-form-footer">
                  <button
                    type="button"
                    className="btn-outline"
                    onClick={() => {
                      setAuthMode('login');
                      setAuthError('');
                    }}
                  >
                    ← 로그인으로
                  </button>
                  <button type="submit" className="btn-primary">
                    아이디 찾기
                  </button>
                </div>
              </form>
            )}

            {authMode === 'findPw' && (
              <form className="comment-form" onSubmit={handleFindPwSubmit}>
                <input
                  type="text"
                  className="watch-inline-input"
                  placeholder="아이디 (예: tester01)"
                  aria-label="아이디"
                  value={findPwUsername}
                  onChange={(e) => {
                    setFindPwUsername(e.target.value);
                    if (authError) setAuthError('');
                  }}
                />
                <input
                  type="email"
                  className="watch-inline-input"
                  placeholder="가입 시 등록한 이메일 주소 (예: user@example.com)"
                  aria-label="가입 이메일 주소"
                  value={findPwEmail}
                  onChange={(e) => {
                    setFindPwEmail(e.target.value);
                    if (authError) setAuthError('');
                  }}
                />
                <div className="comment-form-footer">
                  <button
                    type="button"
                    className="btn-outline"
                    onClick={() => {
                      setAuthMode('login');
                      setAuthError('');
                    }}
                  >
                    ← 로그인으로
                  </button>
                  <button type="submit" className="btn-primary">
                    재설정 링크 보내기
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
// src/pages/DashboardPage.jsx
import { useState, useMemo, useEffect, useRef } from 'react';
import {
  INITIAL_SYSTEM_STATUS,
  INITIAL_WATCHLIST_CODES,
  STOCKS_DATA,
  ARTICLES_DATA,
  STOCK_SUMMARIES_DATA,
  MENTION_TRENDS_DATA,
  INITIAL_STOCK_COMMENTS,
  normalizeStocks,
  normalizeArticles,
  normalizeSummaries,
  normalizeMentionTrends,
  normalizeComments,
} from '../mocks/mockData';
import { stockApi, quoteApi, articleApi } from '../api';
import { toUiStock, toUiArticle } from '../api/adapters';
import '../styles/dashboard.css';

// 1계층: 왼쪽 사이드바 네비게이션 메뉴 (장소 이동 전용)
const NAV_ITEMS = [
  { key: 'home', icon: '🏠', label: '홈', title: '시장 종합 & 실시간 뉴스·SNS 매칭' },
  { key: 'stock', icon: '📊', label: '종목', title: '종목 탐색 & 개별 종목 대시보드' },
  { key: 'watchlist', icon: '⭐', label: '관심 종목', title: '내 관심 종목 & 뉴스·SNS 모아보기' },
];

// 2계층: 개별 종목 상세 내부 가로 탭 (.stock-tabs)
const STOCK_TABS = [
  { key: 'summary', icon: '📑', label: '요약·감성' },
  { key: 'news', icon: '📰', label: '뉴스' },
  { key: 'sns', icon: '💬', label: 'SNS' },
  { key: 'mention', icon: '📈', label: '언급량 추이' },
  { key: 'board', icon: '🗣️', label: '종목 토론' },
];

// 상단 시장 지수 3단 요약 데이터 (복원)
const MARKET_INDICES_DATA = [
  {
    key: 'KOSPI',
    name: 'KOSPI · 코스피 지수',
    value: '2,612.45',
    changeText: '▲ 30.42 (+1.18%)',
    subText: '외국인·기관 동반 순매수 유입',
    tone: 'up',
  },
  {
    key: 'KOSDAQ',
    name: 'KOSDAQ · 코스닥 지수',
    value: '768.30',
    changeText: '▲ 6.40 (+0.84%)',
    subText: '반도체 소부장·바이오 강세',
    tone: 'up',
  },
  {
    key: 'USD_KRW',
    name: 'USD/KRW · 원/달러 환율',
    value: '1,368.50',
    changeText: '▼ 4.20 (-0.31%)',
    subText: '서울외국환중개 장중 고시 기준',
    tone: 'down',
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

const SENTIMENT_FILTERS = [
  { key: 'ALL', label: '감성 전체' },
  { key: 'POSITIVE', label: '호재(긍정)' },
  { key: 'NEGATIVE', label: '악재(부정)' },
  { key: 'NEUTRAL', label: '중립' },
];

const RELEVANCE_OPTIONS = [
  { key: 0, label: '관련도 전체' },
  { key: 50, label: '50% 이상' },
  { key: 70, label: '70% 이상' },
  { key: 80, label: '80% 이상' },
];

const COMMENT_TAGS = {
  summary: { label: '뉴스', className: 'tag-news' },
  news: { label: '뉴스', className: 'tag-news' },
  sns: { label: 'SNS', className: 'tag-sns' },
  mention: { label: '언급량', className: 'tag-mention' },
  board: { label: '뉴스', className: 'tag-news' },
};
const COMMENT_TAG_PATTERN = /^\[(뉴스|SNS|언급량)\]\s*/;
const COMMENT_MAX_LENGTH = 1000;

const DEFAULT_USERS_DB = {
  tester01: 'password123',
  seojun: '1234',
  admin: '1234',
};

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

const nowIsoSeoul = () => {
  const kst = new Date(Date.now() + 9 * 60 * 60 * 1000);
  return `${kst.toISOString().slice(0, 19)}+09:00`;
};

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
  if (rate === null || rate === undefined) return null;
  const tone = rateTone(rate);
  const arrow = tone === 'up' ? '▲' : tone === 'down' ? '▼' : '';
  return (
    <span className={`rate-pill ${tone} ${size}`}>
      {arrow && <span className="rate-arrow">{arrow}</span>}
      {formatRate(rate)}
    </span>
  );
}

function SentimentBadge({ sentiment }) {
  const norm = String(sentiment || '').toUpperCase();
  if (norm === 'POSITIVE' || norm === '긍정') {
    return <span className="trend-badge trend-up">호재 · 긍정</span>;
  }
  if (norm === 'NEGATIVE' || norm === '부정') {
    return <span className="trend-badge trend-down">악재 · 부정</span>;
  }
  return <span className="trend-badge trend-neutral">중립</span>;
}

function SentimentBar({ ratio }) {
  const pos = Number(ratio?.positive ?? 60);
  const neu = Number(ratio?.neutral ?? 25);
  const neg = Number(ratio?.negative ?? 15);
  return (
    <div className="sentiment">
      <div className="sentiment-bar" role="img" aria-label={`긍정 ${pos}%, 중립 ${neu}%, 부정 ${neg}%`}>
        <div className="seg pos" style={{ width: `${pos}%` }} />
        <div className="seg neu" style={{ width: `${neu}%` }} />
        <div className="seg neg" style={{ width: `${neg}%` }} />
      </div>
      <div className="sentiment-legend num">
        <span className="sent-pos">긍정(호재) {pos}%</span>
        <span className="sent-neu">중립 {neu}%</span>
        <span className="sent-neg">부정(악재) {neg}%</span>
      </div>
    </div>
  );
}

// 언급량 추이 막대그래프 (TrendChart: Y축 눈금선, 🔥 피크 배지, 호버 툴팁)
function MentionTrendChart({ series, plotHeight }) {
  const safeSeries = Array.isArray(series) && series.length > 0 ? series : [];
  const maxValue = Math.max(...safeSeries.map((d) => Math.max(d.news || 0, d.sns || 0)), 1);
  const { yMax, ticks } = niceScale(maxValue);
  const periodTotal = safeSeries.reduce((sum, d) => sum + (d.news || 0) + (d.sns || 0), 0);
  const peak = safeSeries.reduce(
    (best, d) => ((d.news || 0) + (d.sns || 0) > (best.news || 0) + (best.sns || 0) ? d : best),
    safeSeries[0] || { label: '', news: 0, sns: 0 }
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
              const total = (pt.news || 0) + (pt.sns || 0);
              const newsPct = ((pt.news || 0) / yMax) * 100;
              const snsPct = ((pt.sns || 0) / yMax) * 100;
              const topPct = Math.max(newsPct, snsPct);
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
                  <div className="trend-bar sns" style={{ height: `${snsPct}%` }} />

                  <div
                    className="trend-tooltip"
                    role="tooltip"
                    style={{ bottom: `min(calc(${topPct}% + 10px), calc(100% - 78px))` }}
                  >
                    <div className="tooltip-title">{pt.label}</div>
                    <div className="tooltip-row">
                      <span>
                        <i className="legend-dot news" />
                        뉴스
                      </span>
                      <b className="num">{pt.news}건</b>
                    </div>
                    <div className="tooltip-row">
                      <span>
                        <i className="legend-dot sns" />
                        SNS
                      </span>
                      <b className="num">{pt.sns}건</b>
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
          <i className="legend-dot news" /> 뉴스 (작성 시각 기준)
        </span>
        <span>
          <i className="legend-dot sns" /> SNS (블로그·카페)
        </span>
        <span className="legend-total">
          기간 합계 <b className="num">{periodTotal.toLocaleString()}건</b>
        </span>
      </div>
    </div>
  );
}

// 좌측 뉴스·SNS 목록 (카드 클릭 시 우측 ArticleDetail, #종목칩 클릭 시 종목 상세 화면 이동)
function ArticleList({ articles, selectedId, onSelect, onSelectStock }) {
  if (articles.length === 0) {
    return (
      <div className="empty-text">
        조건에 맞는 분석 완료 글이 없습니다. 상단 필터 조건을 변경해 보세요.
      </div>
    );
  }
  return (
    <div className="article-list">
      {articles.map((art) => {
        const isSns = art.sourceType !== 'NEWS';
        const topStocks = [...(art.relatedStocks || [])]
          .sort((a, b) => b.relevance - a.relevance)
          .slice(0, 3);

        return (
          <article
            key={art.id}
            className={`article-item ${selectedId === art.id ? 'selected' : ''}`}
            role="button"
            tabIndex={0}
            aria-label={`${art.title} 상세 보기`}
            onClick={() => onSelect(art.id)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onSelect(art.id);
              }
            }}
          >
            <div className="article-top-meta">
              <div className="article-meta-left">
                <SentimentBadge sentiment={art.sentiment} />
                <span className={`source-pill ${isSns ? 'sns' : 'news'}`}>
                  {isSns ? 'SNS' : 'NEWS'}
                </span>
              </div>
              <span className="article-press-time num">
                {art.press} · {art.publishedAt}
              </span>
            </div>

            <h4 className="article-title">{art.title}</h4>

            <div className="article-stock-tags">
              {topStocks.map((rel) => (
                <button
                  key={rel.code}
                  type="button"
                  className="matched-stock-tag num"
                  onClick={(e) => {
                    e.stopPropagation();
                    onSelectStock(rel.code);
                  }}
                  title={`${rel.name} 종목 상세 화면으로 이동 (${rel.relationType} · 관련도 ${rel.relevance}%)`}
                >
                  #{rel.name} <span>{rel.relevance}%</span>
                </button>
              ))}
              {isSns && <span className="sns-mini-tag">⚠️ 참고용 · 확인되지 않은 정보</span>}
            </div>
          </article>
        );
      })}
    </div>
  );
}

// 실시간 종목 토론장 컴포넌트 (종목 토론 탭 및 우측 상세 패널 하단 스크롤 댓글 공용)
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
  const resolvedDefaultTag =
    tabKey === 'sns' ? 'sns' : tabKey === 'mention' ? 'mention' : 'news';

  const [draft, setDraft] = useState('');
  const [selectedTag, setSelectedTag] = useState(resolvedDefaultTag);
  const [filterMode, setFilterMode] = useState('all'); // 'all' | 'news' | 'sns' | 'mention'
  const [sortMode, setSortMode] = useState('latest'); // 'latest' | 'likes'

  // 현재 열어본 글의 출처(NEWS / SNS) 또는 탭이 바뀌면 댓글 말머리([뉴스] / [SNS])를 자동 동기화
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
              뉴스·SNS·언급량 탭에서 실시간 공유되는 종목 의견입니다
            </span>
          )}
        </div>

        <div className="comments-controls">
          <div className="segmented" role="group" aria-label="의견 말머리 필터">
            {[
              { key: 'all', label: '전체 의견' },
              { key: 'news', label: '뉴스' },
              { key: 'sns', label: 'SNS' },
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
              { key: 'sns', label: 'SNS' },
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

// 우측 글 상세 패널 (ArticleDetail):
// - 메타 정보, SNS 미검증 경고 배너, 키워드 해시태그
// - AI 3줄 요약 & 종목 감성 비율(SentimentBar) & 요약 재생성 버튼 & AI 면책 문구
// - 매칭 종목 시세·근거(.evidence-card), 연관 SNS 반응
// - 스크롤 하단 댓글(.comments-embedded, showComments=true) + 뉴스/SNS 말머리 자동 연동
function ArticleDetail({
  article,
  allStocks,
  allArticles,
  liveQuotes,
  onSelectStock,
  onSelectArticle,
  onClose,
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
}) {
  const sortedRelatedStocks = useMemo(
    () => [...(article?.relatedStocks || [])].sort((a, b) => b.relevance - a.relevance),
    [article]
  );

  // 상세 패널 하단 댓글을 작성할 대상 종목 (기본값: 현재 선택 종목이 매칭 종목에 있으면 해당 종목, 아니면 최상위 관련도 종목)
  const [commentTargetCode, setCommentTargetCode] = useState(
    preferredStockCode || sortedRelatedStocks[0]?.code || '005930'
  );

  useEffect(() => {
    if (!article) return;
    const hasPreferred = sortedRelatedStocks.some((r) => r.code === preferredStockCode);
    setCommentTargetCode(
      hasPreferred
        ? preferredStockCode
        : sortedRelatedStocks[0]?.code || preferredStockCode || '005930'
    );
  }, [article, preferredStockCode, sortedRelatedStocks]);

  if (!article) {
    return (
      <div className="empty-text">
        왼쪽 목록에서 뉴스 또는 SNS 글을 선택하면 AI 3줄 요약과 종목 매칭 근거 및 하단 종목토론 댓글이 표시됩니다.
      </div>
    );
  }

  const isSns = article.sourceType !== 'NEWS';
  const primaryStock =
    allStocks.find((s) => s.code === commentTargetCode) ||
    allStocks.find((s) => s.code === sortedRelatedStocks[0]?.code) ||
    allStocks[0];

  // const articleSentimentRatio =
  //   article.sentimentRatio ||
  //   primaryStock?.sentimentRatio ||
  //   (article.sentiment === 'POSITIVE'
  //     ? { positive: 72, neutral: 18, negative: 10 }
  //     : article.sentiment === 'NEGATIVE'
  //       ? { positive: 18, neutral: 22, negative: 60 }
  //       : { positive: 45, neutral: 35, negative: 20 });
  const articleSentimentRatio = article.sentimentRatio ?? null;

  const relatedSnsList = (() => {
    if (isSns) return [];
    if (Array.isArray(article.relatedSns) && article.relatedSns.length > 0) {
      return article.relatedSns.slice(0, 5);
    }
    const relCodes = new Set(sortedRelatedStocks.map((r) => r.code));
    return allArticles
      .filter(
        (a) => a.sourceType === 'SNS' && a.relatedStocks.some((r) => relCodes.has(r.code))
      )
      .slice(0, 5);
  })();

  const targetStockComments = commentsByStock[primaryStock?.code] || [];
  // 현재 상세보기로 열어본 글이 뉴스(NEWS)이면 'news'([뉴스]), SNS이면 'sns'([SNS]) 말머리 자동 연동
  const commentTabKey = isSns ? 'sns' : 'news';

  return (
    <div className="article-detail">
      {onClose && (
        <div className="detail-back-bar">
          <button type="button" className="more-link2" onClick={onClose}>
            ← 우측 관심·이슈 종목 요약으로 돌아가기
          </button>
        </div>
      )}

      <div className="article-detail-head">
        <div>
          <div className="article-meta-left">
            <SentimentBadge sentiment={article.sentiment} />
            <span className={`source-pill ${isSns ? 'sns' : 'news'}`}>
              {isSns ? 'SNS 게시글' : '뉴스 기사'}
            </span>
            <span className="stock-meta num">
              {article.press} · {article.publishedAt}
            </span>
          </div>
          <h3>{article.title}</h3>
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

      {/* SNS 미검증 경고 배너 (N-05 복원 필수) */}
      {isSns && (
        <div className="sns-warning-inline" role="alert">
          ⚠️ <strong>참고용 · 확인되지 않은 정보:</strong> SNS(블로그·카페·커뮤니티) 게시글은 사실 여부가 검증되지 않았습니다. 투자 판단 시 공시와 원문을 반드시 확인해 주세요.
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

      {/* AI 3줄 핵심 요약 & 종목 감성 분석 카드 */}
      <div className="ai-card">
        <div className="ai-card-header">
          <span className="ai-card-badge">🤖 AI 3줄 핵심 요약 & 감성 분석 (F-05)</span>
          <div className="header-btn-group">
            <SentimentBadge sentiment={article.sentiment} />
            {onRegenerateSummary && (
              <button
                type="button"
                className="more-link2"
                onClick={onRegenerateSummary}
                disabled={regenerating}
              >
                {regenerating ? '⏳ 재생성 중...' : '🔄 요약 재생성'}
              </button>
            )}
          </div>
        </div>
        <ul className="summary-lines">
          {article.summary.map((line, idx) => (
            <li key={idx}>{line}</li>
          ))}
        </ul>
        {/* <SentimentBar ratio={articleSentimentRatio} /> */}
        {articleSentimentRatio && (
  <SentimentBar ratio={articleSentimentRatio} />
)}
        <div className="llm-notice">
          🤖 AI(LLM) 요약 및 감성 분석 결과는 원문과 차이가 있을 수 있습니다.
        </div>
      </div>

      {/* 매칭 종목 시세 테이블 및 연결 근거 리스트 (.evidence-card) */}
      <div className="detail-section-block">
        <div className="sub-title">
          📌 매칭 종목 시세 및 연결 근거 ({sortedRelatedStocks.length}종목 · 관련도순)
        </div>
        {sortedRelatedStocks.length === 0 ? (
          <div className="empty-text">연결된 종목이 없습니다.</div>
        ) : (
          <>
            <table className="stock-table compact-table">
              <thead>
                <tr>
                  <th>종목명 (클릭 시 이동)</th>
                  <th>구분·관련도</th>
                  <th className="num-col">현재가</th>
                  <th className="num-col">등락률</th>
                </tr>
              </thead>
              <tbody>
                {sortedRelatedStocks.map((rel) => {
                  const stock = allStocks.find((s) => s.code === rel.code);
                  const quote = liveQuotes[rel.code];
                  
                  const st = quote
                    ? {
                        ...stock,
                        price: quote.price,
                        changeRate: quote.changeRate,
                        changeAmount: quote.changeAmount,
                      }
                    : stock;
                  
                  const hasPrice = st?.price != null;
                  const tone = rateTone(st?.changeRate);
                  // return (
                  //   <tr
                  //     key={rel.code}
                  //     onClick={() => onSelectStock(rel.code)}
                  //     title={`${rel.name} 종목 상세 화면으로 이동`}
                  //   >
                  //     <td>
                  //       <strong>{rel.name}</strong>{' '}
                  //       <span className="stock-code num">{rel.code}</span>
                  //     </td>
                  //     <td className="num">
                  //       <span className="source-pill">{rel.relationType}</span>{' '}
                  //       <strong>{rel.relevance}%</strong>
                  //     </td>
                  //     <td className="num-col num">
                  //       {hasPrice
                  //         ? `${st.price.toLocaleString()}원`
                  //         : `매칭 ${st?.todayMatchedCount ?? 0}건`}
                  //     </td>
                  //     <td className={`num-col num ${tone}`}>
                  //       {hasPrice
                  //         ? formatRate(st.changeRate)
                  //         : `긍정 ${st?.sentimentRatio?.positive ?? 50}%`}
                  //     </td>
                  return (
                    <tr
                      key={rel.code}
                      onClick={() => onSelectStock(rel.code)}
                      title={`${rel.name} 종목 상세 화면으로 이동`}
                    >
                      <td>
                        <strong>{rel.name}</strong>{' '}
                        <span className="stock-code num">{rel.code}</span>
                      </td>
                  
                      <td className="num">
                        <span className="source-pill">{rel.relationType}</span>{' '}
                        <strong>{rel.relevance}%</strong>
                      </td>
                  
                      <td className="num-col num">
                        {hasPrice
                          ? `${st.price.toLocaleString()}원`
                          : '시세 준비 중'}
                      </td>
                  
                      <td className={`num-col num ${tone}`}>
                        {hasPrice && st.changeRate != null
                          ? formatRate(st.changeRate)
                          : '-'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            <div className="evidence-list">
              {sortedRelatedStocks.map((rel) => (
                <div key={rel.code} className="evidence-card">
                  <div className="evidence-head">
                    <button
                      type="button"
                      className="btn-text stock-jump-btn"
                      onClick={() => onSelectStock(rel.code)}
                      title={`${rel.name} 종목 상세 대시보드로 이동`}
                    >
                      📊 {rel.name} <span className="stock-code num">({rel.code})</span> 상세 이동 →
                    </button>
                    <span className="relevance-score num">
                      {rel.relationType} 매칭 · 관련도 {rel.relevance}%
                    </span>
                  </div>
                  <div className="gauge-track" title={`관련도 ${rel.relevance}%`}>
                    <div className="gauge-fill" style={{ width: `${rel.relevance}%` }} />
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
                  <div className="evidence-reason">
                    <strong>연결 이유:</strong> {rel.reason}
                  </div>
                  <div className="evidence-quote">
                    {/* <strong>근거 원문:</strong> {rel.evidence} */}
                    <strong>근거 원문:</strong>{' '}
{rel.evidence?.trim() || ''}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* 인접 시각 연관 SNS 반응 목록 (뉴스일 때 최대 5건) */}
      {!isSns && (
        <div className="detail-section-block">
          <div className="sub-title">
            💬 인접 시각 연관 SNS 반응 (최대 5건 · ⚠️ 참고용 확인되지 않은 정보)
          </div>
          {relatedSnsList.length === 0 ? (
            <div className="empty-text">인접 시각에 매칭된 SNS 반응이 없습니다.</div>
          ) : (
            <div className="related-sns-list">
              {relatedSnsList.map((sns) => (
                <div
                  key={sns.id}
                  className="related-sns-row"
                  role="button"
                  tabIndex={0}
                  onClick={() => onSelectArticle(sns.id)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      onSelectArticle(sns.id);
                    }
                  }}
                >
                  <span className="source-pill sns">{sns.channel || sns.press}</span>
                  <span className="related-sns-title">{sns.title}</span>
                  <span className="stock-meta num">{sns.publishedAt || sns.time}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 우측 상세보기 패널 스크롤 하단 댓글(종목 토론) 달기 영역 (showComments=true) */}
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

export default function DashboardPage() {
  // 양방향 정규화된 초기 데이터
  // 화면 연결 진행 상황은 src/api/README.md 참고. 아직 연결하지 않은 화면은 가짜 데이터(mockData)를 씀
  const mockStocks = useMemo(
    () => normalizeStocks(STOCKS_DATA, STOCK_SUMMARIES_DATA, MENTION_TRENDS_DATA),
    []
  );
  // 백엔드 종목 검색으로 고른 종목 중 가짜 데이터에 없는 것 (시세·요약은 아직 없음 → analysisReady: false)
  // const [apiStocks, setApiStocks] = useState([]);
  // const allStocks = useMemo(() => [...mockStocks, ...apiStocks], [mockStocks, apiStocks]);
  const [apiStocks, setApiStocks] = useState([]);
const [liveQuotes, setLiveQuotes] = useState({});

const allStocks = useMemo(
  () =>
    [...mockStocks, ...apiStocks].map((stock) => {
      const quote = liveQuotes[stock.code];

      if (!quote) return stock;

      return {
        ...stock,
        price: quote.price,
        changeRate: quote.changeRate,
        changeAmount: quote.changeAmount,
      };
    }),
  [mockStocks, apiStocks, liveQuotes]
);

// // 현재 선택한 종목과 관심종목의 실제 시세 조회
// useEffect(() => {
//   const codes = [...new Set([selectedStockCode, ...watchlistCodes].filter(Boolean))];
//   let cancelled = false;

//   Promise.allSettled(
//     codes.map((code) => quoteApi.get(code))
//   ).then((results) => {
//     if (cancelled) return;

//     const quotes = {};

//     results.forEach((result, index) => {
//       if (result.status === 'fulfilled' && result.value?.price != null) {
//         quotes[codes[index]] = result.value;
//       }
//     });

//     setLiveQuotes((prev) => ({ ...prev, ...quotes }));
//   });

//   return () => {
//     cancelled = true;
//   };
// }, [selectedStockCode, watchlistCodes]); 

  // const allArticles = useMemo(() => normalizeArticles(ARTICLES_DATA), []);
  const [allArticles, setAllArticles] = useState([]);

useEffect(() => {
  const controller = new AbortController();

  articleApi
    .list({ page: 1, size: 100 }, { signal: controller.signal })
    .then((res) => {
      setAllArticles((res.items || []).map(toUiArticle));
    })
    .catch((err) => {
      if (err.name !== 'AbortError') {
        console.error('뉴스 API 조회 실패:', err);
      }
    });

  return () => controller.abort();
}, []);

  const initialSummaries = useMemo(() => normalizeSummaries(STOCK_SUMMARIES_DATA), []);
  const initialTrends = useMemo(() => normalizeMentionTrends(MENTION_TRENDS_DATA), []);

  // 1계층: 왼쪽 사이드바 장소 상태 ('home' | 'stock' | 'watchlist') & 접기/펴기 상태
  const [activeNav, setActiveNav] = useState('home');
  const [navCollapsed, setNavCollapsed] = useState(() => {
    try {
      return localStorage.getItem('snm_nav_collapsed') === 'true';
    } catch {
      return false;
    }
  });

  // 2계층: 종목 화면 내부 상태 ('list': 전체 종목 찾기 | 'detail': 개별 종목 상세 대시보드)
  const [stockViewMode, setStockViewMode] = useState('detail');
  // 개별 종목 상세 내부 가로 탭 ('summary' | 'news' | 'sns' | 'mention' | 'board')
  const [stockTab, setStockTab] = useState('summary');

  // 종목 찾기(list) 전용 검색어·시장·정렬 상태
  const [stockListQuery, setStockListQuery] = useState('');
  const [stockListMarket, setStockListMarket] = useState('ALL'); // 'ALL' | 'KOSPI' | 'KOSDAQ'
  const [stockListSort, setStockListSort] = useState('issue'); // 'issue' | 'up' | 'down' | 'name'

  const [watchlistCodes, setWatchlistCodes] = useState(INITIAL_WATCHLIST_CODES);
  const [selectedStockCode, setSelectedStockCode] = useState(
    INITIAL_WATCHLIST_CODES[0] || allStocks[0]?.code || '005930'
  );
  // 현재 선택한 종목과 관심종목의 실제 시세 조회
useEffect(() => {
  const codes = [...new Set([selectedStockCode, ...watchlistCodes].filter(Boolean))];
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
}, [selectedStockCode, watchlistCodes]);

  const [selectedArticleId, setSelectedArticleId] = useState(null);

  const [articleDetails, setArticleDetails] = useState({});
// 선택한 뉴스에 매칭된 종목의 실제 주가 조회
useEffect(() => {
  if (!selectedArticleId) return undefined;

  const article =
    articleDetails[selectedArticleId] ||
    allArticles.find((a) => a.id === selectedArticleId);

  if (!article) return undefined;

  const codes = [
    ...new Set(
      (article.relatedStocks || [])
        .map((stock) => stock.code)
        .filter(Boolean)
    ),
  ].slice(0, 5);

  if (codes.length === 0) return undefined;

  let cancelled = false;

  Promise.allSettled(
    codes.map((code) => quoteApi.get(code))
  ).then((results) => {
    if (cancelled) return;

    const quotes = {};

    results.forEach((result, index) => {
      if (
        result.status === 'fulfilled' &&
        result.value?.price != null
      ) {
        quotes[codes[index]] = result.value;
      }
    });

    if (Object.keys(quotes).length > 0) {
      setLiveQuotes((prev) => ({
        ...prev,
        ...quotes,
      }));
    }
  });

  return () => {
    cancelled = true;
  };
}, [selectedArticleId, articleDetails, allArticles]);

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

  // 홈 우측 랭킹 탭 필터: 'issue'(매칭 급증) | 'up'(급상승) | 'down'(급하락)
  const [homeRankFilter, setHomeRankFilter] = useState('issue');

  // 관심종목 검색 추가 입력 & 관리 모달
  const [watchAddQuery, setWatchAddQuery] = useState('');
  const [showWatchModal, setShowWatchModal] = useState(false);

  // 통합 검색바 (F-12: 검색어 + 기간 필터 + 출처 필터 + 종목·글 2단 자동완성)
  const [searchQuery, setSearchQuery] = useState('');
  const [searchPeriod, setSearchPeriod] = useState('ALL'); // ALL | 0 | 7 | 30
  const [searchSource, setSearchSource] = useState('ALL'); // ALL | NEWS | SNS
  const [showAutocomplete, setShowAutocomplete] = useState(false);

  // 언급량 추이 기간 (F-13)
  const [trendPeriod, setTrendPeriod] = useState('today'); // today | 7d | 30d

  // 뉴스·SNS 필터 및 정렬
  const [channelFilter, setChannelFilter] = useState('ALL'); // ALL | NEWS | SNS
  const [sentimentFilter, setSentimentFilter] = useState('ALL'); // ALL | POSITIVE | NEGATIVE | NEUTRAL
  const [articlePeriod, setArticlePeriod] = useState('ALL'); // ALL | 0 | 7 | 30
  const [minRelevance, setMinRelevance] = useState(0); // 0 | 50 | 70 | 80
  const [articleSort, setArticleSort] = useState('latest'); // latest | relevance
  const [onlyWatchlistArticles, setOnlyWatchlistArticles] = useState(false);

  // 시스템 상태 및 AI 요약 재생성 상태
  const [sysStatus, setSysStatus] = useState(INITIAL_SYSTEM_STATUS);
  const [summariesByStock, setSummariesByStock] = useState(initialSummaries);
  const [regenerating, setRegenerating] = useState(false);

  // 회원가입·로그인 상태 (F-16, N-03: localStorage 연동)
  const [usersDb, setUsersDb] = useState(() => {
    try {
      const saved = localStorage.getItem('snm_users_db');
      return saved ? { ...DEFAULT_USERS_DB, ...JSON.parse(saved) } : DEFAULT_USERS_DB;
    } catch {
      return DEFAULT_USERS_DB;
    }
  });
  const [user, setUser] = useState(() => {
    try {
      const savedUser = localStorage.getItem('snm_current_user');
      return savedUser ? { username: savedUser } : null;
    } catch {
      return null;
    }
  });
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authMode, setAuthMode] = useState('login'); // 'login' | 'signup'
  const [authForm, setAuthForm] = useState({
    username: '',
    password: '',
    passwordConfirm: '',
  });
  const [authError, setAuthError] = useState('');

  // 토스트 알림
  const [toast, setToast] = useState(null);

  // 종목별 실시간 종목토론 댓글 (F-17)
  const [commentsByStock, setCommentsByStock] = useState(() =>
    normalizeComments(INITIAL_STOCK_COMMENTS)
  );

  const mainRef = useRef(null);

  const triggerToast = (msg) => setToast({ id: Date.now(), text: msg });

  useEffect(() => {
    if (!toast) return undefined;
    const timer = setTimeout(() => setToast(null), 2600);
    return () => clearTimeout(timer);
  }, [toast]);

  // 사이드바 접기/펴기 토글 (localStorage snm_nav_collapsed 연동)
  const handleToggleNavCollapse = () => {
    setNavCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem('snm_nav_collapsed', String(next));
      } catch {
        // ignore storage error
      }
      return next;
    });
  };

  // 왼쪽 사이드바 장소 전환 핸들러
  const handleSwitchNav = (navKey) => {
    setActiveNav(navKey);
    if (navKey === 'home') {
      setSelectedArticleId(null);
    }
    mainRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // ESC 키로 모달 및 자동완성 드롭다운 닫기 (웹 접근성 N-06)
  useEffect(() => {
    if (!showAuthModal && !showAutocomplete && !showWatchModal) return undefined;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        setShowAuthModal(false);
        setShowAutocomplete(false);
        setShowWatchModal(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showAuthModal, showAutocomplete, showWatchModal]);

  const stockByCode = (code) => allStocks.find((s) => s.code === code);
  const selectedStock = stockByCode(selectedStockCode) || allStocks[0];
  const isInWatchlist = (code) => watchlistCodes.includes(code);

  const watchlistStocks = useMemo(
    () => watchlistCodes.map(stockByCode).filter(Boolean),
    [watchlistCodes, allStocks]
  );

  // 종목명·종목 행·#종목칩 클릭 시 즉시 종목 상세 대시보드(activeNav='stock', stockViewMode='detail')로 전환
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

  // 종목 검색 헬퍼 (종목명·코드·별칭·테마)
  const matchStockByQuery = (stock, q) =>
    stock.name.toLowerCase().includes(q) ||
    stock.code.includes(q) ||
    stock.aliases.some((al) => al.toLowerCase().includes(q)) ||
    stock.themes.some((th) => th.toLowerCase().includes(q));

  // 통합 검색 2단 자동완성 결과: ① 매칭 종목 + ② 매칭 뉴스·SNS 글 (F-12)
  // 백엔드 종목 검색 결과 (검색어를 멈추고 0.25초 뒤 한 번, 이전 요청은 취소). null이면 서버 연결 안 됨
  const [remoteStockResult, setRemoteStockResult] = useState(null);
  const requestedSearchQuotes = useRef(new Set());

useEffect(() => {
  if (!remoteStockResult?.items?.length) return;

  const codes = remoteStockResult.items
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
}, [remoteStockResult]);

  useEffect(() => {
    const q = searchQuery.trim();
    if (!q) return undefined;
    const controller = new AbortController();
    const timer = setTimeout(() => {
      stockApi
        .search(q, { size: 5 }, { signal: controller.signal })
        .then((res) => setRemoteStockResult({ q, items: res.items }))
        .catch((err) => {
          if (err.name !== 'AbortError') setRemoteStockResult(null);
        });
    }, 250);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [searchQuery]);

  const integratedSearchResults = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return { matchedStocks: [], matchedArticles: [] };

    // 서버가 답하면 서버 순서 그대로 (별칭 "삼전"·"현대차", 최근 많이 언급된 종목 먼저 등은 백엔드가 처리)
    // 가짜 데이터에 있는 종목은 그 정보(시세 등)를 그대로 보여 줌
    const remote =
      remoteStockResult && remoteStockResult.q.toLowerCase() === q ? remoteStockResult.items : null;
    
      // const matchedStocks = remote
      // ? remote.map((item) => allStocks.find((st) => st.code === item.stockCode) || toUiStock(item))
      // : allStocks.filter((st) => matchStockByQuery(st, q)).slice(0, 5);
      const matchedStocks = remote
  ? remote.map((item) => {
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
    })
  : allStocks.filter((st) => matchStockByQuery(st, q)).slice(0, 5);
  

    const matchedArticles = allArticles
      .filter((art) => {
        if (searchSource !== 'ALL' && art.sourceType !== searchSource) return false;
        if (searchPeriod !== 'ALL' && art.daysAgo > Number(searchPeriod)) return false;

        const inTitle = art.title.toLowerCase().includes(q);
        const inSummary = art.summary.some((line) => line.toLowerCase().includes(q));
        const inKeywords = art.keywords.some((kw) => kw.toLowerCase().includes(q));
        const inRelatedStock = art.relatedStocks.some((rel) => {
          const st = stockByCode(rel.code);
          return (
            rel.name.toLowerCase().includes(q) ||
            rel.code.includes(q) ||
            st?.aliases.some((al) => al.toLowerCase().includes(q))
          );
        });
        return inTitle || inSummary || inKeywords || inRelatedStock;
      })
      .slice(0, 5);

    return { matchedStocks, matchedArticles };
  }, [searchQuery, searchPeriod, searchSource, allStocks, allArticles, remoteStockResult]);

  // 관심종목 추가 검색 후보
  const watchAddCandidates = useMemo(() => {
    const q = watchAddQuery.trim().toLowerCase();
    if (!q) return allStocks.slice(0, 8);
    return allStocks.filter((s) => matchStockByQuery(s, q)).slice(0, 8);
  }, [watchAddQuery, allStocks]);

  // 현재 선택 종목의 요약 데이터 (F-06)
  // 백엔드에서 고른 종목은 아직 요약이 없으므로 가짜 기본 요약(default) 대신 "준비 중"
  const notReadySummary = {
    updatedAt: '-',
    headline: `${selectedStock.name} AI 요약 준비 중`,
    summary: '이 종목은 아직 AI 요약이 연결되지 않았습니다. (종목 요약 API 연결 후 표시)',
    newsSummary: '',
    snsSummary: '',
    sentimentRatio: selectedStock.sentimentRatio,
  };
  const currentSummary =
    summariesByStock[selectedStockCode] ||
    (selectedStock.analysisReady === false ? notReadySummary : null) ||
    summariesByStock.default || {
      updatedAt: sysStatus.lastUpdated.summary,
      headline: `${selectedStock.name} 당일 매칭 뉴스·SNS 종합 요약`,
      summary: selectedStock.summary,
      newsSummary: selectedStock.newsSummary,
      snsSummary: selectedStock.snsSummary,
      sentimentRatio: selectedStock.sentimentRatio,
    };

  // 현재 선택 종목의 언급량 추이 데이터 (F-13)
  const currentTrend =
    initialTrends[selectedStockCode] ||
    (selectedStock.analysisReady === false ? { today: [], '7d': [], '30d': [] } : initialTrends.default);
  const trendSeries = currentTrend[trendPeriod] || currentTrend.today;

  // 오늘 뉴스·SNS 매칭 건수
  const todayCounts = useMemo(
    () =>
      (currentTrend.today || []).reduce(
        (acc, pt) => ({ news: acc.news + (pt.news || 0), sns: acc.sns + (pt.sns || 0) }),
        { news: 0, sns: 0 }
      ),
    [currentTrend]
  );

  // [화면 A] 홈 화면용 전체 뉴스·SNS 소식 필터링
  const homeFeedArticles = useMemo(() => {
    const relevanceOf = (art) =>
      Math.max(...(art.relatedStocks || []).map((r) => r.relevance), 0);

    return allArticles
      .filter((art) => channelFilter === 'ALL' || art.sourceType === channelFilter)
      .filter((art) => sentimentFilter === 'ALL' || art.sentiment === sentimentFilter)
      .filter((art) => {
        if (!onlyWatchlistArticles) return true;
        return art.relatedStocks.some((r) => watchlistCodes.includes(r.code));
      })
      .filter((art) => articlePeriod === 'ALL' || art.daysAgo <= Number(articlePeriod))
      .filter((art) => relevanceOf(art) >= minRelevance)
      .sort((a, b) =>
        articleSort === 'relevance'
          ? relevanceOf(b) - relevanceOf(a)
          : b.publishedAt.localeCompare(a.publishedAt)
      );
  }, [
    allArticles,
    channelFilter,
    sentimentFilter,
    onlyWatchlistArticles,
    watchlistCodes,
    articlePeriod,
    minRelevance,
    articleSort,
  ]);

  // [화면 B] 개별 종목 상세(news / sns 탭) 전용 소식 필터링
  const stockFeedArticles = useMemo(() => {
    const targetSource = stockTab === 'sns' ? 'SNS' : 'NEWS';
    const relevanceOf = (art) =>
      art.relatedStocks.find((r) => r.code === selectedStockCode)?.relevance ??
      Math.max(...art.relatedStocks.map((r) => r.relevance), 0);

    return allArticles
      .filter((art) => art.sourceType === targetSource)
      .filter((art) => art.relatedStocks.some((r) => r.code === selectedStockCode))
      .filter((art) => sentimentFilter === 'ALL' || art.sentiment === sentimentFilter)
      .filter((art) => articlePeriod === 'ALL' || art.daysAgo <= Number(articlePeriod))
      .filter((art) => relevanceOf(art) >= minRelevance)
      .sort((a, b) =>
        articleSort === 'relevance'
          ? relevanceOf(b) - relevanceOf(a)
          : b.publishedAt.localeCompare(a.publishedAt)
      );
  }, [
    allArticles,
    stockTab,
    selectedStockCode,
    sentimentFilter,
    articlePeriod,
    minRelevance,
    articleSort,
  ]);

  // [화면 C] 관심 종목 뉴스·SNS 모아보기 필터링
  const watchlistFeedArticles = useMemo(() => {
    const relevanceOf = (art) =>
      Math.max(
        ...art.relatedStocks
          .filter((r) => watchlistCodes.includes(r.code))
          .map((r) => r.relevance),
        0
      );

    return allArticles
      .filter((art) => art.relatedStocks.some((r) => watchlistCodes.includes(r.code)))
      .filter((art) => channelFilter === 'ALL' || art.sourceType === channelFilter)
      .filter((art) => sentimentFilter === 'ALL' || art.sentiment === sentimentFilter)
      .filter((art) => articlePeriod === 'ALL' || art.daysAgo <= Number(articlePeriod))
      .filter((art) => relevanceOf(art) >= minRelevance)
      .sort((a, b) =>
        articleSort === 'relevance'
          ? relevanceOf(b) - relevanceOf(a)
          : b.publishedAt.localeCompare(a.publishedAt)
      );
  }, [
    allArticles,
    watchlistCodes,
    channelFilter,
    sentimentFilter,
    articlePeriod,
    minRelevance,
    articleSort,
  ]);

  // 종목 찾기(stockViewMode === 'list') 필터링·정렬 목록
  const filteredStockList = useMemo(() => {
    const q = stockListQuery.trim().toLowerCase();
    return allStocks
      .filter((st) => (stockListMarket === 'ALL' ? true : st.market === stockListMarket))
      .filter((st) => (!q ? true : matchStockByQuery(st, q)))
      .sort((a, b) => {
        if (stockListSort === 'up') return (b.changeRate ?? -999) - (a.changeRate ?? -999);
        if (stockListSort === 'down') return (a.changeRate ?? 999) - (b.changeRate ?? 999);
        if (stockListSort === 'name') return a.name.localeCompare(b.name, 'ko');
        return b.todayMatchedCount - a.todayMatchedCount;
      });
  }, [allStocks, stockListQuery, stockListMarket, stockListSort]);

  // 홈 우측 [🔥 오늘의 이슈 종목 TOP 7] 정렬 목록
  const homeRankedStocks = useMemo(() => {
    const list = [...allStocks];
    if (homeRankFilter === 'up') {
      return list.sort((a, b) => (b.changeRate ?? -999) - (a.changeRate ?? -999)).slice(0, 7);
    }
    if (homeRankFilter === 'down') {
      return list.sort((a, b) => (a.changeRate ?? 999) - (b.changeRate ?? 999)).slice(0, 7);
    }
    return list.sort((a, b) => b.todayMatchedCount - a.todayMatchedCount).slice(0, 7);
  }, [allStocks, homeRankFilter]);

  const currentComments = commentsByStock[selectedStockCode] || [];

  // 비로그인 시 로그인 모달 오픈 가드
  const requireLogin = (msg) => {
    triggerToast(msg);
    setAuthMode('login');
    setAuthError(msg);
    setShowAuthModal(true);
  };

  // 데이터 수동 새로고침
  const handleRefreshData = () => {
    const nowStr = nowTimeShort();
    setSysStatus((prev) => ({
      ...prev,
      streamStatus: 'CONNECTED',
      analysisStatus: 'COMPLETED',
      lastUpdated: {
        quote: nowStr,
        newsSns: nowStr,
        summary: nowStr,
      },
    }));
    triggerToast(`🔄 시세·뉴스 및 AI 매칭 데이터가 최신 상태로 갱신되었습니다 (${nowStr})`);
  };

  // 당일 AI 종합 요약 다시 생성
  const handleRegenerateSummary = () => {
    if (regenerating) return;
    setRegenerating(true);
    setTimeout(() => {
      const nowStr = nowTimeShort();
      setSummariesByStock((prev) => ({
        ...prev,
        [selectedStockCode]: {
          ...(prev[selectedStockCode] || currentSummary),
          updatedAt: nowStr,
          generatedAt: nowStr,
        },
      }));
      setRegenerating(false);
      triggerToast(`🤖 AI 요약 및 감성 분석이 최신 상태로 재생성되었습니다 (${nowStr})`);
    }, 500);
  };

  // 관심종목 추가·삭제·토글
  const handleAddWatchlist = (code, candidate = null) => {
    if (!user) {
      requireLogin('🔒 관심종목 추가는 로그인이 필요합니다.');
      return false;
    }
    const stock = stockByCode(code) || candidate;
    if (!stock) return false;
    if (watchlistCodes.includes(code)) {
      triggerToast(`이미 관심종목에 등록된 종목입니다: ${stock.name}`);
      return false;
    }
    setWatchlistCodes((prev) => [code, ...prev]);
    triggerToast(`★ ${stock.name}(${stock.code}) 종목을 관심종목에 추가했습니다.`);
    return true;
  };

  const handleRemoveWatchlist = (code) => {
    if (!user) {
      requireLogin('🔒 관심종목 삭제는 로그인이 필요합니다.');
      return;
    }
    const stock = stockByCode(code);
    setWatchlistCodes((prev) => prev.filter((c) => c !== code));
    triggerToast(`☆ ${stock?.name ?? code} 종목을 관심종목에서 삭제했습니다.`);
  };

  const handleToggleWatchlist = (code, candidate = null) => {
    if (isInWatchlist(code)) {
      handleRemoveWatchlist(code);
    } else if (handleAddWatchlist(code, candidate) && candidate) {
      ensureStock(candidate);
    }
  };

  const handleWatchAddSubmit = (e) => {
    e.preventDefault();
    if (!watchAddQuery.trim()) {
      triggerToast('추가할 종목명·종목코드 또는 별칭을 입력해 주세요.');
      return;
    }
    const target = watchAddCandidates.find((s) => !isInWatchlist(s.code));
    if (!target) {
      triggerToast(
        watchAddCandidates.length > 0
          ? '검색된 종목이 이미 모두 관심종목에 등록되어 있습니다.'
          : '일치하는 종목을 찾지 못했습니다.'
      );
      return;
    }
    if (handleAddWatchlist(target.code)) setWatchAddQuery('');
  };

  // 통합 검색 자동완성 선택 핸들러
  const handleSelectSearchStock = (stock) => {
    setSearchQuery('');
    setShowAutocomplete(false);
    navigateToStockDetail(stock.code, 'summary');
  };

  const handleSelectSearchArticle = (article) => {
    const primaryCode = article.relatedStocks[0]?.code || selectedStockCode;
    const targetTab = article.sourceType === 'NEWS' ? 'news' : 'sns';
    setSelectedStockCode(primaryCode);
    setActiveNav('stock');
    setStockViewMode('detail');
    setStockTab(targetTab);
    setSelectedArticleId(article.id);
    setSearchQuery('');
    setShowAutocomplete(false);
    triggerToast(
      `📰 선택한 ${article.sourceType === 'NEWS' ? '뉴스' : 'SNS'} 상세 분석으로 이동했습니다.`
    );
  };

  // 회원가입·로그인 제출 핸들러
  const handleAuthSubmit = (e) => {
    e.preventDefault();
    const id = authForm.username.trim();
    const pw = authForm.password.trim();

    if (!id || !pw) {
      setAuthError('아이디와 비밀번호를 모두 입력해 주세요.');
      return;
    }

    if (authMode === 'signup') {
      if (id.length < 3 || id.length > 20) {
        setAuthError('아이디는 3~20자로 입력해 주세요.');
        return;
      }
      if (pw.length < 4) {
        setAuthError('비밀번호는 4자 이상으로 입력해 주세요.');
        return;
      }
      if (pw !== authForm.passwordConfirm.trim()) {
        setAuthError('비밀번호 확인이 일치하지 않습니다.');
        return;
      }
      if (usersDb[id]) {
        setAuthError('이미 사용 중인 아이디입니다. 다른 아이디를 입력해 주세요.');
        return;
      }
      const nextDb = { ...usersDb, [id]: pw };
      setUsersDb(nextDb);
      try {
        localStorage.setItem('snm_users_db', JSON.stringify(nextDb));
        localStorage.setItem('snm_current_user', id);
      } catch {
        // ignore storage error
      }
      setUser({ username: id });
      setShowAuthModal(false);
      setAuthForm({ username: '', password: '', passwordConfirm: '' });
      setAuthError('');
      triggerToast(`🎉 회원가입 완료! 환영합니다, ${id}님!`);
      return;
    }

    if (!usersDb[id] || usersDb[id] !== pw) {
      setAuthError(
        '아이디 또는 비밀번호가 일치하지 않습니다. (계정이 없다면 회원가입 탭을 이용해 주세요)'
      );
      return;
    }
    try {
      localStorage.setItem('snm_current_user', id);
    } catch {
      // ignore storage error
    }
    setUser({ username: id });
    setShowAuthModal(false);
    setAuthForm({ username: '', password: '', passwordConfirm: '' });
    setAuthError('');
    triggerToast(`👋 환영합니다, ${id}님!`);
  };

  const handleLogout = () => {
    try {
      localStorage.removeItem('snm_current_user');
    } catch {
      // ignore storage error
    }
    setUser(null);
    triggerToast('로그아웃되었습니다.');
  };

  // 종목코드 지정 가능한 종목토론 댓글 추가·공감·삭제 핸들러
  const handleAddCommentForStock = (stockCode, content) => {
    const targetCode = stockCode || selectedStockCode;
    const newComment = {
      commentId: Date.now(),
      id: Date.now(),
      stockCode: targetCode,
      author: user.username,
      content,
      createdAt: nowIsoSeoul(),
      likes: 0,
      likedByMe: false,
    };
    setCommentsByStock((prev) => ({
      ...prev,
      [targetCode]: [newComment, ...(prev[targetCode] || [])],
    }));
    triggerToast('💬 실시간 종목토론 의견이 등록되었습니다.');
  };

  const handleToggleLikeForStock = (stockCode, commentId) => {
    if (!user) {
      requireLogin('🔒 의견 공감은 로그인이 필요합니다.');
      return;
    }
    const targetCode = stockCode || selectedStockCode;
    setCommentsByStock((prev) => ({
      ...prev,
      [targetCode]: (prev[targetCode] || []).map((c) => {
        const cid = c.commentId ?? c.id;
        if (cid !== commentId) return c;
        const nextLiked = !c.likedByMe;
        return {
          ...c,
          likedByMe: nextLiked,
          likes: nextLiked ? (c.likes || 0) + 1 : Math.max(0, (c.likes || 0) - 1),
        };
      }),
    }));
  };

  const handleDeleteCommentForStock = (stockCode, commentId) => {
    const targetCode = stockCode || selectedStockCode;
    setCommentsByStock((prev) => ({
      ...prev,
      [targetCode]: (prev[targetCode] || []).filter(
        (c) => (c.commentId ?? c.id) !== commentId
      ),
    }));
    triggerToast('🗑️ 의견이 삭제되었습니다.');
  };

  const activeNavItem = NAV_ITEMS.find((n) => n.key === activeNav) || NAV_ITEMS[0];

  const commentsProps = {
    key: selectedStockCode,
    stock: selectedStock,
    comments: currentComments,
    user,
    tabKey: stockTab,
    onAdd: (content) => handleAddCommentForStock(selectedStockCode, content),
    onDelete: (cid) => handleDeleteCommentForStock(selectedStockCode, cid),
    onToggleLike: (cid) => handleToggleLikeForStock(selectedStockCode, cid),
    onRequireLogin: requireLogin,
  };

  // ArticleDetail에 공통 전달할 댓글·요약 연동 props
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
  };

  // ---------- 2단 자동완성 드롭다운 렌더링 헬퍼 (#searchResult) ----------
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
          <div className="auto-filter-group">
            {[
              { key: 'ALL', label: '전체 출처' },
              { key: 'NEWS', label: '뉴스' },
              { key: 'SNS', label: 'SNS' },
            ].map((src) => (
              <button
                key={src.key}
                type="button"
                className={`more-link2 ${searchSource === src.key ? 'active' : ''}`}
                onClick={() => setSearchSource(src.key)}
              >
                {src.label}
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
                aria-label={`${s.name} ${isInWatchlist(s.code) ? '관심종목 해제' : '관심종목 추가'
                  }`}
                onClick={() => handleToggleWatchlist(s.code)}
              >
                {isInWatchlist(s.code) ? '★' : '☆'}
              </button>
            </div>
          ))
        )}

        <div className="auto-section-label">📰 매칭 뉴스·SNS 글 (제목·3줄요약·키워드)</div>
        {integratedSearchResults.matchedArticles.length === 0 ? (
          <div className="auto-empty">조건에 일치하는 뉴스·SNS 글이 없습니다.</div>
        ) : (
          integratedSearchResults.matchedArticles.map((art) => (
            <button
              key={art.id}
              type="button"
              className="auto-item"
              onClick={() => handleSelectSearchArticle(art)}
            >
              <span className="auto-article-title">
                <span className={`source-pill ${art.sourceType === 'NEWS' ? 'news' : 'sns'}`}>
                  {art.sourceType}
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

  // ---------- 관심종목 빠른 전환 바 (.quick-switch) ----------
  const renderQuickSwitch = () => {
    const extraStock = isInWatchlist(selectedStock.code) ? null : selectedStock;
    return (
      <nav className="quick-switch" aria-label="관심종목 빠른 전환">
        <span className="quick-label">⚡ 관심종목 퀵 스위치</span>
        <div className="quick-chips">
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
          <button
            type="button"
            className="more-link2"
            onClick={() => setShowWatchModal(true)}
            aria-label="관심종목 관리 열기"
          >
            + 관심종목 관리
          </button>
        </div>
      </nav>
    );
  };

  // ---------- 공통 필터 컨트롤 바 렌더링 헬퍼 ----------
  const renderFilterControlBar = ({
    showChannel = true,
    showWatchToggle = false,
  } = {}) => (
    <div className="content-card control-bar-card">
      <div className="control-bar-row">
        {showChannel && (
          <div className="control-group" role="group" aria-label="채널 필터">
            {[
              { key: 'ALL', label: '전체 채널' },
              { key: 'NEWS', label: '📰 뉴스' },
              { key: 'SNS', label: '💬 SNS' },
            ].map((ch) => (
              <button
                key={ch.key}
                type="button"
                className={`more-link2 ${channelFilter === ch.key ? 'active' : ''}`}
                onClick={() => setChannelFilter(ch.key)}
              >
                {ch.label}
              </button>
            ))}
          </div>
        )}

        <div className="control-group" role="group" aria-label="감성 필터">
          {SENTIMENT_FILTERS.map((sf) => (
            <button
              key={sf.key}
              type="button"
              className={`more-link2 ${sentimentFilter === sf.key ? 'active' : ''}`}
              onClick={() => setSentimentFilter(sf.key)}
            >
              {sf.label}
            </button>
          ))}
        </div>

        <div className="control-group" role="group" aria-label="기간 필터">
          {ARTICLE_PERIODS.map((ap) => (
            <button
              key={ap.key}
              type="button"
              className={`more-link2 ${articlePeriod === ap.key ? 'active' : ''}`}
              onClick={() => setArticlePeriod(ap.key)}
            >
              {ap.label}
            </button>
          ))}
        </div>

        <div className="control-group control-right">
          {showWatchToggle && (
            <button
              type="button"
              className={`more-link2 ${onlyWatchlistArticles ? 'active' : ''}`}
              onClick={() => setOnlyWatchlistArticles((prev) => !prev)}
            >
              ★ 관심종목 글만
            </button>
          )}

          <select
            className="sort-select"
            value={minRelevance}
            onChange={(e) => setMinRelevance(Number(e.target.value))}
            aria-label="최소 관련도 필터"
          >
            {RELEVANCE_OPTIONS.map((opt) => (
              <option key={opt.key} value={opt.key}>
                {opt.label}
              </option>
            ))}
          </select>

          <button
            type="button"
            className={`more-link2 ${articleSort === 'latest' ? 'active' : ''}`}
            onClick={() => setArticleSort('latest')}
          >
            최신순
          </button>
          <button
            type="button"
            className={`more-link2 ${articleSort === 'relevance' ? 'active' : ''}`}
            onClick={() => setArticleSort('relevance')}
          >
            관련도순
          </button>
        </div>
      </div>
    </div>
  );

  // ============================================================================
  // [화면 A] 🏠 홈 (activeNav === 'home')
  // 1. 히어로 통합 검색 + 2. 시장 지수 3단 요약 카드(.market-indices) + 3. 통합 필터 바 + 4. 하단 2단 분할(.split-layout)
  // 우측(.side-stack) 순서: 1순위 [⭐ 나의 관심 종목] (위) -> 2순위 [🔥 오늘의 이슈 종목 TOP 7] (아래)
  // ============================================================================
  const renderHomeView = () => {
    const selectedHomeArticle =
    articleDetails[selectedArticleId] ||
    homeFeedArticles.find((a) => a.id === selectedArticleId) ||
    null;

    return (
      <div className="wrapper">
        {/* 1. 히어로 통합 검색 섹션 */}
        <section className="hero-section">
          <h1 className="hero-title">어떤 종목이나 뉴스를 분석해 드릴까요?</h1>
          <div className="search-box">
            <input
              type="text"
              className="search-input"
              placeholder="종목명, 종목코드, 별칭(삼전) 또는 뉴스 키워드 검색 (예: 삼성전자, HBM3E)"
              aria-label="종목 및 뉴스·SNS 통합 검색"
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
        </section>

        {/* 2. [복원 필수] 시장 지수 3단 요약 카드 (.market-indices > .index-card) */}
        <section className="market-indices" aria-label="시장 지수 3단 요약">
          {MARKET_INDICES_DATA.map((idxItem) => (
            <div key={idxItem.key} className="index-card">
              <div className="index-name">{idxItem.name}</div>
              <div className={`index-value num ${idxItem.tone}`}>{idxItem.value}</div>
              <div className={`index-change num ${idxItem.tone}`}>
                {idxItem.changeText} · <span className="stock-meta">{idxItem.subText}</span>
              </div>
            </div>
          ))}
        </section>

        {/* 3. 통합 필터 컨트롤 바 */}
        {renderFilterControlBar({ showChannel: true, showWatchToggle: true })}

        {/* 4. 하단 2단 분할 레이아웃 (.split-layout) */}
        <div className="split-layout">
          {/* 좌측: 전체 뉴스·SNS 분석 완료 리스트 + 하단 AI/SNS 면책 안내 문구 */}
          <div className="content-card">
            <div className="card-header">
              <div className="card-title">
                📰 실시간 뉴스 × 종목 AI 매칭 소식{' '}
                <span className="count-badge num">{homeFeedArticles.length}</span>
              </div>
              <span className="card-caption">
                글 클릭 시 우측 상세 분석 · #종목칩 클릭 시 종목 상세 화면 이동
              </span>
            </div>

            <ArticleList
              articles={homeFeedArticles}
              selectedId={selectedHomeArticle?.id}
              onSelect={(artId) =>
                setSelectedArticleId((prev) => (prev === artId ? null : artId))
              }
              onSelectStock={(code) => navigateToStockDetail(code, 'summary')}
            />

            <div className="llm-notice feed-footer-notice">
              🤖 안내(N-05): AI(LLM) 요약·감성 분석 및 SNS 게시글(미검증 정보)은 투자 권유가 아니며, 원문과 공시를 반드시 확인해 주세요.
            </div>
          </div>

          {/* 우측 패널(.sticky-detail-panel): 글 미선택 시 [1순위 ⭐ 관심 종목(위) + 2순위 🔥 이슈 종목(아래)](.side-stack), 글 선택 시 ArticleDetail */}
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
                {/* [1순위 - 맨 위 배치] ⭐ 나의 관심 종목 요약 카드 */}
                <div className="content-card">
                  <div className="card-header">
                    <div className="card-title">
                      ⭐ 나의 관심 종목 <span className="count-badge num">{watchlistStocks.length}</span>
                    </div>
                    <button
                      type="button"
                      className="more-link"
                      onClick={() => handleSwitchNav('watchlist')}
                    >
                      관심종목 뉴스·SNS 모아보기 &gt;
                    </button>
                  </div>

                  <form className="watch-add-inline" onSubmit={handleWatchAddSubmit}>
                    <div className="watch-input-wrap">
                      <input
                        type="text"
                        className="watch-inline-input"
                        placeholder="종목명·코드·별칭(삼전) 빠른 추가"
                        aria-label="관심종목 검색 및 추가"
                        value={watchAddQuery}
                        onChange={(e) => setWatchAddQuery(e.target.value)}
                      />
                      {watchAddQuery && (
                        <button
                          type="button"
                          className="clear-search-btn"
                          aria-label="관심종목 검색어 지우기"
                          onClick={() => setWatchAddQuery('')}
                        >
                          ✕
                        </button>
                      )}
                    </div>
                    <button type="submit" className="more-link2 active">
                      + 추가
                    </button>
                  </form>

                  {watchlistStocks.length === 0 ? (
                    <div className="empty-text">등록된 관심 종목이 없습니다.</div>
                  ) : (
                    <table className="stock-table compact-table">
                      <thead>
                        <tr>
                          <th>종목명</th>
                          <th className="num-col">현재가</th>
                          <th className="num-col">등락률</th>
                          <th className="num-col">삭제</th>
                        </tr>
                      </thead>
                      <tbody>
                        {watchlistStocks.map((st) => {
                          const stHasPrice = st.price !== null && st.price !== undefined;
                          const tone = rateTone(st.changeRate);
                          return (
                            <tr
                              key={st.code}
                              tabIndex={0}
                              onClick={() => navigateToStockDetail(st.code, 'summary')}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter' || e.key === ' ') {
                                  e.preventDefault();
                                  navigateToStockDetail(st.code, 'summary');
                                }
                              }}
                            >
                              <td>
                                <strong>{st.name}</strong>
                                <div className="stock-meta num">오늘 {st.todayMatchedCount}건</div>
                              </td>
                              <td className="num-col num">
                                {stHasPrice
                                  ? `${st.price.toLocaleString()}원`
                                  : `${st.todayMatchedCount}건`}
                              </td>
                              <td className={`num-col num ${tone}`}>
                                {stHasPrice
                                  ? formatRate(st.changeRate)
                                  : `긍정 ${st.sentimentRatio.positive}%`}
                              </td>
                              <td className="num-col">
                                <button
                                  type="button"
                                  className="remove-btn"
                                  aria-label={`${st.name} 관심종목에서 삭제`}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleRemoveWatchlist(st.code);
                                  }}
                                >
                                  ✕
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  )}
                </div>

                {/* [2순위 - 아래 배치] 🔥 오늘의 이슈 종목 TOP 7 */}
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
                        <th className="num-col">매칭</th>
                      </tr>
                    </thead>
                    <tbody>
                      {homeRankedStocks.map((st, idx) => {
                        const stHasPrice = st.price !== null && st.price !== undefined;
                        const tone = rateTone(st.changeRate);
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
                              {stHasPrice ? `${st.price.toLocaleString()}원` : '-'}
                            </td>
                            <td className={`num-col num ${tone}`}>
                              {stHasPrice
                                ? formatRate(st.changeRate)
                                : `긍정 ${st.sentimentRatio.positive}%`}
                            </td>
                            <td className="num-col num">
                              <strong>{st.todayMatchedCount}건</strong>
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
              </div>
            )}
          </aside>
        </div>
      </div>
    );
  };

  // ============================================================================
  // [화면 B] 📊 종목 (activeNav === 'stock')
  // - 목록 모드 (stockViewMode === 'list'): 종목 찾기 및 전체 종목 순위/시세 테이블
  // - 상세 모드 (stockViewMode === 'detail'): 퀵 스위치 + 종목 헤더 + 5개 가로 탭 (.stock-tabs)
  // ============================================================================
  const renderStockView = () => {
    // 1. 목록 모드 (종목 찾기)
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
              </div>
            </div>

            <div className="watch-add-inline">
              <div className="watch-input-wrap">
                <input
                  type="text"
                  className="watch-inline-input"
                  placeholder="찾으실 종목명, 종목코드(6자리), 별칭(삼전, 하닉) 또는 테마 검색..."
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
                  <th className="num-col">오늘 매칭</th>
                  <th className="num-col">AI 감성</th>
                  <th className="num-col">관심</th>
                </tr>
              </thead>
              <tbody>
                {filteredStockList.map((st, idx) => {
                  const stHasPrice = st.price !== null && st.price !== undefined;
                  const tone = rateTone(st.changeRate);
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
                        <span className="stock-meta">#{st.themes.slice(0, 2).join(' #')}</span>
                      </td>
                      <td className="num-col num">
                        {stHasPrice ? `${st.price.toLocaleString()}원` : '-'}
                      </td>
                      <td className={`num-col num ${tone}`}>
                        {stHasPrice ? (
                          <RatePill rate={st.changeRate} size="sm" />
                        ) : (
                          <span className="stock-meta">시세 대기</span>
                        )}
                      </td>
                      <td className="num-col num">
                        <strong>{st.todayMatchedCount}건</strong>
                      </td>
                      <td className="num-col">
                        <span className="trend-badge trend-up num">
                          긍정 {st.sentimentRatio.positive}%
                        </span>
                      </td>
                      <td className="num-col">
                        <button
                          type="button"
                          className="star-btn"
                          aria-label={`${st.name} ${isInWatchlist(st.code) ? '관심종목 해제' : '관심종목 추가'
                            }`}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleToggleWatchlist(st.code);
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

    // 2. 상세 모드 (stockViewMode === 'detail' - 개별 종목 화면)
    const hasPrice = selectedStock.price !== null && selectedStock.price !== undefined;
    const selTone = rateTone(selectedStock.changeRate);
    const activeStockArticle =
      stockFeedArticles.find((a) => a.id === selectedArticleId) || stockFeedArticles[0] || null;

    const totalNews = trendSeries.reduce((sum, pt) => sum + (pt.news || 0), 0);
    const totalSns = trendSeries.reduce((sum, pt) => sum + (pt.sns || 0), 0);
    const grandTotal = totalNews + totalSns;
    const maxRowTotal = Math.max(
      ...trendSeries.map((pt) => (pt.news || 0) + (pt.sns || 0)),
      1
    );

    return (
      <div className="wrapper">
        {/* 상단 관심 종목 퀵 스위치 바 */}
        {renderQuickSwitch()}

        {/* 종목 헤더 카드 (.stock-head-card) + ← 종목 찾기 버튼 */}
        <section className="content-card stock-head-card">
          <div className="stock-head-top">
            <div className="stock-head-left">
              <button
                type="button"
                className="more-link2"
                onClick={() => setStockViewMode('list')}
              >
                ← 종목 찾기 (전체 목록)
              </button>
              <div className="stock-head-title-row">
                <h2 className="stock-head-name">{selectedStock.name}</h2>
                <span className="stock-code num">{selectedStock.code}</span>
                <span className="source-pill">{selectedStock.market}</span>
                <span className="source-pill">{selectedStock.sector}</span>
                {selectedStock.aliases?.length > 0 && (
                  <span className="stock-meta">
                    별칭: {selectedStock.aliases.slice(0, 3).join(', ')}
                  </span>
                )}
              </div>
              <div className="theme-tags">
                {selectedStock.themes.map((t) => (
                  <span key={t} className="theme-tag">
                    #{t}
                  </span>
                ))}
              </div>
            </div>

            <div className="stock-head-right">
              <div className="stock-head-price num">
                {hasPrice ? (
                  <>
                    <span className={`price-large ${selTone}`}>
                      {selectedStock.price.toLocaleString()}원
                    </span>
                    <RatePill rate={selectedStock.changeRate} size="lg" />
                  </>
                ) : (
                  <span className="price-large">
                    오늘 매칭 {selectedStock.todayMatchedCount}건
                  </span>
                )}
              </div>
              <div className="stock-head-stats num">
                <span>오늘 뉴스 {todayCounts.news}건</span>
                <span>·</span>
                <span>SNS {todayCounts.sns}건</span>
                <span>·</span>
                <span>최근 매칭 {selectedStock.lastMatchedAt}</span>
                <button
                  type="button"
                  className={`more-link2 ${isInWatchlist(selectedStock.code) ? 'active' : ''}`}
                  onClick={() => handleToggleWatchlist(selectedStock.code)}
                >
                  {isInWatchlist(selectedStock.code) ? '★ 관심종목 등록됨' : '☆ 관심종목 추가'}
                </button>
              </div>
            </div>
          </div>

          {/* 종목 내부 가로 탭 바 (.stock-tabs) */}
          <div className="stock-tabs" role="tablist" aria-label="종목 상세 분석 탭">
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

        {/* [탭 1] 요약·감성 (summary) */}
        {stockTab === 'summary' && (
          <>
            <div className="content-card">
              <div className="card-header">
                <div className="card-title">
                  🤖 {selectedStock.name} 오늘의 AI 종합 요약 & 감성 비율 (F-06)
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
                <SentimentBar ratio={currentSummary.sentimentRatio} />
                <div className="llm-notice">
                  🤖 안내(N-05): AI(LLM)가 생성한 요약 및 감성 분석 결과는 원문과 차이가 있거나 오류가 있을 수 있습니다.
                </div>
              </div>

              {/* [복원 필수] 뉴스 핵심 요약(newsSummary) vs SNS 커뮤니티 요약(snsSummary) 구분 박스 */}
              <div className="summary-compare-grid">
                <div className="summary-compare-box">
                  <div className="summary-compare-head">
                    <span className="source-pill news">📰 당일 뉴스 핵심 요약</span>
                    <button
                      type="button"
                      className="more-link"
                      onClick={() => setStockTab('news')}
                    >
                      뉴스 모아보기 ({todayCounts.news}건) &gt;
                    </button>
                  </div>
                  <p>{currentSummary.newsSummary || '당일 뉴스 요약 준비 중입니다.'}</p>
                </div>

                <div className="summary-compare-box">
                  <div className="summary-compare-head">
                    <span className="source-pill sns">
                      💬 당일 SNS·커뮤니티 반응 요약 (⚠️ 미검증 참고용)
                    </span>
                    <button
                      type="button"
                      className="more-link"
                      onClick={() => setStockTab('sns')}
                    >
                      SNS 모아보기 ({todayCounts.sns}건) &gt;
                    </button>
                  </div>
                  <p>{currentSummary.snsSummary || '당일 SNS 반응 요약 준비 중입니다.'}</p>
                </div>
              </div>
            </div>

            <div className="dashboard-grid">
              {/* 좌측: 시간대별 언급량 미니 차트 */}
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

              {/* 우측: 최근 실시간 토론 미리보기 */}
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

        {/* [탭 2 & 3] 뉴스 (news) / SNS (sns) 모아보기 및 우측 상세 패널(하단 댓글 포함) */}
        {(stockTab === 'news' || stockTab === 'sns') && (
          <>
            {stockTab === 'sns' && (
              <div className="sns-warning-inline" role="alert">
                ⚠️ <strong>참고용 · 확인되지 않은 정보 (N-05):</strong> SNS 블로그·카페 게시글은 사실 여부가 검증되지 않았으므로 투자 판단 시 원문과 공시를 반드시 확인해 주세요.
              </div>
            )}

            {renderFilterControlBar({ showChannel: false, showWatchToggle: false })}

            <div className="split-layout">
              <div className="content-card">
                <div className="card-header">
                  <div className="card-title">
                    {stockTab === 'news'
                      ? `📰 ${selectedStock.name} 매칭 뉴스 모아보기`
                      : `💬 ${selectedStock.name} 매칭 SNS 모아보기`}{' '}
                    <span className="count-badge num">{stockFeedArticles.length}</span>
                  </div>
                </div>
                <ArticleList
                  articles={stockFeedArticles}
                  selectedId={activeStockArticle?.id}
                  onSelect={setSelectedArticleId}
                  onSelectStock={(code) => navigateToStockDetail(code, stockTab)}
                />
              </div>

              <aside className="panel sticky-detail-panel" aria-label="종목 기사 상세 패널">
                <ArticleDetail
                  {...detailSharedProps}
                  article={activeStockArticle}
                  onSelectStock={(code) => navigateToStockDetail(code, 'summary')}
                  onSelectArticle={(artId) => {
                    setStockTab('sns');
                    setSelectedArticleId(artId);
                  }}
                />
              </aside>
            </div>
          </>
        )}

        {/* [탭 4] 언급량 추이 (mention) */}
        {stockTab === 'mention' && (
          <>
            <div className="content-card">
              <div className="card-header">
                <div className="card-title">
                  📈 {selectedStock.name} ({selectedStock.code}) 뉴스·SNS 언급량 추이 차트
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
              <MentionTrendChart series={trendSeries} plotHeight={250} />
            </div>

            <div className="dashboard-grid">
              <div className="content-card">
                <div className="card-header">
                  <div className="card-title">구간별 언급량 상세 수치표</div>
                </div>
                <table className="stock-table">
                  <thead>
                    <tr>
                      <th>구간</th>
                      <th className="num-col">뉴스</th>
                      <th className="num-col">SNS</th>
                      <th className="num-col total-col">합계 · 비중</th>
                    </tr>
                  </thead>
                  <tbody>
                    {trendSeries.map((pt) => {
                      const rowTotal = (pt.news || 0) + (pt.sns || 0);
                      const share = grandTotal > 0 ? (rowTotal / grandTotal) * 100 : 0;
                      return (
                        <tr
                          key={pt.label}
                          className={rowTotal === maxRowTotal && rowTotal > 0 ? 'peak-row' : ''}
                        >
                          <td className="num">{pt.label}</td>
                          <td className="num-col num">{pt.news.toLocaleString()}건</td>
                          <td className="num-col num">{pt.sns.toLocaleString()}건</td>
                          <td className="num-col total-col">
                            <div className="gauge-cell">
                              <div className="gauge-track" title={`비중 ${formatPercent(share)}`}>
                                <div
                                  className="gauge-fill"
                                  style={{ width: `${(rowTotal / maxRowTotal) * 100}%` }}
                                />
                              </div>
                              <b className="num">{rowTotal.toLocaleString()}건</b>
                              <span className="gauge-share num">{formatPercent(share)}</span>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr>
                      <td>
                        <strong>총합계</strong>
                      </td>
                      <td className="num-col num">
                        <strong>{totalNews.toLocaleString()}건</strong>
                      </td>
                      <td className="num-col num">
                        <strong>{totalSns.toLocaleString()}건</strong>
                      </td>
                      <td className="num-col total-col">
                        <div className="gauge-cell">
                          <span />
                          <b className="num">{grandTotal.toLocaleString()}건</b>
                          <span className="gauge-share num">100.0%</span>
                        </div>
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>

              <div className="content-card">
                <div className="card-header">
                  <div className="card-title">종목 이슈 요약 & 감성 비율</div>
                </div>
                <div className="ai-card">
                  <p className="ai-card-headline">{currentSummary.headline}</p>
                  <p className="ai-card-body">{currentSummary.summary}</p>
                  <SentimentBar ratio={currentSummary.sentimentRatio} />
                </div>
              </div>
            </div>
          </>
        )}

        {/* [탭 5] 종목 토론 (board) */}
        {stockTab === 'board' && <StockComments {...commentsProps} />}
      </div>
    );
  };

  // ============================================================================
  // [화면 C] ⭐ 관심 종목 (activeNav === 'watchlist')
  // - 상단: 관심 종목 추가/삭제 폼 및 관리 테이블
  // - 하단: 내 관심 종목 뉴스·SNS 모아보기 + 우측 상세 패널 (스크롤 하단 댓글 작성 기능 활성화)
  // ============================================================================
  const renderWatchlistView = () => {
    const activeWatchArticle =
      watchlistFeedArticles.find((a) => a.id === selectedArticleId) ||
      watchlistFeedArticles[0] ||
      null;

    return (
      <div className="wrapper">
        {/* 상단: 내 관심 종목 추가/삭제 테이블 */}
        <section className="content-card">
          <div className="card-header">
            <div className="card-title">
              ⭐ 나의 관심 종목 관리 테이블{' '}
              <span className="count-badge num">{watchlistStocks.length}</span>
            </div>
            <div className="header-btn-group">
              <button
                type="button"
                className="more-link2 active"
                onClick={() => setShowWatchModal(true)}
              >
                + 전체 종목에서 검색·추가
              </button>
            </div>
          </div>

          <form className="watch-add-inline" onSubmit={handleWatchAddSubmit}>
            <div className="watch-input-wrap">
              <input
                type="text"
                className="watch-inline-input"
                placeholder="관심종목 빠른 추가: 종목명, 종목코드(6자리), 별칭(삼전, 하닉) 입력 후 Enter"
                aria-label="관심종목 빠른 추가 입력"
                value={watchAddQuery}
                onChange={(e) => setWatchAddQuery(e.target.value)}
              />
              {watchAddQuery && (
                <button
                  type="button"
                  className="clear-search-btn"
                  aria-label="관심종목 검색어 지우기"
                  onClick={() => setWatchAddQuery('')}
                >
                  ✕
                </button>
              )}
            </div>
            <button type="submit" className="btn-primary">
              + 관심종목 추가
            </button>
          </form>

          {watchlistStocks.length === 0 ? (
            <div className="empty-text">
              등록된 관심 종목이 없습니다. 위 검색창에서 종목을 추가하면 아래에 내 관심 종목 뉴스·SNS 모아보기가 표시됩니다.
            </div>
          ) : (
            <table className="stock-table">
              <thead>
                <tr>
                  <th>종목명 (클릭 시 상세 이동)</th>
                  <th>시장 · 업종 · 테마</th>
                  <th className="num-col">현재가</th>
                  <th className="num-col">등락률</th>
                  <th className="num-col">오늘 매칭</th>
                  <th className="num-col">AI 감성</th>
                  <th className="num-col">삭제</th>
                </tr>
              </thead>
              <tbody>
                {watchlistStocks.map((st) => {
                  const stHasPrice = st.price !== null && st.price !== undefined;
                  const tone = rateTone(st.changeRate);
                  return (
                    <tr
                      key={st.code}
                      tabIndex={0}
                      onClick={() => navigateToStockDetail(st.code, 'summary')}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          navigateToStockDetail(st.code, 'summary');
                        }
                      }}
                    >
                      <td>
                        <strong>{st.name}</strong>{' '}
                        <span className="stock-code num">{st.code}</span>
                      </td>
                      <td>
                        <span className="source-pill">{st.market}</span> {st.sector} ·{' '}
                        <span className="stock-meta">#{st.themes.slice(0, 2).join(' #')}</span>
                      </td>
                      <td className="num-col num">
                        {stHasPrice ? `${st.price.toLocaleString()}원` : '-'}
                      </td>
                      <td className={`num-col num ${tone}`}>
                        {stHasPrice ? (
                          <RatePill rate={st.changeRate} size="sm" />
                        ) : (
                          <span className="stock-meta">시세 대기</span>
                        )}
                      </td>
                      <td className="num-col num">
                        <strong>{st.todayMatchedCount}건</strong>
                      </td>
                      <td className="num-col">
                        <span className="trend-badge trend-up num">
                          긍정 {st.sentimentRatio.positive}%
                        </span>
                      </td>
                      <td className="num-col">
                        <button
                          type="button"
                          className="remove-btn"
                          aria-label={`${st.name} 관심종목에서 삭제`}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleRemoveWatchlist(st.code);
                          }}
                        >
                          ✕
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </section>

        {/* 하단: 내 관심 종목 뉴스·SNS 모아보기 + 우측 상세 패널(하단 스크롤 댓글 활성화) */}
        {renderFilterControlBar({ showChannel: true, showWatchToggle: false })}

        <div className="split-layout">
          <div className="content-card">
            <div className="card-header">
              <div className="card-title">
                📰 내 관심 종목 뉴스·SNS 모아보기{' '}
                <span className="count-badge num">{watchlistFeedArticles.length}</span>
              </div>
              <span className="card-caption">
                관심 종목과 매칭된 뉴스·SNS 소식을 선택하면 우측에서 요약·근거 확인 및 댓글 작성이 가능합니다
              </span>
            </div>

            <ArticleList
              articles={watchlistFeedArticles}
              selectedId={activeWatchArticle?.id}
              onSelect={setSelectedArticleId}
              onSelectStock={(code) => navigateToStockDetail(code, 'summary')}
            />
          </div>

          <aside className="panel sticky-detail-panel" aria-label="관심종목 기사 상세 및 댓글 패널">
            <ArticleDetail
              {...detailSharedProps}
              article={activeWatchArticle}
              onSelectStock={(code) => navigateToStockDetail(code, 'summary')}
              onSelectArticle={(artId) => setSelectedArticleId(artId)}
            />
          </aside>
        </div>
      </div>
    );
  };

  return (
    <div className="app-shell">
      {/* 1. 왼쪽 사이드바 네비게이션 (펼침 200px: 브랜드명+메뉴명 / 접힘 64px: .nav-logo 배지+아이콘만 표시) */}
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
      </nav>

      <div className="main-area">
        {/* 2. 상단 헤더 (로고 + 현재 위치 배지 + 홈이 아닐 때 중앙 컴팩트 통합 검색창 + 상태/로그인) */}
        <header className="top-header">
          <div className="header-content">
            <div
              className="logo"
              onClick={() => handleSwitchNav('home')}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') handleSwitchNav('home');
              }}
            >
              StockNews AI{' '}
              <span className="brand-sub">
                {activeNav === 'stock'
                  ? stockViewMode === 'list'
                    ? '📊 전체 종목 탐색'
                    : `📊 ${selectedStock.name} (${selectedStock.code})`
                  : activeNavItem.title}
              </span>
            </div>

            {activeNav !== 'home' && (
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
            )}

            <div className="user-actions">
              <span className="live-indicator CONNECTED">
                <span className="live-dot" aria-hidden="true" />
                AI 실시간 매칭
              </span>
              <button
                type="button"
                className="feed-badge"
                title="클릭하여 시세·뉴스 데이터 새로고침"
                aria-label="데이터 새로고침"
                onClick={handleRefreshData}
              >
                <span>
                  최근 갱신 <b className="num">{sysStatus.lastUpdated.quote}</b>
                </span>
                <span>🔄</span>
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

        {/* 3. 메인 콘텐츠 영역 */}
        <main className="main-content" ref={mainRef}>
          {activeNav === 'home' && renderHomeView()}
          {activeNav === 'stock' && renderStockView()}
          {activeNav === 'watchlist' && renderWatchlistView()}
        </main>
      </div>

      {/* 토스트 알림 팝업 */}
      {toast && (
        <div key={toast.id} className="toast-popup" role="status" aria-live="polite">
          {toast.text}
        </div>
      )}

      {/* 관심종목 관리 모달 */}
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
                placeholder="종목명, 종목코드(6자리), 별칭(삼전, 하닉) 검색..."
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
                      onClick={() => handleToggleWatchlist(s.code)}
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

      {/* 회원가입·로그인 통합 모달 (F-16, N-03) */}
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
                {authMode === 'login' ? '🔐 로그인' : '✨ 회원가입'}
              </h3>
              <button
                type="button"
                className="remove-btn"
                aria-label="로그인 모달 닫기"
                onClick={() => setShowAuthModal(false)}
              >
                ✕
              </button>
            </div>

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

            <p className="card-caption">
              대시보드 조회는 로그인 없이 가능하며, 관심종목 저장 및 종목토론 작성·공감 시 로그인이 필요합니다.
            </p>

            {authError && (
              <div className="sns-warning-inline" role="alert">
                {authError}
              </div>
            )}

            <form className="comment-form" onSubmit={handleAuthSubmit}>
              <input
                type="text"
                className="watch-inline-input"
                placeholder="아이디 (예: tester01)"
                aria-label="아이디"
                value={authForm.username}
                onChange={(e) => setAuthForm({ ...authForm, username: e.target.value })}
                required
              />
              <input
                type="password"
                className="watch-inline-input"
                placeholder="비밀번호"
                aria-label="비밀번호"
                value={authForm.password}
                onChange={(e) => setAuthForm({ ...authForm, password: e.target.value })}
                required
              />
              {authMode === 'signup' && (
                <input
                  type="password"
                  className="watch-inline-input"
                  placeholder="비밀번호 확인"
                  aria-label="비밀번호 확인"
                  value={authForm.passwordConfirm}
                  onChange={(e) =>
                    setAuthForm({ ...authForm, passwordConfirm: e.target.value })
                  }
                  required
                />
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
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

// src/pages/DashboardPageV7.jsx
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
import { stockApi, quoteApi, articleApi, watchlistApi, authApi } from '../api';
import { toUiStock, toUiArticle } from '../api/adapters';
import '../styles/dashboardV7.css';

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
  board: { label: '뉴스', clasame: 'tag-news' },
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

// [V7] A3: 중립은 배지를 표시하지 않고, 오직 호재/악재만 색상 배지로 표시
function SentimentBadge({ sentiment }) {
  if (!sentiment) return null;
  const norm = String(sentiment).toUpperCase().trim();
  if (norm === 'POSITIVE' || norm === '긍정') {
    return <span className="trend-badge trend-up">호재 · 긍정</span>;
  }
  if (norm === 'NEGATIVE' || norm === '부정') {
    return <span className="trend-badge trend-down">악재 · 부정</span>;
  }
  return null;
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

// 언급량 추이 막대그래프
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

// [V7] A6: "총 N건 · n / N 페이지"와 번호 버튼을 한 묶음으로 가운데 정렬
function Pagination({ currentPage, totalPages, totalItems, onPageChange }) {
  if (totalPages <= 1) {
    if (totalItems > 0) {
      return (
        <div className="pagination-bar">
          <div className="pagination-group">
            <span className="pagination-info num">총 {totalItems}건 · 1 / 1 페이지</span>
          </div>
        </div>
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
      <div className="pagination-group">
        <span className="pagination-info num">
          총 {totalItems}건 · {currentPage} / {totalPages} 페이지
        </span>
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

// [V7] A3, D3: 감성 배지를 메타 맨 앞(NEWS 옆)으로 배치, 중립 배지 숨김, 첫 로딩 중 스켈레톤 3개
function ArticleList({ articles, selectedId, onSelect, onSelectStock, loading = false }) {
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
        const isSns = art.sourceType !== 'NEWS';
        const topStocks = [...(art.relatedStocks || [])]
          .sort((a, b) => b.relevance - a.relevance)
          .slice(0, 3);

        const normSent = art.sentiment ? String(art.sentiment).toUpperCase().trim() : null;
        const isPos = normSent === 'POSITIVE' || normSent === '긍정';
        const isNeg = normSent === 'NEGATIVE' || normSent === '부정';

        const sentBorderClass = isPos
          ? 'sent-border-pos'
          : isNeg
            ? 'sent-border-neg'
            : 'sent-border-none';

        const sentBadge = isPos
          ? { label: '호재', cls: 'trend-up' }
          : isNeg
            ? { label: '악재', cls: 'trend-down' }
            : null;

        return (
          <article
            key={art.id}
            className={`article-item ${sentBorderClass} ${selectedId === art.id ? 'selected' : ''}`}
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
                <span className={`source-pill ${isSns ? 'sns' : 'news'}`}>
                  {isSns ? 'SNS' : 'NEWS'}
                </span>
                {sentBadge && (
                  <span className={`trend-badge ${sentBadge.cls}`}>
                    {sentBadge.label}
                  </span>
                )}
                <span className="article-press-time num">
                  {art.press} · {art.publishedAt}
                </span>
              </div>
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
  const resolvedDefaultTag =
    tabKey === 'sns' ? 'sns' : tabKey === 'mention' ? 'mention' : 'news';

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

// 우측 글 상세 패널
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

  const [commentTargetCode, setCommentTargetCode] = useState(
    preferredStockCode || sortedRelatedStocks[0]?.code || '005930'
  );

  useEffect(() => {
    if (!article) return;

    const hasPreferred = sortedRelatedStocks.some(
      (r) => r.code === preferredStockCode
    );

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
        {articleSentimentRatio && (
          <SentimentBar ratio={articleSentimentRatio} />
        )}
        <div className="llm-notice">
          🤖 AI(LLM) 요약 및 감성 분석 결과는 원문과 차이가 있을 수 있습니다.
        </div>
      </div>

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
                        <QuotePrice price={st?.price} />
                      </td>

                      <td className="num-col num">
                        <QuoteRate rate={st?.changeRate} size="sm" />
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
                    <strong>근거 원문:</strong> {rel.evidence?.trim() || ''}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

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

    quoteApi.chart(stockCode, unit, {
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
  const [selectedStockCode, setSelectedStockCode] = useState(
    INITIAL_WATCHLIST_CODES[0] || '005930'
  );
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
  const [minRelevance, setMinRelevance] = useState(0);
  const [articleSort, setArticleSort] = useState('latest');
  const [onlyWatchlistArticles, setOnlyWatchlistArticles] = useState(false);
  const [expandedSummaryBox, setExpandedSummaryBox] = useState({ news: false, sns: false });

  const mockStocks = useMemo(
    () => normalizeStocks(STOCKS_DATA, STOCK_SUMMARIES_DATA, MENTION_TRENDS_DATA),
    []
  );

  const [apiStocks, setApiStocks] = useState([]);
  const [liveQuotes, setLiveQuotes] = useState({});

  const allStocks = useMemo(
    () =>
      [...mockStocks, ...apiStocks].map((stock) => {
        const quote = liveQuotes[stock.code];
        const hasLive = quote && quote.price !== null && quote.price !== undefined;
        return {
          ...stock,
          price: hasLive ? quote.price : null,
          changeRate: hasLive ? quote.changeRate : null,
          changeAmount: hasLive ? quote.changeAmount : null,
        };
      }),
    [mockStocks, apiStocks, liveQuotes]
  );

  // 💡 selectedStock 변수 정의 (allStocks가 정의된 이후 안전하게 선언)
  const stockByCode = (code) => allStocks.find((s) => s.code === code);
  const selectedStock = stockByCode(selectedStockCode) || allStocks[0];

  const [allArticles, setAllArticles] = useState([]);
  const [feedBooted, setFeedBooted] = useState(false);

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
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setFeedBooted(true);
        }
      });
    return () => controller.abort();
  }, []);

  const initialSummaries = useMemo(() => normalizeSummaries(STOCK_SUMMARIES_DATA), []);
  const initialTrends = useMemo(() => normalizeMentionTrends(MENTION_TRENDS_DATA), []);

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
  const [searchSource, setSearchSource] = useState('ALL');
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
          sns: Number(item.snsCount || 0),
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

  const [sysStatus, setSysStatus] = useState(INITIAL_SYSTEM_STATUS);
  const [summariesByStock, setSummariesByStock] = useState(initialSummaries);
  const [regenerating, setRegenerating] = useState(false);

  const [user, setUser] = useState(null);
  useEffect(() => {
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
  const [authMode, setAuthMode] = useState('login');
  const [authForm, setAuthForm] = useState({
    username: '',
    password: '',
    passwordConfirm: '',
  });
  const [authError, setAuthError] = useState('');
  const [toast, setToast] = useState(null);

  const [commentsByStock, setCommentsByStock] = useState(() =>
    normalizeComments(INITIAL_STOCK_COMMENTS)
  );

  const mainRef = useRef(null);
  const triggerToast = (msg) => setToast({ id: Date.now(), text: msg });

  useEffect(() => {
    setHomePage(1);
  }, [
    sentimentFilter,
    channelFilter,
    articlePeriod,
    minRelevance,
    articleSort,
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
    minRelevance,
    articleSort,
    selectedStock?.code,
    stockTab,
  ]);

  const watchlistStocks = useMemo(
    () => watchlistCodes.map(stockByCode).filter(Boolean),
    [watchlistCodes, allStocks]
  );

  useEffect(() => {
    setWatchlistArticlesPage(1);
  }, [
    sentimentFilter,
    channelFilter,
    articlePeriod,
    minRelevance,
    articleSort,
    watchlistStocks.length,
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
      watchlistFeedRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
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

  useEffect(() => {
    if (!user) {
      setWatchlistCodes([]);
      return;
    }
    let cancelled = false;
    watchlistApi.list()
      .then((res) => {
        if (cancelled) return;
        const codes = (res.items || []).map((item) => item.stockCode);
        setWatchlistCodes(codes);
      })
      .catch((error) => {
        if (cancelled) return;
        console.error('관심 종목 목록 조회 실패:', error);
        triggerToast('관심 종목 목록을 불러오지 못했습니다.');
      });
    return () => {
      cancelled = true;
    };
  }, [user]);

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

  const matchStockByQuery = (stock, q) =>
    stock.name.toLowerCase().includes(q) ||
    stock.code.includes(q) ||
    stock.aliases.some((al) => al.toLowerCase().includes(q)) ||
    stock.themes.some((th) => th.toLowerCase().includes(q));

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
  }, [remoteStockResult, liveQuotes]);

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

    const remote =
      remoteStockResult && remoteStockResult.q.toLowerCase() === q ? remoteStockResult.items : null;

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
  }, [searchQuery, searchPeriod, searchSource, allStocks, allArticles, remoteStockResult, liveQuotes]);

  const watchAddCandidates = useMemo(() => {
    const q = watchAddQuery.trim().toLowerCase();
    if (!q) return allStocks.slice(0, 8);
    return allStocks.filter((s) => matchStockByQuery(s, q)).slice(0, 8);
  }, [watchAddQuery, allStocks]);

  const notReadySummary = {
    updatedAt: '-',
    headline: `${selectedStock.name} AI 요약 준비 중`,
    summary: '이 종목은 아직 AI 요약이 연결되지 않았습니다.',
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

  const trendSeries = mentionSeries;

  const todayCounts = useMemo(
    () =>
      (currentTrendToday() || []).reduce(
        (acc, pt) => ({ news: acc.news + (pt.news || 0), sns: acc.sns + (pt.sns || 0) }),
        { news: 0, sns: 0 }
      ),
    [selectedStockCode]
  );

  function currentTrendToday() {
    return initialTrends[selectedStockCode]?.today || initialTrends.default?.today || [];
  }

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

  useEffect(() => {
    if (
      activeNav !== 'stock' ||
      stockViewMode !== 'detail' ||
      (stockTab !== 'news' && stockTab !== 'sns')
    ) {
      return;
    }

    const controller = new AbortController();
    const source = stockTab === 'sns' ? 'SNS' : 'NEWS';

    articleApi
      .list(
        {
          stockCode: selectedStockCode,
          source,
          page: 1,
          size: 30,
        },
        { signal: controller.signal }
      )
      .then((res) => {
        const articles = (res.items || []).map(toUiArticle);
        setAllArticles((prev) => {
          const merged = new Map(
            prev.map((article) => [String(article.id), article])
          );
          articles.forEach((article) => {
            merged.set(String(article.id), article);
          });
          return [...merged.values()];
        });
      })
      .catch((err) => {
        if (err.name !== 'AbortError') {
          console.error('종목별 뉴스 조회 실패:', err);
        }
      });

    return () => controller.abort();
  }, [activeNav, stockViewMode, stockTab, selectedStockCode]);

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

  const requireLogin = (msg) => {
    triggerToast(msg);
    setAuthMode('login');
    setAuthError(msg);
    setShowAuthModal(true);
  };

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

  const handleAddWatchlist = async (code, candidate = null) => {
    if (!user) {
      requireLogin('관심종목 추가는 로그인이 필요합니다.');
      return false;
    }
    const stock = stockByCode(code) || candidate;
    if (!stock) return false;

    if (watchlistCodes.includes(code)) {
      triggerToast(`이미 관심종목에 등록된 종목입니다: ${stock.name}`);
      return false;
    }

    try {
      await watchlistApi.add(code);
      setWatchlistCodes((prev) =>
        prev.includes(code) ? prev : [code, ...prev]
      );
      triggerToast(`★ ${stock.name}(${code}) 관심종목에 추가했습니다.`);
      return true;
    } catch (error) {
      console.error('관심종목 등록 실패:', error);
      triggerToast('관심종목 등록에 실패했습니다.');
      return false;
    }
  };

  const handleRemoveWatchlist = async (code) => {
    if (!user) {
      requireLogin('관심종목 삭제는 로그인이 필요합니다.');
      return;
    }
    const stock = stockByCode(code);
    try {
      await watchlistApi.remove(code);
      setWatchlistCodes((prev) =>
        prev.filter((c) => c !== code)
      );
      triggerToast(`☆ ${stock?.name ?? code} 관심종목에서 삭제했습니다.`);
    } catch (error) {
      console.error('관심종목 삭제 실패:', error);
      triggerToast('관심종목 삭제에 실패했습니다.');
    }
  };

  const handleToggleWatchlist = async (code, candidate = null) => {
    if (isInWatchlist(code)) {
      await handleRemoveWatchlist(code);
    } else {
      const added = await handleAddWatchlist(code, candidate);
      if (added && candidate) {
        // ensure stock if needed
      }
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
    handleAddWatchlist(target.code).then((added) => {
      if (added) setWatchAddQuery('');
    });
  };

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
        if (id.length < 3 || id.length > 20) {
          setAuthError('아이디는 3~20자로 입력해 주세요.');
          return;
        }
        if (pw.length < 4) {
          setAuthError('비밀번호는 4자 이상으로 입력해 주세요.');
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
      setAuthError(
        authMode === 'signup'
          ? '회원가입 또는 로그인에 실패했습니다. 입력 정보와 서버 상태를 확인해 주세요.'
          : '로그인에 실패했습니다. 아이디와 비밀번호를 확인해 주세요.'
      );
    }
  };

  const handleLogout = () => {
    authApi.logout();
    localStorage.removeItem('snm_current_user');
    setUser(null);
    setWatchlistCodes([]);
    triggerToast('로그아웃되었습니다.');
  };

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
                aria-label={`${s.name} ${isInWatchlist(s.code) ? '관심종목 해제' : '관심종목 추가'}`}
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

  const renderFilterControlBar = ({
    showChannel = true,
    showWatchToggle = false,
  } = {}) => {
    let activeSubFilterCount = 0;
    if (sentimentFilter !== 'ALL') activeSubFilterCount += 1;
    if (articlePeriod !== 'ALL') activeSubFilterCount += 1;
    if (minRelevance !== 0) activeSubFilterCount += 1;

    return (
      <div className="content-card control-bar-card">
        <div className="control-bar-main-row">
          <div className="control-left-cluster">
            {showChannel && (
              <div className="seg-group" role="group" aria-label="채널 필터">
                {[
                  { key: 'ALL', label: '전체 채널' },
                  { key: 'NEWS', label: '📰 뉴스' },
                  { key: 'SNS', label: '💬 SNS' },
                ].map((ch) => (
                  <button
                    key={ch.key}
                    type="button"
                    className={`more-link2 seg-btn ${channelFilter === ch.key ? 'active' : ''}`}
                    onClick={() => setChannelFilter(ch.key)}
                  >
                    {ch.label}
                  </button>
                ))}
              </div>
            )}

            <div className="seg-group" role="group" aria-label="정렬 옵션">
              <button
                type="button"
                className={`more-link2 seg-btn ${articleSort === 'latest' ? 'active' : ''}`}
                onClick={() => setArticleSort('latest')}
              >
                최신순
              </button>
              <button
                type="button"
                className={`more-link2 seg-btn ${articleSort === 'relevance' ? 'active' : ''}`}
                onClick={() => setArticleSort('relevance')}
              >
                관련도순
              </button>
            </div>
          </div>

          <div className="control-right-cluster">
            {showWatchToggle && (
              <button
                type="button"
                className={`more-link2 filter-chip ${onlyWatchlistArticles ? 'active' : ''}`}
                onClick={() => setOnlyWatchlistArticles((prev) => !prev)}
              >
                ★ 관심종목 글만
              </button>
            )}

            <button
              type="button"
              className={`more-link2 filter-toggle-btn ${activeSubFilterCount > 0 ? 'active' : ''}`}
              onClick={() => setIsFilterExpanded((prev) => !prev)}
              aria-expanded={isFilterExpanded}
              aria-label="상세 필터 접기/펼치기"
            >
              <span>⚙️ 상세 필터</span>
              {activeSubFilterCount > 0 && (
                <span className="filter-count-badge num">{activeSubFilterCount}</span>
              )}
              <span>{isFilterExpanded ? '▲' : '▼'}</span>
            </button>
          </div>
        </div>

        {isFilterExpanded && (
          <div className="sub-filter-row">
            <div className="sub-filter-group" role="group" aria-label="감성 필터">
              <span className="sub-filter-label">감성</span>
              {SENTIMENT_FILTERS.map((sf) => (
                <button
                  key={sf.key}
                  type="button"
                  className={`more-link2 filter-chip ${sentimentFilter === sf.key ? 'active' : ''}`}
                  onClick={() => setSentimentFilter(sf.key)}
                >
                  {sf.label}
                </button>
              ))}
            </div>

            <div className="sub-filter-group" role="group" aria-label="기간 필터">
              <span className="sub-filter-label">기간</span>
              {ARTICLE_PERIODS.map((ap) => (
                <button
                  key={ap.key}
                  type="button"
                  className={`more-link2 filter-chip ${articlePeriod === ap.key ? 'active' : ''}`}
                  onClick={() => setArticlePeriod(ap.key)}
                >
                  {ap.label}
                </button>
              ))}
            </div>

            <div className="sub-filter-group" role="group" aria-label="최소 관련도 필터">
              <span className="sub-filter-label">최소 관련도</span>
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
            </div>

            {activeSubFilterCount > 0 && (
              <button
                type="button"
                className="more-link2 reset-btn"
                onClick={() => {
                  setSentimentFilter('ALL');
                  setArticlePeriod('ALL');
                  setMinRelevance(0);
                }}
              >
                초기화 ↺
              </button>
            )}
          </div>
        )}
      </div>
    );
  };

  const renderHomeView = () => {
    const homeSentimentCounts = {
      total: homeFeedArticles.length,
      pos: homeFeedArticles.filter((a) => {
        const s = a.sentiment ? String(a.sentiment).toUpperCase().trim() : '';
        return s === 'POSITIVE' || s === '긍정';
      }).length,
      neg: homeFeedArticles.filter((a) => {
        const s = a.sentiment ? String(a.sentiment).toUpperCase().trim() : '';
        return s === 'NEGATIVE' || s === '부정';
      }).length,
      neu: homeFeedArticles.filter((a) => {
        const s = a.sentiment ? String(a.sentiment).toUpperCase().trim() : '';
        return s !== 'POSITIVE' && s !== '긍정' && s !== 'NEGATIVE' && s !== '부정';
      }).length,
    };

    const homeChannelCounts = {
      news: homeFeedArticles.filter((a) => a.sourceType === 'NEWS').length,
      sns: homeFeedArticles.filter((a) => a.sourceType !== 'NEWS').length,
    };

    let homeActiveSubFilterCount = 0;
    if (articlePeriod !== 'ALL') homeActiveSubFilterCount += 1;
    if (minRelevance !== 0) homeActiveSubFilterCount += 1;
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
              🤖 안내(N-05): AI(LLM) 요약·감성 분석 및 SNS 게시글(미검증 정보)은 투자 권유가 아니며, 원문과 공시를 반드시 확인해 주세요.
            </div>

            <div className="card-header">
              <div className="card-title">
                📰 실시간 뉴스 × 종목 AI 매칭 소식{' '}
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
                {/* 채널 탭 */}
                <div className="seg-group" role="group" aria-label="채널 필터">
                  {[
                    { key: 'ALL', label: '전체' },
                    { key: 'NEWS', label: '📰 뉴스' },
                    { key: 'SNS', label: '💬 SNS' },
                  ].map((ch) => (
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

                {/* [V7] A2: 감성 칩에 건수 표시("호재 12"), 0건 칩 흐리게, ● 아이콘 통일 */}
                <div className="sentiment-filter-chips" role="group" aria-label="감성 필터 칩">
                  {[
                    { key: 'ALL', label: '전체', count: homeSentimentCounts.total, cls: 'sent-chip-all' },
                    { key: 'POSITIVE', label: '호재', count: homeSentimentCounts.pos, cls: 'sent-chip-pos' },
                    { key: 'NEGATIVE', label: '악재', count: homeSentimentCounts.neg, cls: 'sent-chip-neg' },
                    { key: 'NEUTRAL', label: '중립', count: homeSentimentCounts.neu, cls: 'sent-chip-neu' },
                  ].map((chip) => {
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

                {/* 정렬 옵션 */}
                <div className="seg-group" role="group" aria-label="정렬 옵션">
                  <button
                    type="button"
                    className={`more-link2 seg-btn ${articleSort === 'latest' ? 'active' : ''}`}
                    onClick={() => setArticleSort('latest')}
                  >
                    최신순
                  </button>
                  <button
                    type="button"
                    className={`more-link2 seg-btn ${articleSort === 'relevance' ? 'active' : ''}`}
                    onClick={() => setArticleSort('relevance')}
                  >
                    관련도순
                  </button>
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

                <div className="sub-filter-group" role="group" aria-label="최소 관련도 필터">
                  <span className="sub-filter-label">최소 관련도</span>
                  <select
                    className="sort-select"
                    value={minRelevance}
                    onChange={(e) => {
                      setMinRelevance(Number(e.target.value));
                      setHomePage(1);
                    }}
                    aria-label="최소 관련도 필터"
                  >
                    {RELEVANCE_OPTIONS.map((opt) => (
                      <option key={opt.key} value={opt.key}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
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
                      setMinRelevance(0);
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
                  ‘{feedLocalQuery}’에 해당하는 기사나 SNS 소식을 찾을 수 없습니다.
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
                        <th className="num-col">매칭</th>
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

                {/* [V7] A4: '오늘의 이슈 종목 TOP 7' 아래에 '오늘의 소식 요약' 카드 추가 */}
                <div className="content-card today-summary-card">
                  <div className="card-header">
                    <div className="card-title">📊 오늘의 소식 요약</div>
                    <span className="count-badge num">총 {homeSentimentCounts.total}건</span>
                  </div>
                  <div className="today-summary-body">
                    <div className="summary-stat-row">
                      <span className="summary-stat-label">채널 구분</span>
                      <div className="summary-stat-values num">
                        <span>뉴스 <strong>{homeChannelCounts.news}</strong>건</span>
                        <span className="stat-dot">·</span>
                        <span>SNS <strong>{homeChannelCounts.sns}</strong>건</span>
                      </div>
                    </div>
                    <div className="summary-stat-row">
                      <span className="summary-stat-label">AI 감성</span>
                      <div className="summary-stat-values num">
                        <span className="sent-pos">호재 <strong>{homeSentimentCounts.pos}</strong></span>
                        <span className="stat-dot">·</span>
                        <span className="sent-neg">악재 <strong>{homeSentimentCounts.neg}</strong></span>
                        <span className="stat-dot">·</span>
                        <span className="sent-neu">중립 <strong>{homeSentimentCounts.neu}</strong></span>
                      </div>
                    </div>
                  </div>
                </div>

                {!user ? (
                  <div className="watchlist-compact-banner">
                    <div className="compact-banner-left">
                      <span className="compact-banner-icon">⭐</span>
                      <div>
                        <div className="compact-banner-text">관심 종목 모아보기</div>
                        <div className="compact-banner-sub">로그인하고 관심 종목을 등록해 보세요</div>
                      </div>
                    </div>
                    <button
                      type="button"
                      className="compact-banner-btn"
                      onClick={() => {
                        setAuthMode('login');
                        setAuthError('');
                        setShowAuthModal(true);
                      }}
                    >
                      로그인
                    </button>
                  </div>
                ) : watchlistStocks.length === 0 ? (
                  <div className="content-card">
                    <div className="card-header">
                      <div className="card-title">
                        ⭐ 나의 관심 종목 <span className="count-badge num">0</span>
                      </div>
                      <button
                        type="button"
                        className="more-link"
                        onClick={() => handleSwitchNav('watchlist')}
                      >
                        관심종목 피드 &gt;
                      </button>
                    </div>
                    <form className="watch-add-inline" onSubmit={handleWatchAddSubmit}>
                      <div className="watch-input-wrap">
                        <input
                          type="text"
                          className="watch-inline-input"
                          placeholder="종목명·코드·별칭 빠른 추가"
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
                    <div className="watchlist-compact-banner" style={{ marginTop: '8px' }}>
                      <div className="compact-banner-left">
                        <span className="compact-banner-icon">💡</span>
                        <span className="compact-banner-text">등록된 관심 종목이 없습니다. 위에서 검색해 추가하세요.</span>
                      </div>
                    </div>
                  </div>
                ) : (
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
                          placeholder="종목명·코드·별칭 빠른 추가"
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
                        {watchlistStocks.map((st) => (
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
                            <td className="num-col num">-</td>
                            <td className="num-col num">
                              <span className="ticker-tag">시세 연동 전</span>
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
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
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
                  <th className="num-col">오늘 매칭</th>
                  <th className="num-col">AI 감성</th>
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
                        <span className="stock-meta">#{st.themes.slice(0, 2).join(' #')}</span>
                      </td>
                      <td className="num-col num">-</td>
                      <td className="num-col num">
                        <span className="ticker-tag">시세 연동 전</span>
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
                          aria-label={`${st.name} ${isInWatchlist(st.code) ? '관심종목 해제' : '관심종목 추가'}`}
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

    const stockSentimentCounts = {
      total: stockFeedArticles.length,
      pos: stockFeedArticles.filter((a) => {
        const s = a.sentiment ? String(a.sentiment).toUpperCase().trim() : '';
        return s === 'POSITIVE' || s === '긍정';
      }).length,
      neg: stockFeedArticles.filter((a) => {
        const s = a.sentiment ? String(a.sentiment).toUpperCase().trim() : '';
        return s === 'NEGATIVE' || s === '부정';
      }).length,
      neu: stockFeedArticles.filter((a) => {
        const s = a.sentiment ? String(a.sentiment).toUpperCase().trim() : '';
        return s !== 'POSITIVE' && s !== '긍정' && s !== 'NEGATIVE' && s !== '부정';
      }).length,
    };

    let stockActiveSubCount = 0;
    if (articlePeriod !== 'ALL') stockActiveSubCount += 1;
    if (minRelevance !== 0) stockActiveSubCount += 1;

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
                onClick={() => handleToggleWatchlist(selectedStock.code)}
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
              <span>오늘 뉴스 {todayCounts.news}건</span>
              <span className="stat-dot">·</span>
              <span>SNS {todayCounts.sns}건</span>
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

        {/* [V7] C4: 요약 탭 구성 순서: AI 요약 → 뉴스/SNS 요약(최대 3줄 clamp, [더 보기/접기] 토글) → 주가 차트 → 언급량 추이 + 토론장 */}
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
                  <p className={expandedSummaryBox.sns ? 'summary-text-expanded' : 'summary-text-clamped'}>
                    {currentSummary.snsSummary || '당일 SNS 반응 요약 준비 중입니다.'}
                  </p>
                  <button
                    type="button"
                    className="more-link summary-expand-btn"
                    onClick={() => setExpandedSummaryBox((prev) => ({ ...prev, sns: !prev.sns }))}
                  >
                    {expandedSummaryBox.sns ? '접기 ▲' : '더 보기 ▼'}
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

        {(stockTab === 'news' || stockTab === 'sns') && (
          <>
            {stockTab === 'sns' && (
              <div className="sns-warning-inline" role="alert">
                ⚠️ <strong>참고용 · 확인되지 않은 정보 (N-05):</strong> SNS 블로그·카페 게시글은 사실 여부가 검증되지 않았으므로 투자 판단 시 원문과 공시를 반드시 확인해 주세요.
              </div>
            )}

            <div className="split-layout">
              <div className="content-card" ref={stockFeedRef}>
                <div className="card-header">
                  <div className="card-title">
                    {stockTab === 'news'
                      ? `📰 ${selectedStock.name} 매칭 뉴스 모아보기`
                      : `💬 ${selectedStock.name} 매칭 SNS 모아보기`}{' '}
                    <span className="count-badge num">{stockFeedArticles.length}</span>
                  </div>
                </div>

                {/* 통합 필터 툴바 */}
                <div className="unified-feed-toolbar">
                  <div className="feed-toolbar-left">
                    <div className="sentiment-filter-chips" role="group" aria-label="감성 필터 칩">
                      {[
                        { key: 'ALL', label: '전체', count: stockSentimentCounts.total, cls: 'sent-chip-all' },
                        { key: 'POSITIVE', label: '호재', count: stockSentimentCounts.pos, cls: 'sent-chip-pos' },
                        { key: 'NEGATIVE', label: '악재', count: stockSentimentCounts.neg, cls: 'sent-chip-neg' },
                        { key: 'NEUTRAL', label: '중립', count: stockSentimentCounts.neu, cls: 'sent-chip-neu' },
                      ].map((chip) => {
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
                        className={`more-link2 seg-btn ${articleSort === 'relevance' ? 'active' : ''}`}
                        onClick={() => setArticleSort('relevance')}
                      >
                        관련도순
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

                    <div className="sub-filter-group" role="group" aria-label="최소 관련도">
                      <span className="sub-filter-label">최소 관련도</span>
                      <select
                        className="sort-select"
                        value={minRelevance}
                        onChange={(e) => {
                          setMinRelevance(Number(e.target.value));
                          setStockNewsPage(1);
                        }}
                      >
                        {RELEVANCE_OPTIONS.map((opt) => (
                          <option key={opt.key} value={opt.key}>
                            {opt.label}
                          </option>
                        ))}
                      </select>
                    </div>

                    {stockActiveSubCount > 0 && (
                      <button
                        type="button"
                        className="more-link2 reset-btn"
                        onClick={() => {
                          setArticlePeriod('ALL');
                          setMinRelevance(0);
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

        {stockTab === 'board' && <StockComments {...commentsProps} />}
      </div>
    );
  };

  // [V7] B1, B2: 2컬럼 레이아웃 (좌측 280px 패널 + 우측 피드), 비로그인/빈 상태 정리
  const renderWatchlistView = () => {
    if (!user) {
      return (
        <div className="wrapper">
          <div className="content-card watchlist-guest-card">
            <div className="empty-state">
              <div className="empty-icon">⭐</div>
              <div className="empty-title">로그인하고 관심 종목을 등록하세요</div>
              <div className="empty-sub">
                관심 종목을 등록하면 맞춤형 뉴스·SNS 모아보기와 실시간 시세를 확인할 수 있습니다.
              </div>
              <button
                type="button"
                className="btn-primary"
                style={{ marginTop: '16px' }}
                onClick={() => {
                  setAuthMode('login');
                  setAuthError('');
                  setShowAuthModal(true);
                }}
              >
                로그인하기
              </button>
            </div>
          </div>
        </div>
      );
    }

    const watchSentimentCounts = {
      total: watchlistFeedArticles.length,
      pos: watchlistFeedArticles.filter((a) => {
        const s = a.sentiment ? String(a.sentiment).toUpperCase().trim() : '';
        return s === 'POSITIVE' || s === '긍정';
      }).length,
      neg: watchlistFeedArticles.filter((a) => {
        const s = a.sentiment ? String(a.sentiment).toUpperCase().trim() : '';
        return s === 'NEGATIVE' || s === '부정';
      }).length,
      neu: watchlistFeedArticles.filter((a) => {
        const s = a.sentiment ? String(a.sentiment).toUpperCase().trim() : '';
        return s !== 'POSITIVE' && s !== '긍정' && s !== 'NEGATIVE' && s !== '부정';
      }).length,
    };

    let watchActiveSubCount = 0;
    if (articlePeriod !== 'ALL') watchActiveSubCount += 1;
    if (minRelevance !== 0) watchActiveSubCount += 1;

    const activeWatchArticle =
      watchlistFeedArticles.find((a) => a.id === selectedArticleId) ||
      watchlistFeedArticles[0] ||
      null;

    return (
      <div className="wrapper">
        <div className="watchlist-2col-layout">
          {/* [V7] B1: 좌측 280px 패널 (빠른 추가 입력창 + 관심 종목 칩/목록) */}
          <aside className="watchlist-left-panel" aria-label="관심 종목 관리 패널">
            <div className="content-card">
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

              {watchlistStocks.length === 0 ? (
                <div className="empty-state" style={{ padding: '24px 12px' }}>
                  <div className="empty-icon">📌</div>
                  <div className="empty-title" style={{ fontSize: '14px' }}>종목을 추가하세요</div>
                  <div className="empty-sub" style={{ fontSize: '12px' }}>
                    위 입력창에서 종목명 또는 코드를 입력해 추가하세요.
                  </div>
                </div>
              ) : (
                <div className="watchlist-side-items">
                  {watchlistStocks.map((st) => (
                    <div
                      key={st.code}
                      className="watchlist-side-item"
                      role="button"
                      tabIndex={0}
                      onClick={() => navigateToStockDetail(st.code, 'summary')}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          navigateToStockDetail(st.code, 'summary');
                        }
                      }}
                    >
                      <div className="side-item-main">
                        <span className="side-item-name">{st.name}</span>
                        <span className="side-item-code num">{st.code}</span>
                      </div>
                      <div className="side-item-sub">
                        <QuotePrice price={st.price} className="side-item-price" />
                        <QuoteRate rate={st.changeRate} size="sm" />
                        <span className="side-item-cnt num">매칭 {st.todayMatchedCount}</span>
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
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </aside>

          {/* [V7] B1: 우측 관심 종목 피드 (홈과 동일한 통합 필터 적용) */}
          <main className="watchlist-right-feed" aria-label="관심 종목 뉴스 및 SNS 피드">
            <div className="content-card" ref={watchlistFeedRef}>
              <div className="card-header">
                <div className="card-title">
                  📰 관심 종목 뉴스·SNS 모아보기{' '}
                  <span className="count-badge num">{watchlistFeedArticles.length}</span>
                </div>
              </div>

              {/* 통합 필터 바 */}
              <div className="unified-feed-toolbar">
                <div className="feed-toolbar-left">
                  <div className="seg-group" role="group" aria-label="채널 선택">
                    {[
                      { key: 'ALL', label: '전체' },
                      { key: 'NEWS', label: '📰 뉴스' },
                      { key: 'SNS', label: '💬 SNS' },
                    ].map((ch) => (
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

                  <div className="sentiment-filter-chips" role="group" aria-label="감성 필터 칩">
                    {[
                      { key: 'ALL', label: '전체', count: watchSentimentCounts.total, cls: 'sent-chip-all' },
                      { key: 'POSITIVE', label: '호재', count: watchSentimentCounts.pos, cls: 'sent-chip-pos' },
                      { key: 'NEGATIVE', label: '악재', count: watchSentimentCounts.neg, cls: 'sent-chip-neg' },
                      { key: 'NEUTRAL', label: '중립', count: watchSentimentCounts.neu, cls: 'sent-chip-neu' },
                    ].map((chip) => {
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
                      className={`more-link2 seg-btn ${articleSort === 'relevance' ? 'active' : ''}`}
                      onClick={() => setArticleSort('relevance')}
                    >
                      관련도순
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

                  <div className="sub-filter-group" role="group" aria-label="최소 관련도">
                    <span className="sub-filter-label">최소 관련도</span>
                    <select
                      className="sort-select"
                      value={minRelevance}
                      onChange={(e) => {
                        setMinRelevance(Number(e.target.value));
                        setWatchlistArticlesPage(1);
                      }}
                      aria-label="최소 관련도 필터"
                    >
                      {RELEVANCE_OPTIONS.map((opt) => (
                        <option key={opt.key} value={opt.key}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  {watchActiveSubCount > 0 && (
                    <button
                      type="button"
                      className="more-link2 reset-btn"
                      onClick={() => {
                        setArticlePeriod('ALL');
                        setMinRelevance(0);
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
          </main>
        </div>
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

            {authError && (
              <div className="sns-warning-inline" role="alert">
                {authError}
              </div>
            )}

            {(authMode === 'login' || authMode === 'signup') && (
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
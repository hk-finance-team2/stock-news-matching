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
import '../styles/dashboard.css';

// 왼쪽 사이드바 네비게이션 메뉴
const NAV_ITEMS = [
  { key: 'home', icon: '🏠', label: '홈(종합)', title: '홈 종합 대시보드' },
  { key: 'news', icon: '📰', label: '뉴스 매칭', title: '뉴스 × 종목 매칭' },
  { key: 'sns', icon: '💬', label: 'SNS 반응', title: 'SNS × 종목 반응' },
  { key: 'mention', icon: '📈', label: '언급량 추이', title: '언급량 추이 분석' },
  { key: 'ranking', icon: '🔥', label: '이슈 순위', title: '실시간 이슈 랭킹' },
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
  news: { label: '뉴스', className: 'tag-news' },
  sns: { label: 'SNS', className: 'tag-sns' },
  mention: { label: '언급량', className: 'tag-mention' },
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

// <reference_ui>의 .trend-badge (.trend-up / .trend-down / .trend-neutral) 스타일을 적용한 감성 배지
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

// 감성 비율 스택 바
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

// 언급량 추이 막대그래프 (Y축 눈금선, 🔥 피크 배지, 호버 툴팁)
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

// 좌측 간소화된 뉴스·SNS 피드 리스트: [감성 배지(.trend-up/down/neutral) + 기사 제목 + 언론사·시간 + 매칭된 종목 태그 2~3개]
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
                    onSelect(art.id);
                  }}
                  title={`${rel.name} (${rel.relationType} · 관련도 ${rel.relevance}%)`}
                >
                  #{rel.name} <span>{rel.relevance}%</span>
                </button>
              ))}
              {isSns && <span className="sns-mini-tag">⚠️ 미검증 참고용</span>}
            </div>
          </article>
        );
      })}
    </div>
  );
}

// 실시간 종목 토론장 컴포넌트 (우측 상세 패널 내부 또는 하단 섹션 공용)
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
  const [draft, setDraft] = useState('');
  const [filterMode, setFilterMode] = useState('all'); // 'all' | 'tab'
  const [sortMode, setSortMode] = useState('latest'); // 'latest' | 'likes'

  const currentTag = COMMENT_TAGS[tabKey] || COMMENT_TAGS.news;
  const prefix = `[${currentTag.label}] `;

  const parsedComments = useMemo(
    () => comments.map((c) => ({ ...c, ...parseComment(c.content) })),
    [comments]
  );

  const visibleComments = useMemo(() => {
    const filtered =
      filterMode === 'tab'
        ? parsedComments.filter((c) => c.tagKey === tabKey)
        : parsedComments;
    return [...filtered].sort((a, b) => {
      if (sortMode === 'likes') {
        if ((b.likes || 0) !== (a.likes || 0)) return (b.likes || 0) - (a.likes || 0);
      }
      return String(b.createdAt || '').localeCompare(String(a.createdAt || ''));
    });
  }, [parsedComments, filterMode, tabKey, sortMode]);

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

  return (
    <div className={compact ? 'comments-embedded' : 'content-card comments-section'}>
      <div className="card-header comments-header">
        <div className="comments-title-group">
          <div className="card-title">
            💬 {stock.name} 실시간 종목토론{' '}
            <span className="count-badge num">
              {visibleComments.length}
              {filterMode === 'tab' && ` / ${parsedComments.length}`}
            </span>
          </div>
          {!compact && (
            <span className="card-caption">
              뉴스·SNS·언급량 탭에서 실시간 공유되는 종목 의견입니다
            </span>
          )}
        </div>

        <div className="comments-controls">
          <div className="segmented" role="group" aria-label="의견 탭 필터">
            <button
              type="button"
              className={filterMode === 'all' ? 'active' : ''}
              onClick={() => setFilterMode('all')}
            >
              전체 의견
            </button>
            <button
              type="button"
              className={filterMode === 'tab' ? 'active' : ''}
              onClick={() => setFilterMode('tab')}
            >
              현재 탭만
            </button>
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
              ? `${stock.name}에 대한 의견을 남겨 주세요 ([${currentTag.label}] 말머리 자동 부착)`
              : '로그인 후 종목토론 의견을 작성할 수 있습니다.'
          }
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
        />
        <div className="comment-form-footer">
          <span className="stock-meta">
            <span className={`comment-tag ${currentTag.className}`}>{currentTag.label}</span>{' '}
            자동 부착 ·{' '}
            <span className="num">
              {draft.length + prefix.length}/{COMMENT_MAX_LENGTH}
            </span>
          </span>
          <button type="submit" className="btn-primary">
            {user ? '의견 등록' : '로그인 후 작성'}
          </button>
        </div>
      </form>

      {visibleComments.length === 0 ? (
        <div className="empty-text">
          {filterMode === 'tab'
            ? `[${currentTag.label}] 탭에서 작성된 의견이 아직 없습니다.`
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
                      👍 {c.likes || 0}
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

// 우측 집중화 상세 패널: [AI 핵심 요약(.ai-card) + 감성 비율 스택 바 + 매칭 종목 현재가·등락률 테이블(.stock-table) 및 근거 + 연관 SNS + 실시간 종목 토론장]
function ArticleDetailPanel({
  article,
  selectedStock,
  currentSummary,
  allStocks,
  allArticles,
  regenerating,
  onRegenerateSummary,
  onSelectStock,
  onSelectArticle,
  commentsProps,
}) {
  if (!article) {
    return (
      <div className="article-detail">
        <div className="ai-card">
          <div className="ai-card-header">
            <span className="ai-card-badge">🤖 {selectedStock.name} 당일 AI 종합 요약</span>
            <button
              type="button"
              className="more-link2"
              onClick={onRegenerateSummary}
              disabled={regenerating}
            >
              {regenerating ? '⏳ 생성 중...' : '🔄 요약 재생성'}
            </button>
          </div>
          <p className="ai-card-headline">{currentSummary.headline}</p>
          <p className="ai-card-body">{currentSummary.summary}</p>
          <SentimentBar ratio={currentSummary.sentimentRatio} />
        </div>
        <div className="empty-text">
          왼쪽 목록에서 뉴스 또는 SNS 글을 클릭하면 AI 3줄 요약과 종목 매칭 근거가 표시됩니다.
        </div>
        <StockComments {...commentsProps} compact />
      </div>
    );
  }

  const isSns = article.sourceType !== 'NEWS';
  const sortedRelatedStocks = [...(article.relatedStocks || [])].sort(
    (a, b) => b.relevance - a.relevance
  );

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

  return (
    <div className="article-detail">
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
        <div className="sns-warning-inline">
          ⚠️ 참고용 · 확인되지 않은 정보 (SNS 블로그·카페 게시글은 사실 여부가 검증되지 않았습니다)
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

      {/* 1. AI 핵심 요약 (.ai-card 스타일) + 감성 비율 스택 바 */}
      <div className="ai-card">
        <div className="ai-card-header">
          <span className="ai-card-badge">🤖 AI 3줄 핵심 요약 & 종목 감성 분석</span>
          <button
            type="button"
            className="more-link2"
            onClick={onRegenerateSummary}
            disabled={regenerating}
          >
            {regenerating ? '⏳ 재생성 중...' : '🔄 요약 재생성'}
          </button>
        </div>
        <ul className="summary-lines">
          {article.summary.map((line, idx) => (
            <li key={idx}>{line}</li>
          ))}
        </ul>
        <SentimentBar ratio={currentSummary.sentimentRatio} />
        <div className="llm-notice">
          🤖 AI(LLM) 요약 및 감성 분석 결과는 원문과 차이가 있을 수 있습니다 (생성 {currentSummary.updatedAt})
        </div>
      </div>

      {/* 2. 매칭 종목 현재가·등락률 테이블 (.stock-table) 및 매칭 근거 */}
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
                  <th>종목명</th>
                  <th>구분·관련도</th>
                  <th className="num-col">현재가</th>
                  <th className="num-col">등락률</th>
                </tr>
              </thead>
              <tbody>
                {sortedRelatedStocks.map((rel) => {
                  const st = allStocks.find((s) => s.code === rel.code);
                  const hasPrice = st?.price !== null && st?.price !== undefined;
                  const tone = rateTone(st?.changeRate);
                  return (
                    <tr
                      key={rel.code}
                      onClick={() => onSelectStock(rel.code)}
                      title={`${rel.name} 종목으로 전환`}
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
                        {hasPrice ? `${st.price.toLocaleString()}원` : `매칭 ${st?.todayMatchedCount ?? 0}건`}
                      </td>
                      <td className={`num-col num ${tone}`}>
                        {hasPrice ? formatRate(st.changeRate) : `긍정 ${st?.sentimentRatio?.positive ?? 50}%`}
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
                    >
                      {rel.name} <span className="stock-code num">({rel.code})</span>
                    </button>
                    <span className="relevance-score num">
                      {rel.relationType} 매칭 · 관련도 {rel.relevance}%
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
                  <div className="evidence-reason">
                    <strong>연결 이유:</strong> {rel.reason}
                  </div>
                  <div className="evidence-quote">
                    <strong>근거 원문:</strong> {rel.evidence}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* 3. 뉴스일 때 연관 SNS 반응 (최대 5건) */}
      {!isSns && relatedSnsList.length > 0 && (
        <div className="detail-section-block">
          <div className="sub-title">💬 인접 시각 연관 SNS 반응 (참고용 미검증 정보)</div>
          <div className="related-sns-list">
            {relatedSnsList.map((sns) => (
              <div
                key={sns.id}
                className="related-sns-row"
                role="button"
                tabIndex={0}
                onClick={() => onSelectArticle(sns.id, 'sns')}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    onSelectArticle(sns.id, 'sns');
                  }
                }}
              >
                <span className="source-pill sns">{sns.channel || sns.press}</span>
                <span className="related-sns-title">{sns.title}</span>
                <span className="stock-meta num">{sns.publishedAt || sns.time}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 4. 실시간 종목 토론장 (우측 상세 패널 하단에 정돈 배치) */}
      <StockComments {...commentsProps} compact />
    </div>
  );
}

export default function DashboardPage() {
  // 양방향 정규화된 초기 데이터
  const allStocks = useMemo(
    () => normalizeStocks(STOCKS_DATA, STOCK_SUMMARIES_DATA, MENTION_TRENDS_DATA),
    []
  );
  const allArticles = useMemo(() => normalizeArticles(ARTICLES_DATA), []);
  const initialSummaries = useMemo(() => normalizeSummaries(STOCK_SUMMARIES_DATA), []);
  const initialTrends = useMemo(() => normalizeMentionTrends(MENTION_TRENDS_DATA), []);

  const [activeView, setActiveView] = useState('home'); // home | news | sns | mention | ranking
  const [watchlistCodes, setWatchlistCodes] = useState(INITIAL_WATCHLIST_CODES);
  const [selectedStockCode, setSelectedStockCode] = useState(
    INITIAL_WATCHLIST_CODES[0] || allStocks[0]?.code || '005930'
  );
  const [selectedArticleId, setSelectedArticleId] = useState(null);

  // 홈 랭킹 탭 필터: 'issue'(매칭 급증) | 'up'(급상승) | 'down'(급하락)
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

  // 뉴스·SNS 상세 필터 및 정렬 (F-08, F-10, F-15)
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

  // 사이드바 탭 전환 시 채널 필터 동기화 및 스크롤 최상단 이동
  const handleSwitchNav = (viewKey) => {
    setActiveView(viewKey);
    if (viewKey === 'news') setChannelFilter('NEWS');
    if (viewKey === 'sns') setChannelFilter('SNS');
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

  // 종목 검색 헬퍼 (종목명·코드·별칭·테마)
  const matchStockByQuery = (stock, q) =>
    stock.name.toLowerCase().includes(q) ||
    stock.code.includes(q) ||
    stock.aliases.some((al) => al.toLowerCase().includes(q)) ||
    stock.themes.some((th) => th.toLowerCase().includes(q));

  // 통합 검색 2단 자동완성 결과: ① 매칭 종목 + ② 매칭 뉴스·SNS 글 (F-12)
  const integratedSearchResults = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return { matchedStocks: [], matchedArticles: [] };

    const matchedStocks = allStocks.filter((s) => matchStockByQuery(s, q)).slice(0, 5);

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
  }, [searchQuery, searchPeriod, searchSource, allStocks, allArticles]);

  // 관심종목 추가 검색 후보
  const watchAddCandidates = useMemo(() => {
    const q = watchAddQuery.trim().toLowerCase();
    if (!q) return allStocks.slice(0, 8);
    return allStocks.filter((s) => matchStockByQuery(s, q)).slice(0, 8);
  }, [watchAddQuery, allStocks]);

  // 현재 선택 종목의 요약 데이터 (F-06)
  const currentSummary =
    summariesByStock[selectedStockCode] ||
    summariesByStock.default || {
      updatedAt: sysStatus.lastUpdated.summary,
      headline: `${selectedStock.name} 당일 매칭 뉴스·SNS 종합 요약`,
      summary: selectedStock.summary,
      newsSummary: selectedStock.newsSummary,
      snsSummary: selectedStock.snsSummary,
      sentimentRatio: selectedStock.sentimentRatio,
    };

  // 현재 선택 종목의 언급량 추이 데이터 (F-13)
  const currentTrend = initialTrends[selectedStockCode] || initialTrends.default;
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

  // 뉴스·SNS 매칭 화면 필터링 목록 (채널·감성·기간·최소관련도·관심종목·정렬)
  const detailArticles = useMemo(() => {
    const effectiveChannel =
      channelFilter !== 'ALL'
        ? channelFilter
        : activeView === 'sns'
          ? 'SNS'
          : activeView === 'news'
            ? 'NEWS'
            : 'ALL';

    const relevanceOf = (art) =>
      art.relatedStocks.find((r) => r.code === selectedStockCode)?.relevance ??
      Math.max(...art.relatedStocks.map((r) => r.relevance), 0);

    return allArticles
      .filter((art) => effectiveChannel === 'ALL' || art.sourceType === effectiveChannel)
      .filter((art) => sentimentFilter === 'ALL' || art.sentiment === sentimentFilter)
      .filter((art) => {
        if (onlyWatchlistArticles) {
          return art.relatedStocks.some((r) => watchlistCodes.includes(r.code));
        }
        return art.relatedStocks.some((r) => r.code === selectedStockCode);
      })
      .filter((art) => articlePeriod === 'ALL' || art.daysAgo <= Number(articlePeriod))
      .filter((art) => relevanceOf(art) >= minRelevance)
      .sort((a, b) =>
        articleSort === 'relevance'
          ? relevanceOf(b) - relevanceOf(a)
          : b.publishedAt.localeCompare(a.publishedAt)
      );
  }, [
    activeView,
    channelFilter,
    sentimentFilter,
    allArticles,
    selectedStockCode,
    onlyWatchlistArticles,
    watchlistCodes,
    articlePeriod,
    minRelevance,
    articleSort,
  ]);

  const selectedArticle =
    detailArticles.find((a) => a.id === selectedArticleId) || detailArticles[0] || null;

  // 전체 이슈 순위 (매칭 건수 내림차순)
  const rankedStocks = useMemo(
    () => [...allStocks].sort((a, b) => b.todayMatchedCount - a.todayMatchedCount),
    [allStocks]
  );

  // 홈 랭킹 카드용 정렬 (이슈 급증 / 급상승 / 급하락)
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

  const handleSelectStock = (code, showFeedback = true) => {
    const st = stockByCode(code);
    setSelectedStockCode(code);
    setSelectedArticleId(null);
    if (showFeedback && st) {
      triggerToast(`📊 ${st.name}(${st.code}) 종목이 선택되었습니다.`);
    }
  };

  const handleNavigateArticle = (articleId, targetTab = 'news', stockCode = null) => {
    if (stockCode) setSelectedStockCode(stockCode);
    setSelectedArticleId(articleId);
    handleSwitchNav(targetTab);
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
      triggerToast(`🤖 ${selectedStock.name} AI 종합 요약이 다시 생성되었습니다 (${nowStr})`);
    }, 500);
  };

  // 관심종목 추가·삭제·토글
  const handleAddWatchlist = (code) => {
    if (!user) {
      requireLogin('🔒 관심종목 추가는 로그인이 필요합니다.');
      return false;
    }
    const stock = stockByCode(code);
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

  const handleToggleWatchlist = (code) => {
    if (isInWatchlist(code)) {
      handleRemoveWatchlist(code);
    } else {
      handleAddWatchlist(code);
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

  // 통합 검색 결과 선택 핸들러
  const handleSelectSearchStock = (stock) => {
    handleSelectStock(stock.code, false);
    setSearchQuery('');
    setShowAutocomplete(false);
    triggerToast(`🔍 ${stock.name}(${stock.code}) 종목으로 전환되었습니다.`);
  };

  const handleSelectSearchArticle = (article) => {
    const primaryCode = article.relatedStocks[0]?.code || selectedStockCode;
    const targetTab = article.sourceType === 'NEWS' ? 'news' : 'sns';
    setSelectedStockCode(primaryCode);
    setSelectedArticleId(article.id);
    handleSwitchNav(targetTab);
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

  // 종목토론 댓글 추가·공감·삭제
  const handleAddComment = (content) => {
    const newComment = {
      commentId: Date.now(),
      id: Date.now(),
      stockCode: selectedStockCode,
      author: user.username,
      content,
      createdAt: nowIsoSeoul(),
      likes: 0,
      likedByMe: false,
    };
    setCommentsByStock((prev) => ({
      ...prev,
      [selectedStockCode]: [newComment, ...(prev[selectedStockCode] || [])],
    }));
    triggerToast('💬 실시간 종목토론 의견이 등록되었습니다.');
  };

  const handleToggleCommentLike = (commentId) => {
    if (!user) {
      requireLogin('🔒 의견 공감은 로그인이 필요합니다.');
      return;
    }
    setCommentsByStock((prev) => ({
      ...prev,
      [selectedStockCode]: (prev[selectedStockCode] || []).map((c) => {
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

  const handleDeleteComment = (commentId) => {
    setCommentsByStock((prev) => ({
      ...prev,
      [selectedStockCode]: (prev[selectedStockCode] || []).filter(
        (c) => (c.commentId ?? c.id) !== commentId
      ),
    }));
    triggerToast('🗑️ 의견이 삭제되었습니다.');
  };

  const activeNavItem = NAV_ITEMS.find((n) => n.key === activeView) || NAV_ITEMS[0];

  const commentsProps = {
    key: selectedStockCode,
    stock: selectedStock,
    comments: currentComments,
    user,
    tabKey: activeView === 'sns' ? 'sns' : activeView === 'mention' ? 'mention' : 'news',
    onAdd: handleAddComment,
    onDelete: handleDeleteComment,
    onToggleLike: handleToggleCommentLike,
    onRequireLogin: requireLogin,
  };

  // ---------- 2단 자동완성 드롭다운 렌더링 헬퍼 (#searchResult 스타일) ----------
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

        <div className="auto-section-label">📈 매칭 종목 (종목명·코드·별칭·테마)</div>
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

  // ---------- 상세 탭 상단: 관심종목 빠른 전환 바 ----------
  const renderQuickSwitch = () => {
    const extraStock = isInWatchlist(selectedStock.code) ? null : selectedStock;
    return (
      <nav className="quick-switch" aria-label="관심종목 빠른 전환">
        <span className="quick-label">⚡ 빠른 종목 전환</span>
        <div className="quick-chips">
          {extraStock && (
            <button
              type="button"
              className="quick-chip active"
              onClick={() => handleSelectStock(extraStock.code, false)}
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
              onClick={() => handleSelectStock(st.code)}
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

  // ---------- 1. 홈(종합) 화면: 히어로 검색창 + 3단 요약 카드 + AI 핵심 요약 + 2:1 메인 그리드 ----------
  const renderHome = () => {
    const hasPrice = selectedStock.price !== null && selectedStock.price !== undefined;
    const selTone = rateTone(selectedStock.changeRate);

    return (
      <div className="wrapper">
        {/* 히어로 중앙 검색창 */}
        <section className="hero-section">
          <h1 className="hero-title">종목이나 뉴스를 검색해보세요!</h1>
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

        {/* 상단 3단 핵심 지표/요약 카드 (.market-indices) */}
        <section className="market-indices" aria-label="핵심 시장 및 선택 종목 요약 지표">
          <div className="index-card">
            <div className="index-card-top">
              <span className="index-name">
                선택 종목 · {selectedStock.market} ({selectedStock.code})
              </span>
              <button
                type="button"
                className="star-btn"
                onClick={() => handleToggleWatchlist(selectedStock.code)}
                aria-label={`${selectedStock.name} ${isInWatchlist(selectedStock.code) ? '관심종목 해제' : '관심종목 추가'
                  }`}
              >
                {isInWatchlist(selectedStock.code) ? '★' : '☆'}
              </button>
            </div>
            <div className="index-value num">
              {selectedStock.name}{' '}
              {hasPrice && (
                <span className={selTone}>{selectedStock.price.toLocaleString()}원</span>
              )}
            </div>
            <div className={`index-change num ${selTone}`}>
              {hasPrice ? (
                <>
                  {selTone === 'up' ? '▲ ' : selTone === 'down' ? '▼ ' : ''}
                  {formatRate(selectedStock.changeRate)} · 업종 {selectedStock.sector}
                </>
              ) : (
                `업종 ${selectedStock.sector} · 시세 준비 중`
              )}
            </div>
          </div>

          <div
            className="index-card clickable-card"
            role="button"
            tabIndex={0}
            onClick={() => handleSwitchNav('news')}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') handleSwitchNav('news');
            }}
          >
            <div className="index-name">오늘의 AI 뉴스 × SNS 매칭</div>
            <div className="index-value num">
              총 {todayCounts.news + todayCounts.sns}건{' '}
              <span className="index-sub-pill">이슈 {selectedStock.issueRank}위</span>
            </div>
            <div className="index-change num">
              뉴스 <strong>{todayCounts.news}건</strong> · SNS{' '}
              <strong>{todayCounts.sns}건</strong> · 최근 {selectedStock.lastMatchedAt}
            </div>
          </div>

          <div
            className="index-card clickable-card"
            role="button"
            tabIndex={0}
            onClick={() => handleSwitchNav('mention')}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') handleSwitchNav('mention');
            }}
          >
            <div className="index-name">KOSPI · KOSDAQ & 당일 AI 감성</div>
            <div className="index-value up num">
              긍정 {currentSummary.sentimentRatio.positive}%
            </div>
            <div className="index-change num">
              KOSPI <span className="up">▲ 1.18%</span> · KOSDAQ{' '}
              <span className="up">▲ 0.84%</span> · 요약 {currentSummary.updatedAt}
            </div>
          </div>
        </section>

        {/* 하단 2:1 메인 그리드 (.dashboard-grid) */}
        <div className="dashboard-grid">
          {/* 좌측 (2fr): 선택 종목 AI 오늘의 핵심 이슈 요약 + 실시간 랭킹 테이블 + 언급량 미니 차트 */}
          <div className="dashboard-main-col">
            <div className="content-card">
              <div className="card-header">
                <div className="card-title">
                  🤖 {selectedStock.name} 오늘의 AI 핵심 이슈 요약
                </div>
                <div className="header-btn-group">
                  <button
                    type="button"
                    className="more-link2"
                    onClick={handleRegenerateSummary}
                    disabled={regenerating}
                  >
                    {regenerating ? '⏳ 생성 중...' : '🔄 요약 재생성'}
                  </button>
                  <button
                    type="button"
                    className="more-link2 active"
                    onClick={() => handleSwitchNav('news')}
                  >
                    매칭 뉴스 상세 &gt;
                  </button>
                </div>
              </div>

              <div className="ai-card">
                <p className="ai-card-headline">{currentSummary.headline}</p>
                <p className="ai-card-body">{currentSummary.summary}</p>
                <SentimentBar ratio={currentSummary.sentimentRatio} />
                <div className="llm-notice">
                  🤖 안내(N-05): AI(LLM) 요약 및 감성 분석 결과는 원문과 차이가 있을 수 있습니다.
                </div>
              </div>
            </div>

            <div className="content-card">
              <div className="card-header">
                <div className="card-title">🔥 실시간 랭킹 / 핵심 이슈 종목</div>
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
                  <button
                    type="button"
                    className="more-link"
                    onClick={() => handleSwitchNav('ranking')}
                  >
                    전체보기 &gt;
                  </button>
                </div>
              </div>

              <table className="stock-table">
                <thead>
                  <tr>
                    <th>순위 · 종목명</th>
                    <th className="num-col">현재가</th>
                    <th className="num-col">등락률</th>
                    <th className="num-col">오늘 매칭</th>
                    <th className="num-col">AI 감성</th>
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
                        className={st.code === selectedStockCode ? 'selected-row' : ''}
                        tabIndex={0}
                        aria-label={`${idx + 1}위 ${st.name} 선택`}
                        onClick={() => handleSelectStock(st.code)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            handleSelectStock(st.code);
                          }
                        }}
                      >
                        <td>
                          <span className={`rank-badge num ${rankClass}`}>{idx + 1}</span>
                          <strong>{st.name}</strong>{' '}
                          <span className="stock-code num">{st.code}</span>
                        </td>
                        <td className="num-col num">
                          {stHasPrice ? `${st.price.toLocaleString()}원` : '-'}
                        </td>
                        <td className={`num-col num ${tone}`}>
                          {stHasPrice ? formatRate(st.changeRate) : '시세 대기'}
                        </td>
                        <td className="num-col num">
                          <strong>{st.todayMatchedCount}건</strong>
                        </td>
                        <td className="num-col">
                          <span className="trend-badge trend-up num">
                            긍정 {st.sentimentRatio.positive}%
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="content-card">
              <div className="card-header">
                <div className="card-title">📈 {selectedStock.name} 언급량 추이 요약</div>
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
                    onClick={() => handleSwitchNav('mention')}
                  >
                    상세보기 &gt;
                  </button>
                </div>
              </div>
              <MentionTrendChart series={trendSeries} plotHeight={200} />
            </div>
          </div>

          {/* 우측 (1fr): 나의 관심 종목 카드 (.stock-table + 빠른 추가 + 관리 모달) */}
          <div className="dashboard-side-col">
            <div className="content-card">
              <div className="card-header">
                <div className="card-title">
                  ⭐ 나의 관심 종목 <span className="count-badge num">{watchlistStocks.length}</span>
                </div>
                <button
                  type="button"
                  className="more-link"
                  onClick={() => setShowWatchModal(true)}
                >
                  관리 &gt;
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
                <div className="empty-text">
                  등록된 관심종목이 없습니다. 위 입력창이나 [관리 &gt;]에서 추가해 보세요.
                </div>
              ) : (
                <table className="stock-table">
                  <thead>
                    <tr>
                      <th>종목명</th>
                      <th className="num-col">현재가 · 매칭</th>
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
                          className={st.code === selectedStockCode ? 'selected-row' : ''}
                          tabIndex={0}
                          aria-label={`관심종목 ${st.name} 선택`}
                          onClick={() => handleSelectStock(st.code)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault();
                              handleSelectStock(st.code);
                            }
                          }}
                        >
                          <td>
                            <strong>{st.name}</strong>
                            <div className="stock-meta num">오늘 {st.todayMatchedCount}건</div>
                          </td>
                          <td className="num-col num">
                            {stHasPrice ? `${st.price.toLocaleString()}원` : `${st.todayMatchedCount}건`}
                          </td>
                          <td className={`num-col num ${tone}`}>
                            {stHasPrice ? formatRate(st.changeRate) : `긍정 ${st.sentimentRatio.positive}%`}
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
          </div>
        </div>
      </div>
    );
  };

  // ---------- 2. 뉴스 × 종목 매칭 / SNS 반응 화면 (.split-layout: 좌측 피드 1fr / 우측 Sticky 상세 420px) ----------
  const renderMatchingSplitView = () => {
    const effectiveChannel =
      channelFilter !== 'ALL'
        ? channelFilter
        : activeView === 'sns'
          ? 'SNS'
          : activeView === 'news'
            ? 'NEWS'
            : 'ALL';

    return (
      <div className="wrapper">
        {renderQuickSwitch()}

        {/* 상단 컨트롤 바: 채널 필터 + 감성 필터 + 기간·관련도·정렬 한 줄 배치 */}
        <div className="content-card control-bar-card">
          <div className="control-bar-row">
            <div className="control-group" role="group" aria-label="채널 필터">
              {[
                { key: 'ALL', label: '전체 채널' },
                { key: 'NEWS', label: '📰 뉴스' },
                { key: 'SNS', label: '💬 SNS' },
              ].map((ch) => (
                <button
                  key={ch.key}
                  type="button"
                  className={`more-link2 ${effectiveChannel === ch.key ? 'active' : ''}`}
                  onClick={() => setChannelFilter(ch.key)}
                >
                  {ch.label}
                </button>
              ))}
            </div>

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
              <button
                type="button"
                className={`more-link2 ${onlyWatchlistArticles ? 'active' : ''}`}
                onClick={() => setOnlyWatchlistArticles((prev) => !prev)}
              >
                ★ 관심종목 글만
              </button>

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

        {/* 좌우 분할 레이아웃 (.split-layout: 1fr : 420px) */}
        <div className="split-layout">
          {/* 좌측: 간소화된 뉴스/SNS 피드 리스트 */}
          <div className="content-card">
            <div className="card-header">
              <div className="card-title">
                {onlyWatchlistArticles
                  ? '⭐ 내 관심종목 매칭 피드'
                  : `📰 ${selectedStock.name} 매칭 피드`}{' '}
                <span className="count-badge num">{detailArticles.length}</span>
              </div>
              <span className="card-caption">
                기사를 클릭하면 우측 패널에 AI 요약과 매칭 근거가 표시됩니다
              </span>
            </div>

            <ArticleList
              articles={detailArticles}
              selectedId={selectedArticle?.id}
              onSelect={setSelectedArticleId}
              onSelectStock={(code) => handleSelectStock(code)}
            />
          </div>

          {/* 우측: 선택한 기사의 Sticky 상세 패널 (position: sticky; top: 24px) */}
          <aside className="panel sticky-detail-panel" aria-label="선택 기사 상세 및 종목 토론">
            <ArticleDetailPanel
              article={selectedArticle}
              selectedStock={selectedStock}
              currentSummary={currentSummary}
              allStocks={allStocks}
              allArticles={allArticles}
              regenerating={regenerating}
              onRegenerateSummary={handleRegenerateSummary}
              onSelectStock={(code) => handleSelectStock(code)}
              onSelectArticle={(artId, tab) => handleNavigateArticle(artId, tab)}
              commentsProps={commentsProps}
            />
          </aside>
        </div>
      </div>
    );
  };

  // ---------- 3. 언급량 추이 상세 화면 ----------
  const renderMentionView = () => {
    const totalNews = trendSeries.reduce((sum, pt) => sum + (pt.news || 0), 0);
    const totalSns = trendSeries.reduce((sum, pt) => sum + (pt.sns || 0), 0);
    const grandTotal = totalNews + totalSns;
    const maxRowTotal = Math.max(
      ...trendSeries.map((pt) => (pt.news || 0) + (pt.sns || 0)),
      1
    );

    return (
      <div className="wrapper">
        {renderQuickSwitch()}

        <div className="content-card">
          <div className="card-header">
            <div className="card-title">
              📈 {selectedStock.name} ({selectedStock.code}) 뉴스·SNS 언급량 추이
            </div>
            <div className="header-btn-group" role="group" aria-label="언급량 상세 주기 선택">
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
          <MentionTrendChart series={trendSeries} plotHeight={280} />
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
                    <strong>합계</strong>
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
              <div className="card-title">종목 이슈 요약 & 감성 분석</div>
            </div>
            <div className="ai-card">
              <p className="ai-card-headline">{currentSummary.headline}</p>
              <p className="ai-card-body">{currentSummary.summary}</p>
              <SentimentBar ratio={currentSummary.sentimentRatio} />
            </div>
            <StockComments {...commentsProps} compact />
          </div>
        </div>
      </div>
    );
  };

  // ---------- 4. 실시간 이슈 순위 전체 화면 ----------
  const renderRankingView = () => (
    <div className="wrapper">
      <div className="content-card">
        <div className="card-header">
          <div className="card-title">🔥 오늘의 뉴스·SNS 언급 급증 이슈 종목 전체 순위</div>
          <span className="card-caption">
            오늘 매칭된 글 수 기준 · 종목을 클릭하면 뉴스×종목 매칭 상세 화면으로 이동합니다
          </span>
        </div>

        <table className="stock-table">
          <thead>
            <tr>
              <th>순위 · 종목명</th>
              <th>시장 · 업종 · 테마</th>
              <th className="num-col">현재가</th>
              <th className="num-col">등락률</th>
              <th className="num-col">오늘 매칭</th>
              <th className="num-col">AI 감성</th>
              <th className="num-col">관심</th>
            </tr>
          </thead>
          <tbody>
            {rankedStocks.map((st, idx) => {
              const stHasPrice = st.price !== null && st.price !== undefined;
              const tone = rateTone(st.changeRate);
              const rankClass = idx < 3 ? `rank-${idx + 1}` : '';
              return (
                <tr
                  key={st.code}
                  className={st.code === selectedStockCode ? 'selected-row' : ''}
                  tabIndex={0}
                  aria-label={`이슈 ${idx + 1}위 ${st.name} 뉴스 상세 분석으로 이동`}
                  onClick={() => {
                    handleSelectStock(st.code, false);
                    handleSwitchNav('news');
                    triggerToast(`🔥 ${idx + 1}위 ${st.name} 뉴스 매칭 분석으로 이동했습니다.`);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      handleSelectStock(st.code, false);
                      handleSwitchNav('news');
                      triggerToast(`🔥 ${idx + 1}위 ${st.name} 뉴스 매칭 분석으로 이동했습니다.`);
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

  return (
    <div className="app-shell">
      {/* 1. 왼쪽 사이드바 네비게이션 */}
      <nav className="left-nav-menu" aria-label="메인 네비게이션">
        <button
          type="button"
          className="nav-logo"
          title="뉴스×종목 매칭 대시보드 홈으로 이동"
          aria-label="뉴스×종목 매칭 대시보드 홈으로 이동"
          onClick={() => handleSwitchNav('home')}
        >
          N×S
        </button>
        {NAV_ITEMS.map((item) => (
          <button
            key={item.key}
            type="button"
            className={`nav-item-btn ${activeView === item.key ? 'active' : ''}`}
            aria-label={item.title}
            aria-current={activeView === item.key ? 'page' : undefined}
            onClick={() => handleSwitchNav(item.key)}
          >
            <span className="nav-icon" aria-hidden="true">
              {item.icon}
            </span>
            <span>{item.label}</span>
          </button>
        ))}
      </nav>

      <div className="main-area">
        {/* 2. 상단 헤더 (<reference_ui> header 구조 + 상태 표시 및 로그인/회원가입) */}
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
              StockNews AI <span className="brand-sub">{activeNavItem.title}</span>
            </div>

            {activeView !== 'home' && (
              <div className="header-search-compact">
                <input
                  type="text"
                  className="search-input compact"
                  placeholder="종목·뉴스 빠른 검색..."
                  aria-label="상단 빠른 통합 검색"
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
          {activeView === 'home' && renderHome()}
          {(activeView === 'news' || activeView === 'sns') && renderMatchingSplitView()}
          {activeView === 'mention' && renderMentionView()}
          {activeView === 'ranking' && renderRankingView()}
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

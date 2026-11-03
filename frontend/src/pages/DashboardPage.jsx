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

// 왼쪽 사이드바 5개 메뉴 (독립 게시판 메뉴는 보류·숨김 유지, 상세 하단에 통합 종목토론 배치)
const NAV_ITEMS = [
  { key: 'home', icon: '🏠', label: '홈(종합)', title: '홈 종합 대시보드' },
  { key: 'news', icon: '📰', label: '뉴스 상세', title: '뉴스 매칭 상세' },
  { key: 'sns', icon: '💬', label: 'SNS 상세', title: 'SNS 반응 상세' },
  { key: 'mention', icon: '📈', label: '언급량 추이', title: '언급량 추이 상세' },
  { key: 'ranking', icon: '🔥', label: '이슈 순위', title: '실시간 이슈 종목 순위' },
];

const TREND_PERIODS = [
  { key: 'today', label: '오늘 (1시간 단위)' },
  { key: '7d', label: '7일 (1일 단위)' },
  { key: '30d', label: '30일 (1일 단위)' },
];

const ARTICLE_PERIODS = [
  { key: 'ALL', label: '전체' },
  { key: '0', label: '오늘' },
  { key: '7', label: '7일' },
  { key: '30', label: '30일' },
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

function SentimentBadge({ sentiment }) {
  const norm = String(sentiment || '').toUpperCase();
  if (norm === 'POSITIVE' || norm === '긍정') {
    return <span className="badge badge-pos">긍정</span>;
  }
  if (norm === 'NEGATIVE' || norm === '부정') {
    return <span className="badge badge-neg">부정</span>;
  }
  return <span className="badge badge-neu">중립</span>;
}

function ChipGroup({ options, value, onChange, ariaLabel }) {
  return (
    <div className="chip-group" role="group" aria-label={ariaLabel}>
      {options.map((opt) => (
        <button
          key={opt.key}
          type="button"
          className={`chip-btn ${value === opt.key ? 'active' : ''}`}
          onClick={() => onChange(opt.key)}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

// AI 긍정(에메랄드 #10B981) · 중립(슬레이트 #94A3B8) · 부정(코랄 레드 #F04452) 감성 비율 바
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
        <span className="sent-pos">긍정 {pos}%</span>
        <span className="sent-neu">중립 {neu}%</span>
        <span className="sent-neg">부정 {neg}%</span>
      </div>
    </div>
  );
}

// 뉴스·SNS 언급량 추이 막대그래프 (Y축 눈금선, 🔥 피크 배지, 호버 툴팁)
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

// 좌측 뉴스·SNS 글 목록 (F-08, F-10, N-05)
function ArticleList({ articles, selectedId, selectedStockCode, onSelect }) {
  if (articles.length === 0) {
    return (
      <div className="empty-text">
        조건에 맞는 분석 완료 글이 없습니다. 기간이나 최소 관련도 필터를 조정해 보세요.
      </div>
    );
  }
  return (
    <div className="article-list">
      {articles.map((art) => {
        const isSns = art.sourceType !== 'NEWS';
        const stockRel =
          art.relatedStocks.find((r) => r.code === selectedStockCode) || art.relatedStocks[0];
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
                <span className={`badge ${isSns ? 'badge-sns' : 'badge-news'}`}>
                  {isSns ? 'SNS' : 'NEWS'}
                </span>
                <SentimentBadge sentiment={art.sentiment} />
                {stockRel && (
                  <span
                    className={`badge ${stockRel.relationType === '직접' ? 'badge-direct' : 'badge-indirect'
                      } num`}
                  >
                    {stockRel.name} · {stockRel.relationType} {stockRel.relevance}%
                  </span>
                )}
              </div>
              <span className="num">
                {art.press} · {art.publishedAt}
              </span>
            </div>
            <div className="article-title">{art.title}</div>
            {isSns && (
              <div className="sns-warning-inline">
                ⚠️ 참고용 · 확인되지 않은 정보 (SNS 블로그·카페 게시글은 사실 여부가 검증되지 않았습니다)
              </div>
            )}
          </article>
        );
      })}
    </div>
  );
}

// 우측 선택된 글 상세 뷰 (F-03, F-04, F-05, F-09, N-05)
function ArticleDetail({ article, allStocks, allArticles, onSelectStock, onSelectArticle }) {
  if (!article) {
    return <div className="empty-text">왼쪽 목록에서 글을 선택해 주세요.</div>;
  }

  const isSns = article.sourceType !== 'NEWS';

  // F-03, F-09: 관련 종목을 반드시 관련도순(내림차순)으로 정렬
  const sortedRelatedStocks = [...(article.relatedStocks || [])].sort(
    (a, b) => b.relevance - a.relevance
  );

  // F-09: 뉴스 상세일 때 하단에 보여줄 비슷한 시각 같은 종목의 연관 SNS 반응 (최대 5개)
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
            <span className={`badge ${isSns ? 'badge-sns' : 'badge-news'}`}>
              {isSns ? 'SNS 게시글' : '뉴스 기사'}
            </span>
            <SentimentBadge sentiment={article.sentiment} />
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
          원문 보러가기 ↗
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

      <div className="sub-title">🤖 AI 3줄 핵심 요약 (F-05)</div>
      <div className="summary-box">
        <ul className="summary-lines">
          {article.summary.map((line, idx) => (
            <li key={idx}>{line}</li>
          ))}
        </ul>
        <div className="llm-notice">
          🤖 안내(N-05): AI(LLM)가 생성한 요약 및 감성 분석 결과는 원문과 차이가 있거나 오류가 있을 수 있습니다.
        </div>
      </div>

      <div className="sub-title">
        📌 관련 종목 매칭 근거 (관련도순 · {sortedRelatedStocks.length}건)
      </div>
      {sortedRelatedStocks.length === 0 ? (
        <div className="empty-text">관련 종목 없음</div>
      ) : (
        sortedRelatedStocks.map((rel) => {
          const stockInfo = allStocks.find((s) => s.code === rel.code);
          const hasPrice = stockInfo?.price !== null && stockInfo?.price !== undefined;
          return (
            <div key={rel.code} className="summary-box evidence-card">
              <div className="evidence-head">
                <div className="evidence-stock-info">
                  <button
                    type="button"
                    className="btn-text stock-jump-btn"
                    onClick={() => onSelectStock(rel.code)}
                    title={`${rel.name} 종목으로 전환`}
                  >
                    {rel.name} <span className="stock-code num">({rel.code})</span>
                  </button>
                  {hasPrice ? (
                    <span className="evidence-quote-price num">
                      <strong>{stockInfo.price.toLocaleString()}원</strong>{' '}
                      <RatePill rate={stockInfo.changeRate} size="sm" />
                    </span>
                  ) : (
                    <span className="stock-meta num">
                      오늘 매칭 {stockInfo?.todayMatchedCount ?? 0}건
                    </span>
                  )}
                </div>

                <div className="evidence-badges num">
                  <span
                    className={`badge ${rel.relationType === '직접' ? 'badge-direct' : 'badge-indirect'
                      }`}
                  >
                    {rel.relationType} 관련
                  </span>
                  <span className="relevance-score">관련도 {rel.relevance}%</span>
                </div>
              </div>

              <div className="gauge-track relevance-bar" title={`관련도 ${rel.relevance}%`}>
                <div className="gauge-fill" style={{ width: `${rel.relevance}%` }} />
              </div>

              {rel.matchedKeywords?.length > 0 && (
                <div className="matched-kw-row">
                  <span className="stock-meta">매칭 키워드:</span>
                  {rel.matchedKeywords.map((mk) => (
                    <span key={mk} className="badge badge-neu">
                      {mk}
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
          );
        })
      )}

      {!isSns && (
        <div className="related-sns-section">
          <div className="sub-title">
            💬 비슷한 시각 연관 SNS 반응 (최대 5건 · 참고용 미검증 정보)
          </div>
          {relatedSnsList.length === 0 ? (
            <div className="empty-text">인접 시각에 매칭된 SNS 게시글이 없습니다.</div>
          ) : (
            <div className="related-sns-list">
              {relatedSnsList.map((sns) => (
                <div
                  key={sns.id}
                  className="article-item related-sns-item"
                  role="button"
                  tabIndex={0}
                  aria-label={`연관 SNS 게시글 ${sns.title} 상세 보기`}
                  onClick={() => onSelectArticle(sns.id, 'sns')}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      onSelectArticle(sns.id, 'sns');
                    }
                  }}
                >
                  <div className="article-top-meta">
                    <span className="badge badge-sns">{sns.channel || sns.press}</span>
                    <SentimentBadge sentiment={sns.sentiment} />
                    <span className="num">{sns.publishedAt || sns.time}</span>
                  </div>
                  <div className="article-title">{sns.title}</div>
                  <div className="sns-warning-inline">⚠️ 참고용 · 확인되지 않은 정보</div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// 스크롤 최하단 통합 '실시간 종목토론' (F-17: 탭 말머리 자동 부착 + 필터 + 정렬 + 공감 토글 + 삭제)
function StockComments({
  stock,
  comments,
  user,
  tabKey,
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
    <section className="card-panel comments-section">
      <div className="card-header comments-header">
        <div className="comments-title-group">
          <div className="card-title">
            💬 {stock.name} 실시간 종목토론{' '}
            <span className="count-badge num">
              {visibleComments.length}
              {filterMode === 'tab' && ` / ${parsedComments.length}`}
            </span>
          </div>
          <span className="card-caption">
            뉴스·SNS·언급량 탭에서 실시간 공유되는 종목 의견입니다
          </span>
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
              현재 탭 의견만
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
                      className={`chip-btn like-btn ${c.likedByMe ? 'active' : ''} num`}
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

      <form className="comment-form" onSubmit={handleSubmit}>
        <textarea
          className="comment-input"
          rows={3}
          maxLength={COMMENT_MAX_LENGTH - prefix.length}
          placeholder={
            user
              ? `${stock.name}에 대한 의견을 남겨 주세요 (현재 탭 말머리 [${currentTag.label}] 자동 부착)`
              : '로그인 후 종목토론 의견을 작성할 수 있습니다. 첫 의견을 남겨보세요!'
          }
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
        />
        <div className="comment-form-footer">
          <span className="stock-meta">
            <span className={`comment-tag ${currentTag.className}`}>{currentTag.label}</span>{' '}
            말머리가 자동으로 붙어 저장됩니다 ·{' '}
            <span className="num">
              {draft.length + prefix.length}/{COMMENT_MAX_LENGTH}
            </span>
          </span>
          <button type="submit" className="btn-primary">
            {user ? '의견 등록' : '로그인하고 작성'}
          </button>
        </div>
      </form>
    </section>
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

  // 관심종목 검색 추가 입력
  const [watchAddQuery, setWatchAddQuery] = useState('');

  // 상단 통합 검색바 (F-12: 검색어 + 기간 필터 + 출처 필터 + 종목·글 동시 자동완성)
  const [searchQuery, setSearchQuery] = useState('');
  const [searchPeriod, setSearchPeriod] = useState('ALL'); // ALL | 0 | 7 | 30
  const [searchSource, setSearchSource] = useState('ALL'); // ALL | NEWS | SNS
  const [showAutocomplete, setShowAutocomplete] = useState(false);

  // 언급량 추이 기간 (F-13)
  const [trendPeriod, setTrendPeriod] = useState('today'); // today | 7d | 30d

  // 뉴스·SNS 상세 필터 및 정렬 (F-10, F-15)
  const [articlePeriod, setArticlePeriod] = useState('ALL'); // ALL | 0 | 7 | 30
  const [minRelevance, setMinRelevance] = useState(0); // 0 | 50 | 70 | 80
  const [articleSort, setArticleSort] = useState('latest'); // latest | relevance
  const [onlyWatchlistArticles, setOnlyWatchlistArticles] = useState(false);

  // 시스템 상태 및 AI 요약 재생성 상태 (F-06, F-07, F-08, F-14)
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

  // 탭 전환 시 메인 영역 스크롤 최상단 이동
  useEffect(() => {
    mainRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
  }, [activeView]);

  // ESC 키로 모달 및 자동완성 드롭다운 닫기 (웹 접근성 N-06)
  useEffect(() => {
    if (!showAuthModal && !showAutocomplete) return undefined;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        setShowAuthModal(false);
        setShowAutocomplete(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showAuthModal, showAutocomplete]);

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

  // 통합 검색 자동완성 결과: ① 매칭 종목 + ② 매칭 뉴스·SNS 글 (F-12)
  const integratedSearchResults = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return { matchedStocks: [], matchedArticles: [] };

    const matchedStocks = allStocks.filter((s) => matchStockByQuery(s, q)).slice(0, 6);

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
      .slice(0, 6);

    return { matchedStocks, matchedArticles };
  }, [searchQuery, searchPeriod, searchSource, allStocks, allArticles]);

  // 관심종목 추가 입력창 후보
  const watchAddCandidates = useMemo(() => {
    const q = watchAddQuery.trim().toLowerCase();
    if (!q) return [];
    return allStocks.filter((s) => matchStockByQuery(s, q)).slice(0, 6);
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

  // 요약 배너용 오늘 뉴스·SNS 매칭 건수
  const todayCounts = useMemo(
    () =>
      (currentTrend.today || []).reduce(
        (acc, pt) => ({ news: acc.news + (pt.news || 0), sns: acc.sns + (pt.sns || 0) }),
        { news: 0, sns: 0 }
      ),
    [currentTrend]
  );

  // 홈 화면 우측 하단: 선택 종목 핵심 매칭 뉴스 프리뷰 3건 (F-11)
  const homePreviewArticles = useMemo(() => {
    const matched = allArticles.filter((art) =>
      art.relatedStocks.some((r) => r.code === selectedStockCode)
    );
    return (matched.length > 0 ? matched : allArticles).slice(0, 3);
  }, [allArticles, selectedStockCode]);

  // 뉴스·SNS 상세 화면 필터링 목록 (F-08, F-10, F-15)
  const detailArticles = useMemo(() => {
    if (activeView !== 'news' && activeView !== 'sns') return [];
    const wantNews = activeView === 'news';
    const relevanceOf = (art) =>
      art.relatedStocks.find((r) => r.code === selectedStockCode)?.relevance ??
      Math.max(...art.relatedStocks.map((r) => r.relevance), 0);

    return allArticles
      .filter((art) => (art.sourceType === 'NEWS') === wantNews)
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

  // 이슈 종목 순위 (오늘 매칭 글 수 기준 내림차순, F-11)
  const rankedStocks = useMemo(
    () => [...allStocks].sort((a, b) => b.todayMatchedCount - a.todayMatchedCount),
    [allStocks]
  );

  const currentComments = commentsByStock[selectedStockCode] || [];

  // 비로그인 시 로그인 모달 오픈 가드 (F-16, N-03)
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
    setActiveView(targetTab);
  };

  // 데이터 수동 새로고침 (F-07, F-08, F-14, N-02)
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

  // 당일 AI 종합 요약 다시 생성 (F-06)
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

  // 관심종목 추가·삭제·토글 (F-15)
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

  const handlePickWatchCandidate = (code) => {
    if (handleAddWatchlist(code)) setWatchAddQuery('');
  };

  // 상단 통합 검색 결과 선택 핸들러 (F-12)
  const handleSelectSearchStock = (stock) => {
    handleSelectStock(stock.code, false);
    setSearchQuery('');
    setShowAutocomplete(false);
    triggerToast(`🔍 ${stock.name}(${stock.code}) 종목으로 이동했습니다.`);
  };

  const handleSelectSearchArticle = (article) => {
    const primaryCode = article.relatedStocks[0]?.code || selectedStockCode;
    const targetTab = article.sourceType === 'NEWS' ? 'news' : 'sns';
    setSelectedStockCode(primaryCode);
    setSelectedArticleId(article.id);
    setActiveView(targetTab);
    setSearchQuery('');
    setShowAutocomplete(false);
    triggerToast(`📰 선택한 ${article.sourceType === 'NEWS' ? '뉴스' : 'SNS'} 상세 분석으로 이동했습니다.`);
  };

  // 회원가입·로그인 제출 핸들러 (F-16, N-03)
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

    // 로그인 모드
    if (!usersDb[id] || usersDb[id] !== pw) {
      setAuthError('아이디 또는 비밀번호가 일치하지 않습니다. (계정이 없다면 회원가입 탭을 이용해 주세요)');
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

  // 종목토론 댓글 추가·공감·삭제 (F-17)
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

  // 시세 표시 헬퍼 (현재가·등락률 없을 때 매칭 건수·긍정 비율로 우아하게 폴백)
  const renderPriceOrFallback = (st, size = 'sm') => {
    const hasPrice = st.price !== null && st.price !== undefined;
    if (hasPrice) {
      return (
        <div className="stock-price-group">
          <div className="price-text num">{st.price.toLocaleString()}원</div>
          <RatePill rate={st.changeRate} size={size} />
        </div>
      );
    }
    return (
      <div className="stock-price-group">
        <div className="price-text num">오늘 {st.todayMatchedCount}건</div>
        <span className="badge badge-pos num">긍정 {st.sentimentRatio.positive}%</span>
      </div>
    );
  };

  // ---------- 선택 종목 프로 요약 배너 & 당일 AI 종합 요약 카드 (F-06, F-14, N-05) ----------
  const renderStockBanner = ({ showFullSummary = false } = {}) => {
    const hasPrice = selectedStock.price !== null && selectedStock.price !== undefined;
    return (
      <section className="card-panel stock-banner">
        <div className="banner-top">
          <div className="banner-id">
            <div className="banner-name-row">
              <h2 className="banner-name">{selectedStock.name}</h2>
              <span className="stock-code num">{selectedStock.code}</span>
              <span className="market-tag">{selectedStock.market}</span>
              <span className="market-tag">{selectedStock.sector}</span>
              {selectedStock.aliases?.length > 0 && (
                <span className="stock-meta">
                  별칭: {selectedStock.aliases.slice(0, 3).join(', ')}
                </span>
              )}
              {isInWatchlist(selectedStock.code) && (
                <span className="watch-mark" title="내 관심종목">
                  ★
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

          <div className="banner-price">
            {hasPrice ? (
              <>
                <span className="price-big num">
                  {selectedStock.price.toLocaleString()}
                  <small>원</small>
                </span>
                <RatePill rate={selectedStock.changeRate} size="lg" />
              </>
            ) : (
              <span className="price-big num">
                오늘 매칭 {selectedStock.todayMatchedCount}
                <small>건</small>
              </span>
            )}
            <button
              type="button"
              className={`btn-outline watch-toggle ${isInWatchlist(selectedStock.code) ? 'on' : ''
                }`}
              onClick={() => handleToggleWatchlist(selectedStock.code)}
              aria-label={
                isInWatchlist(selectedStock.code) ? '관심종목 해제' : '관심종목 추가'
              }
            >
              {isInWatchlist(selectedStock.code) ? '★ 관심종목 해제' : '☆ 관심종목 추가'}
            </button>
          </div>
        </div>

        <div className="banner-bottom">
          <div className="banner-stats">
            <div className="stat">
              <span className="stat-label">오늘 뉴스 매칭</span>
              <span className="stat-value num">
                {todayCounts.news}
                <small>건</small>
              </span>
            </div>
            <div className="stat">
              <span className="stat-label">오늘 SNS 매칭</span>
              <span className="stat-value num">
                {todayCounts.sns}
                <small>건</small>
              </span>
            </div>
            <div className="stat">
              <span className="stat-label">마지막 매칭 시각</span>
              <span className="stat-value num">{selectedStock.lastMatchedAt}</span>
            </div>
            <div className="stat">
              <span className="stat-label">요약 생성 시각</span>
              <span className="stat-value num">{currentSummary.updatedAt}</span>
            </div>
          </div>

          <div className="ai-oneliner">
            <div className="ai-oneliner-head">
              <span className="ai-badge">🤖 AI 한 줄 핵심 요약</span>
              <button
                type="button"
                className="btn-outline"
                onClick={handleRegenerateSummary}
                disabled={regenerating}
              >
                {regenerating ? '⏳ 요약 생성 중...' : '🔄 요약 다시 생성'}
              </button>
            </div>
            <p>{currentSummary.headline}</p>
          </div>
        </div>

        {showFullSummary && (
          <div className="banner-ai-summary">
            <div className="summary-box">
              <div className="sub-title">
                📑 {selectedStock.name} 당일 매칭 기사 AI 종합 요약 (생성 {currentSummary.updatedAt})
              </div>
              <p>{currentSummary.summary}</p>
            </div>
            <SentimentBar ratio={currentSummary.sentimentRatio} />
            <div className="card-caption llm-notice">
              🤖 안내(N-05): AI(LLM)가 생성한 요약 및 감성 분석 결과는 원문과 차이가 있거나 오류가 있을 수 있습니다.
            </div>
          </div>
        )}
      </section>
    );
  };

  // ---------- 상세 탭 상단: 관심종목 빠른 전환 칩 바 (F-15) ----------
  const renderQuickSwitch = () => {
    const extraStock = isInWatchlist(selectedStock.code) ? null : selectedStock;
    return (
      <nav className="quick-switch" aria-label="관심종목 빠른 전환">
        <span className="quick-label">⚡ 관심종목 빠른 전환</span>
        <div className="quick-chips">
          {extraStock && (
            <button
              type="button"
              className="quick-chip active"
              title="현재 선택된 종목"
              onClick={() => handleSelectStock(extraStock.code, false)}
            >
              <span className="quick-chip-tag">선택됨</span>
              <span className="quick-chip-name">{extraStock.name}</span>
              {extraStock.changeRate !== null ? (
                <span className={`quick-chip-rate num ${rateTone(extraStock.changeRate)}`}>
                  {formatRate(extraStock.changeRate)}
                </span>
              ) : (
                <span className="quick-chip-rate num">{extraStock.todayMatchedCount}건</span>
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
              <span className="quick-chip-name">★ {st.name}</span>
              {st.changeRate !== null ? (
                <span className={`quick-chip-rate num ${rateTone(st.changeRate)}`}>
                  {formatRate(st.changeRate)}
                </span>
              ) : (
                <span className="quick-chip-rate num">{st.todayMatchedCount}건</span>
              )}
            </button>
          ))}
          {watchlistStocks.length === 0 && (
            <span className="stock-meta">
              관심종목을 추가하면 탭 이동 없이 여기서 바로 종목을 전환할 수 있습니다.
            </span>
          )}
        </div>
      </nav>
    );
  };

  const renderComments = () => (
    <StockComments
      key={selectedStockCode}
      stock={selectedStock}
      comments={currentComments}
      user={user}
      tabKey={activeView}
      onAdd={handleAddComment}
      onDelete={handleDeleteComment}
      onToggleLike={handleToggleCommentLike}
      onRequireLogin={requireLogin}
    />
  );

  // ---------- 1. 홈(종합) 화면 (F-06, F-11, F-13, F-15) ----------
  const renderHome = () => (
    <div className="home-grid">
      {/* 좌측 컬럼: 내 관심종목 카드 + 오늘의 이슈 종목 순위 TOP */}
      <div className="home-left">
        <section className="card-panel watchlist-card">
          <div className="card-header">
            <div className="card-title">
              ⭐ 내 관심종목 <span className="count-badge num">{watchlistStocks.length}</span>
            </div>
            <span className="card-hint">
              {user ? `${user.username}님 관심 목록` : '추가·삭제는 로그인 필요'}
            </span>
          </div>

          <form className="watch-add" onSubmit={handleWatchAddSubmit}>
            <div className="search-input-wrap">
              <input
                type="text"
                className="search-input"
                placeholder="종목명·코드·별칭(삼전)으로 관심종목 추가"
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
                  title="검색어 지우기"
                >
                  ✕
                </button>
              )}
              {watchAddQuery.trim() && (
                <div className="autocomplete-dropdown">
                  {watchAddCandidates.length === 0 && (
                    <div className="auto-empty">일치하는 종목이 없습니다.</div>
                  )}
                  {watchAddCandidates.map((s) => {
                    const added = isInWatchlist(s.code);
                    return (
                      <button
                        key={s.code}
                        type="button"
                        className="auto-item"
                        disabled={added}
                        onClick={() => handlePickWatchCandidate(s.code)}
                      >
                        <span>
                          <strong>{s.name}</strong> <span className="num">({s.code})</span>
                        </span>
                        <span className="auto-action">{added ? '등록됨' : '+ 추가'}</span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
            <button type="submit" className="btn-primary">
              추가
            </button>
          </form>

          <div className="scroll-list">
            {watchlistStocks.length === 0 && (
              <div className="empty-text">
                관심종목이 없습니다. 위 입력창에서 종목을 검색해 추가해 보세요.
              </div>
            )}
            {watchlistStocks.map((st) => (
              <div
                key={st.code}
                className={`stock-row ${st.code === selectedStockCode ? 'selected' : ''}`}
                role="button"
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
                <div className="stock-name-group">
                  <div className="stock-name">
                    {st.name} <span className="stock-code num">{st.code}</span>
                  </div>
                  <div className="stock-meta num">
                    오늘 매칭 <strong>{st.todayMatchedCount}건</strong> · 최근 {st.lastMatchedAt}
                  </div>
                </div>
                <div className="stock-row-right">
                  {renderPriceOrFallback(st, 'sm')}
                  <button
                    type="button"
                    className="remove-btn"
                    title="관심종목에서 삭제"
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
        </section>

        <section className="card-panel issue-rank-card">
          <div className="card-header">
            <div className="card-title">🔥 오늘의 이슈 종목 순위 TOP</div>
            <button
              type="button"
              className="btn-text"
              onClick={() => setActiveView('ranking')}
            >
              전체 순위 →
            </button>
          </div>
          <div className="scroll-list">
            {rankedStocks.slice(0, 6).map((st, idx) => (
              <div
                key={st.code}
                className={`stock-row ${st.code === selectedStockCode ? 'selected' : ''}`}
                role="button"
                tabIndex={0}
                aria-label={`이슈 ${idx + 1}위 ${st.name} 선택`}
                onClick={() => handleSelectStock(st.code)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    handleSelectStock(st.code);
                  }
                }}
              >
                <div className="stock-name-group">
                  <div className="stock-name">
                    <span className={`rank-badge num ${idx < 3 ? 'top' : ''}`}>
                      {idx + 1}위
                    </span>{' '}
                    {st.name}
                  </div>
                  <div className="stock-meta">
                    {st.sector} · #{st.themes.slice(0, 2).join(' #')}
                  </div>
                </div>
                <div className="stock-row-right">
                  <div className="stock-price-group">
                    <div className="price-text num">매칭 {st.todayMatchedCount}건</div>
                    <RatePill rate={st.changeRate} size="sm" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>

      {/* 우측 컬럼: 프로 요약 배너 & 당일 AI 종합 요약 + 언급량 추이 차트 + 핵심 매칭 뉴스 프리뷰 */}
      <div className="home-right">
        {renderStockBanner({ showFullSummary: true })}

        <section className="card-panel trend-card">
          <div className="card-header">
            <div className="card-title">
              📈 {selectedStock.name} 언급량 추이 (연결된 글 수)
            </div>
            <ChipGroup
              options={TREND_PERIODS}
              value={trendPeriod}
              onChange={setTrendPeriod}
              ariaLabel="언급량 추이 주기 선택"
            />
          </div>
          <MentionTrendChart series={trendSeries} />
          <div className="card-footer">
            <button
              type="button"
              className="btn-text"
              onClick={() => setActiveView('mention')}
            >
              언급량 상세 분석 →
            </button>
          </div>
        </section>

        <section className="card-panel home-news-preview">
          <div className="card-header">
            <div className="card-title">
              📰 {selectedStock.name} 당일 핵심 매칭 뉴스 & 연결 이유 프리뷰
            </div>
            <button
              type="button"
              className="btn-text"
              onClick={() => setActiveView('news')}
            >
              매칭 뉴스 전체 보기 →
            </button>
          </div>
          <div className="article-list">
            {homePreviewArticles.map((art) => {
              const rel =
                art.relatedStocks.find((r) => r.code === selectedStockCode) ||
                art.relatedStocks[0];
              const isSns = art.sourceType !== 'NEWS';
              return (
                <article
                  key={art.id}
                  className="article-item"
                  role="button"
                  tabIndex={0}
                  aria-label={`${art.title} 상세 보기`}
                  onClick={() =>
                    handleNavigateArticle(art.id, isSns ? 'sns' : 'news', selectedStockCode)
                  }
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      handleNavigateArticle(art.id, isSns ? 'sns' : 'news', selectedStockCode);
                    }
                  }}
                >
                  <div className="article-top-meta">
                    <div className="article-meta-left">
                      <span className={`badge ${isSns ? 'badge-sns' : 'badge-news'}`}>
                        {isSns ? 'SNS' : 'NEWS'}
                      </span>
                      <SentimentBadge sentiment={art.sentiment} />
                      {rel && (
                        <span
                          className={`badge ${rel.relationType === '직접' ? 'badge-direct' : 'badge-indirect'
                            } num`}
                        >
                          {rel.relationType} 매칭 {rel.relevance}%
                        </span>
                      )}
                    </div>
                    <span className="num">
                      {art.press} · {art.publishedAt}
                    </span>
                  </div>
                  <div className="article-title">{art.title}</div>
                  {rel && (
                    <div className="evidence-reason">
                      <strong>연결 이유:</strong> {rel.reason}
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        </section>
      </div>
    </div>
  );

  // ---------- 2. 뉴스 상세 / SNS 상세 화면 (F-03 ~ F-05, F-08 ~ F-10, N-05) ----------
  const renderArticleView = (isNews) => (
    <div className="detail-view">
      {renderQuickSwitch()}

      {!isNews && (
        <div className="sns-warning-inline sns-warning-banner" role="alert">
          ⚠️ <strong>참고용 · 확인되지 않은 정보 (N-05):</strong> SNS 블로그·카페 게시글은 사실 여부가 검증되지 않았으므로 투자 판단 시 원문과 공시를 반드시 확인해 주세요.
        </div>
      )}

      {renderStockBanner({ showFullSummary: false })}

      <section className="card-panel">
        <div className="card-header">
          <div className="card-title">
            {isNews ? '📰' : '💬'} {selectedStock.name}{' '}
            {isNews ? '당일 뉴스 종합 요약' : '당일 SNS 반응 요약'}
          </div>
          <div className="detail-actions">
            <span className="stock-meta num">요약 생성 {currentSummary.updatedAt}</span>
            <button
              type="button"
              className="btn-outline"
              onClick={handleRegenerateSummary}
              disabled={regenerating}
            >
              {regenerating ? '⏳ 생성 중...' : '🔄 요약 다시 생성'}
            </button>
          </div>
        </div>
        <p className="summary-box">
          {isNews ? currentSummary.newsSummary : currentSummary.snsSummary}
        </p>
        <SentimentBar ratio={currentSummary.sentimentRatio} />
        <div className="card-caption llm-notice">
          🤖 안내(N-05): AI(LLM)가 생성한 요약 및 감성 분석 결과는 원문과 차이가 있거나 오류가 있을 수 있습니다.
        </div>
      </section>

      <section className="detail-two-col">
        <div className="card-panel">
          <div className="card-header">
            <div className="card-title">
              {isNews ? '📰 매칭 뉴스 목록' : '💬 매칭 SNS 글 목록'}{' '}
              <span className="count-badge num">{detailArticles.length}</span>
            </div>
            <button
              type="button"
              className={`chip-btn ${onlyWatchlistArticles ? 'active' : ''}`}
              onClick={() => setOnlyWatchlistArticles((prev) => !prev)}
            >
              ★ 내 관심종목 글만 모아보기
            </button>
          </div>

          <div className="filter-bar">
            <ChipGroup
              options={ARTICLE_PERIODS}
              value={articlePeriod}
              onChange={setArticlePeriod}
              ariaLabel="글 기간 필터"
            />
            <div className="filter-selects">
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
              <select
                className="sort-select"
                value={articleSort}
                onChange={(e) => setArticleSort(e.target.value)}
                aria-label="글 정렬 기준"
              >
                <option value="latest">최신순</option>
                <option value="relevance">관련도순</option>
              </select>
            </div>
          </div>

          <ArticleList
            articles={detailArticles}
            selectedId={selectedArticle?.id}
            selectedStockCode={selectedStockCode}
            onSelect={setSelectedArticleId}
          />
        </div>

        <div className="card-panel sticky-detail-panel">
          <div className="card-header">
            <div className="card-title">🔍 선택 글 상세 분석 및 종목 매칭 근거</div>
          </div>
          <ArticleDetail
            article={selectedArticle}
            allStocks={allStocks}
            allArticles={allArticles}
            onSelectStock={(code) => handleSelectStock(code)}
            onSelectArticle={(artId, tab) => handleNavigateArticle(artId, tab)}
          />
        </div>
      </section>

      {renderComments()}
    </div>
  );

  // ---------- 3. 언급량 상세 화면 (F-13) ----------
  const renderMentionView = () => {
    const totalNews = trendSeries.reduce((sum, pt) => sum + (pt.news || 0), 0);
    const totalSns = trendSeries.reduce((sum, pt) => sum + (pt.sns || 0), 0);
    const grandTotal = totalNews + totalSns;
    const maxRowTotal = Math.max(
      ...trendSeries.map((pt) => (pt.news || 0) + (pt.sns || 0)),
      1
    );

    return (
      <div className="detail-view">
        {renderQuickSwitch()}
        {renderStockBanner({ showFullSummary: false })}

        <section className="card-panel trend-card">
          <div className="card-header">
            <div className="card-title">
              📈 {selectedStock.name} 뉴스·SNS 언급량 추이 상세
            </div>
            <ChipGroup
              options={TREND_PERIODS}
              value={trendPeriod}
              onChange={setTrendPeriod}
              ariaLabel="언급량 상세 주기 선택"
            />
          </div>
          <MentionTrendChart series={trendSeries} plotHeight={300} />
        </section>

        <section className="detail-two-col">
          <div className="card-panel">
            <div className="card-header">
              <div className="card-title">구간별 언급량 상세 수치표</div>
            </div>
            <table className="data-table">
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
                      <td className="num-col">{pt.news.toLocaleString()}건</td>
                      <td className="num-col">{pt.sns.toLocaleString()}건</td>
                      <td className="num-col total-col">
                        <div className="gauge-cell">
                          <div className="gauge-track" title={`비중 ${formatPercent(share)}`}>
                            <div
                              className="gauge-fill"
                              style={{ width: `${(rowTotal / maxRowTotal) * 100}%` }}
                            />
                          </div>
                          <b>{rowTotal.toLocaleString()}건</b>
                          <span className="gauge-share">{formatPercent(share)}</span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr>
                  <td>합계</td>
                  <td className="num-col">{totalNews.toLocaleString()}건</td>
                  <td className="num-col">{totalSns.toLocaleString()}건</td>
                  <td className="num-col total-col">
                    <div className="gauge-cell">
                      <span />
                      <b>{grandTotal.toLocaleString()}건</b>
                      <span className="gauge-share">100.0%</span>
                    </div>
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>

          <div className="card-panel">
            <div className="card-header">
              <div className="card-title">종목 이슈 요약 통계</div>
            </div>
            <dl className="stat-list">
              <div>
                <dt>오늘 매칭 글</dt>
                <dd className="num">{selectedStock.todayMatchedCount}건</dd>
              </div>
              <div>
                <dt>마지막 매칭</dt>
                <dd className="num">{selectedStock.lastMatchedAt}</dd>
              </div>
              <div>
                <dt>이슈 순위</dt>
                <dd className="num">{selectedStock.issueRank}위</dd>
              </div>
            </dl>
            <div className="sub-title">당일 AI 감성 비율</div>
            <SentimentBar ratio={currentSummary.sentimentRatio} />
            <div className="sub-title">당일 종합 요약</div>
            <p className="summary-box">{currentSummary.summary}</p>
          </div>
        </section>

        {renderComments()}
      </div>
    );
  };

  // ---------- 4. 이슈 순위 화면 (F-11) ----------
  const renderRankingView = () => (
    <div className="detail-view">
      <section className="card-panel">
        <div className="card-header">
          <div className="card-title">
            🔥 오늘의 뉴스·SNS 언급 급증 이슈 종목 전체 순위
          </div>
          <span className="card-hint">
            오늘 매칭된 글 수 기준 · 종목을 클릭하면 뉴스 상세 분석 화면으로 이동합니다
          </span>
        </div>
        <div className="ranking-grid">
          {rankedStocks.map((st, idx) => (
            <div
              key={st.code}
              className={`stock-row ranking-row ${st.code === selectedStockCode ? 'selected' : ''
                }`}
              role="button"
              tabIndex={0}
              aria-label={`이슈 ${idx + 1}위 ${st.name} 뉴스 상세 분석으로 이동`}
              onClick={() => {
                handleSelectStock(st.code, false);
                setActiveView('news');
                triggerToast(`🔥 ${idx + 1}위 ${st.name} 뉴스 상세 분석으로 이동했습니다.`);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  handleSelectStock(st.code, false);
                  setActiveView('news');
                  triggerToast(`🔥 ${idx + 1}위 ${st.name} 뉴스 상세 분석으로 이동했습니다.`);
                }
              }}
            >
              <div className="rank-no num">{idx + 1}</div>
              <div className="rank-body">
                <div className="stock-name">
                  {st.name} <span className="stock-code num">{st.code}</span>{' '}
                  <span className="market-tag">{st.market}</span>
                </div>
                <div className="stock-meta">
                  {st.sector} · 테마: {st.themes.join(', ')}
                </div>
                <div className="stock-meta num">
                  오늘 매칭 <strong>{st.todayMatchedCount}건</strong> · 긍정{' '}
                  <strong>{st.sentimentRatio.positive}%</strong> · 최근 {st.lastMatchedAt}
                </div>
              </div>
              <div className="stock-row-right">
                {renderPriceOrFallback(st, 'sm')}
                <button
                  type="button"
                  className="star-btn"
                  title={isInWatchlist(st.code) ? '관심종목 해제' : '관심종목 추가'}
                  aria-label={`${st.name} ${isInWatchlist(st.code) ? '관심종목 해제' : '관심종목 추가'
                    }`}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleToggleWatchlist(st.code);
                  }}
                >
                  {isInWatchlist(st.code) ? '★' : '☆'}
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>
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
          onClick={() => setActiveView('home')}
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
            onClick={() => setActiveView(item.key)}
          >
            <span className="nav-icon" aria-hidden="true">
              {item.icon}
            </span>
            <span>{item.label}</span>
          </button>
        ))}
      </nav>

      <div className="main-area">
        {/* 2. 상단 고정 헤더: 브랜드 · 통합 검색(기간·출처·자동완성) · 갱신 상태 · 로그인/회원가입 */}
        <header className="top-header">
          <div
            className="brand-title"
            onClick={() => setActiveView('home')}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') setActiveView('home');
            }}
          >
            <span>뉴스 × 종목 매칭 AI 대시보드</span>
            <span className="brand-sub">{activeNavItem.title}</span>
          </div>

          <div className="search-container">
            <div className="search-input-wrap">
              <input
                type="text"
                className="search-input"
                placeholder="종목(삼전, 005930, HBM3E) 또는 뉴스·SNS 키워드 통합 검색..."
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
                  title="검색어 지우기"
                >
                  ✕
                </button>
              )}

              {showAutocomplete && searchQuery.trim() && (
                <div
                  className="autocomplete-dropdown"
                  onMouseDown={(e) => e.preventDefault()}
                  role="listbox"
                  aria-label="통합 검색 자동완성 결과"
                >
                  {/* 섹션 ① 매칭 종목 */}
                  <div className="auto-section-label">
                    📈 매칭 종목 (종목명·코드·별칭·테마)
                  </div>
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
                            <span className="num">
                              ({s.code} · {s.market})
                            </span>
                          </span>
                          <span className="num">
                            {s.price !== null ? (
                              <RatePill rate={s.changeRate} size="sm" />
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

                  {/* 섹션 ② 매칭 뉴스·SNS 글 */}
                  <div className="auto-section-label">
                    📰 매칭 뉴스·SNS 글 (제목·3줄요약·키워드)
                  </div>
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
                          <span
                            className={`badge ${art.sourceType === 'NEWS' ? 'badge-news' : 'badge-sns'
                              }`}
                          >
                            {art.sourceType}
                          </span>{' '}
                          {art.title}
                        </span>
                        <span className="stock-meta num">{art.publishedAt.slice(5)}</span>
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>

            <select
              className="sort-select"
              value={searchPeriod}
              onChange={(e) => setSearchPeriod(e.target.value)}
              aria-label="통합 검색 기간 필터"
            >
              <option value="ALL">전체 기간</option>
              <option value="0">오늘</option>
              <option value="7">7일</option>
              <option value="30">30일</option>
            </select>

            <select
              className="sort-select"
              value={searchSource}
              onChange={(e) => setSearchSource(e.target.value)}
              aria-label="통합 검색 출처 필터"
            >
              <option value="ALL">전체 출처</option>
              <option value="NEWS">뉴스</option>
              <option value="SNS">SNS</option>
            </select>
          </div>

          <div className="header-right">
            <div className="header-status">
              <span className="live-indicator CONNECTED">
                <span className="live-dot" aria-hidden="true" />
                AI 분석 완료
              </span>
              <button
                type="button"
                className="feed-badge"
                title="클릭하여 시세·뉴스 데이터 새로고침"
                aria-label="데이터 새로고침"
                onClick={handleRefreshData}
              >
                <span>
                  시세/뉴스 최근 갱신 <b className="num">{sysStatus.lastUpdated.quote}</b> (5분 주기)
                </span>
                <span className="feed-divider" aria-hidden="true" />
                <span>🔄 새로고침</span>
              </button>
            </div>

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
        </header>

        {/* 3. 메인 콘텐츠 영역 */}
        <main className="main-content" ref={mainRef}>
          {activeView === 'home' && renderHome()}
          {activeView === 'news' && renderArticleView(true)}
          {activeView === 'sns' && renderArticleView(false)}
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
                className="search-input"
                placeholder="아이디 (예: tester01)"
                aria-label="아이디"
                value={authForm.username}
                onChange={(e) => setAuthForm({ ...authForm, username: e.target.value })}
                required
              />
              <input
                type="password"
                className="search-input"
                placeholder="비밀번호"
                aria-label="비밀번호"
                value={authForm.password}
                onChange={(e) => setAuthForm({ ...authForm, password: e.target.value })}
                required
              />
              {authMode === 'signup' && (
                <input
                  type="password"
                  className="search-input"
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

// src/pages/DashboardPage.jsx
import { useState, useMemo, useEffect, useRef } from 'react';
import {
    INITIAL_SYSTEM_STATUS,
    STOCKS_DATA,
    INITIAL_WATCHLIST_CODES,
    ARTICLES_DATA,
    STOCK_SUMMARIES_DATA,
    MENTION_TRENDS_DATA,
    INITIAL_STOCK_COMMENTS,
} from '../mocks/mockData';
import '../styles/dashboard.css';

// 왼쪽 사이드바 메뉴. 'home' 외의 항목을 누르면 오른쪽 메인 화면 전체가 해당 상세 화면으로 바뀝니다.
const NAV_ITEMS = [
    { key: 'home', icon: '🏠', label: '홈', title: '홈' },
    { key: 'news', icon: '📰', label: '뉴스', title: '뉴스 상세' },
    { key: 'sns', icon: '💬', label: 'SNS', title: 'SNS 반응 상세' },
    { key: 'mention', icon: '📈', label: '언급량', title: '언급량 추이 상세' },
    { key: 'ranking', icon: '🔥', label: '이슈순위', title: '실시간 이슈 종목 순위' },
    // 보류: 독립 '종목토론(게시판)' 메뉴는 숨김. 종목 댓글은 상세 화면 맨 아래에서 보고 작성합니다.
    // { key: 'board', icon: '🗨️', label: '종목토론', title: '종목별 전용 토론방' },
];

const TREND_PERIODS = [
    { key: 'today', label: '오늘' },
    { key: '7d', label: '7일' },
    { key: '30d', label: '30일' },
];

const ARTICLE_PERIODS = [
    { key: 'ALL', label: '전체 기간' },
    { key: '0', label: '오늘' },
    { key: '7', label: '7일' },
];

const STREAM_LABELS = {
    CONNECTED: '실시간 분석 가동중',
    RECONNECTING: '자동 재연결 중…',
    DISCONNECTED: '연결 끊김',
    ERROR: '수신 오류',
};

// 댓글 말머리: 작성한 탭을 댓글 문자열 앞에 붙여 저장합니다. (백엔드는 댓글 문자열 하나만 저장)
const COMMENT_TAGS = {
    news: { label: '뉴스', className: 'tag-news' },
    sns: { label: 'SNS', className: 'tag-sns' },
    mention: { label: '언급량', className: 'tag-mention' },
};
const COMMENT_TAG_PATTERN = /^\[(뉴스|SNS|언급량)\]\s*/;

// 댓글 길이 제한 (api.md 댓글 쓰기 규칙과 동일, 말머리 포함)
const COMMENT_MAX_LENGTH = 1000;

const stockByCode = (code) => STOCKS_DATA.find((s) => s.code === code);

const matchesStockQuery = (stock, q) =>
    stock.name.toLowerCase().includes(q) ||
    stock.code.includes(q) ||
    stock.aliases.some((al) => al.toLowerCase().includes(q));

const searchStocks = (query, limit) => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return STOCKS_DATA.filter((s) => matchesStockQuery(s, q)).slice(0, limit);
};

const formatRate = (rate) => `${rate > 0 ? '+' : ''}${rate.toFixed(2)}%`;
const rateTone = (rate) => (rate > 0 ? 'up' : rate < 0 ? 'down' : 'flat');
const formatPercent = (value) => `${(Math.round(value * 10) / 10).toFixed(1)}%`;

// 현재 시각을 한국 시간 ISO-8601 문자열로 만듭니다. 예: 2026-10-30T13:06:00+09:00
const nowIsoSeoul = () => {
    const kst = new Date(Date.now() + 9 * 60 * 60 * 1000);
    return `${kst.toISOString().slice(0, 19)}+09:00`;
};

// '2026-10-30T13:06:00+09:00' → '10-30 13:06'
const formatDateTime = (iso) => iso.slice(5, 16).replace('T', ' ');

// '[뉴스] 내용' → { tagKey: 'news', text: '내용' }. 말머리가 없으면 tagKey는 null
const parseComment = (content) => {
    const match = content.match(COMMENT_TAG_PATTERN);
    if (!match) return { tagKey: null, text: content };
    const tagKey = Object.keys(COMMENT_TAGS).find((key) => COMMENT_TAGS[key].label === match[1]) ?? null;
    return { tagKey, text: content.slice(match[0].length) };
};

const trendOf = (code) => MENTION_TRENDS_DATA[code] || MENTION_TRENDS_DATA.default;

// Y축 눈금: 최댓값을 덮는 깔끔한 간격(1·2·2.5·5 계열)으로 tickCount 칸을 만듭니다.
const niceScale = (maxValue, tickCount = 4) => {
    const rough = Math.max(maxValue, 1) / tickCount;
    const pow = 10 ** Math.floor(Math.log10(rough));
    const step = [1, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10].map((m) => m * pow).find((s) => s >= rough);
    const intStep = Math.max(1, Math.ceil(step));
    return {
        yMax: intStep * tickCount,
        ticks: Array.from({ length: tickCount + 1 }, (_, i) => i * intStep),
    };
};

function RatePill({ rate, size = 'md' }) {
    const tone = rateTone(rate);
    const arrow = tone === 'up' ? '▲' : tone === 'down' ? '▼' : '';
    return (
        <span className={`rate-pill ${tone} ${size}`}>
            {arrow && <span className="rate-arrow">{arrow}</span>}
            {formatRate(rate)}
        </span>
    );
}

function ChipGroup({ options, value, onChange }) {
    return (
        <div className="chip-group">
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

// 뉴스·SNS 언급량 막대그래프 (점선 그리드 + Y축 눈금, 피크 배지, hover 툴팁)
function MentionTrendChart({ series, plotHeight }) {
    const maxValue = Math.max(...series.map((d) => Math.max(d.news, d.sns)), 1);
    const { yMax, ticks } = niceScale(maxValue);
    const periodTotal = series.reduce((sum, d) => sum + d.news + d.sns, 0);
    const peak = series.reduce((best, d) => (d.news + d.sns > best.news + best.sns ? d : best), series[0]);

    return (
        <div className="trend-chart">
            <div className="trend-plot" style={plotHeight ? { height: `${plotHeight}px`, flex: 'none' } : undefined}>
                <div className="trend-area">
                    {ticks.map((t) => (
                        <div key={t} className="grid-line" style={{ bottom: `${(t / yMax) * 100}%` }}>
                            <span className="grid-value num">{t}</span>
                        </div>
                    ))}

                    <div className="trend-cols">
                        {series.map((pt) => {
                            const total = pt.news + pt.sns;
                            const newsPct = (pt.news / yMax) * 100;
                            const snsPct = (pt.sns / yMax) * 100;
                            const topPct = Math.max(newsPct, snsPct);
                            const share = periodTotal > 0 ? (total / periodTotal) * 100 : 0;
                            const isPeak = pt.label === peak.label && total > 0;
                            return (
                                <div key={pt.label} className={`trend-col ${isPeak ? 'peak' : ''}`}>
                                    {isPeak && (
                                        <span className="peak-badge" style={{ bottom: `calc(${topPct}% + 6px)` }}>
                                            🔥 피크
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
                                            <span><i className="legend-dot news" />뉴스</span>
                                            <b className="num">{pt.news}건</b>
                                        </div>
                                        <div className="tooltip-row">
                                            <span><i className="legend-dot sns" />SNS</span>
                                            <b className="num">{pt.sns}건</b>
                                        </div>
                                        <div className="tooltip-row total">
                                            <span>비중</span>
                                            <b className="num">{formatPercent(share)}</b>
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
                <span><i className="legend-dot news" /> 뉴스</span>
                <span><i className="legend-dot sns" /> SNS</span>
                <span className="legend-total">기간 합계 <b className="num">{periodTotal.toLocaleString()}건</b></span>
            </div>
        </div>
    );
}

function SentimentBar({ ratio }) {
    return (
        <div className="sentiment">
            <div className="sentiment-bar">
                <div className="seg pos" style={{ width: `${ratio.positive}%` }} />
                <div className="seg neu" style={{ width: `${ratio.neutral}%` }} />
                <div className="seg neg" style={{ width: `${ratio.negative}%` }} />
            </div>
            <div className="sentiment-legend num">
                <span className="up">긍정 {ratio.positive}%</span>
                <span>중립 {ratio.neutral}%</span>
                <span className="down">부정 {ratio.negative}%</span>
            </div>
        </div>
    );
}

function ArticleList({ articles, selectedId, onSelect }) {
    if (articles.length === 0) {
        return <div className="empty-text">조건에 맞는 글이 없습니다.</div>;
    }
    return (
        <div className="article-list">
            {articles.map((art) => {
                const isSns = art.sourceType !== 'NEWS';
                return (
                    <article
                        key={art.id}
                        className={`article-item ${selectedId === art.id ? 'selected' : ''}`}
                        onClick={() => onSelect(art.id)}
                    >
                        <div className="article-top-meta">
                            <span className={`badge ${isSns ? 'badge-sns' : 'badge-news'}`}>{art.sourceType}</span>
                            <span className="num">{art.press} · {art.publishedAt}</span>
                        </div>
                        <div className="article-title">{art.title}</div>
                        {isSns && <div className="sns-warning-inline">⚠️ 참고용 · 확인되지 않은 정보</div>}
                    </article>
                );
            })}
        </div>
    );
}

function ArticleDetail({ article }) {
    if (!article) {
        return <div className="empty-text">왼쪽 목록에서 글을 선택해 주세요.</div>;
    }
    return (
        <div className="article-detail">
            <div className="article-detail-head">
                <h3>{article.title}</h3>
                <a href={article.url} target="_blank" rel="noreferrer" className="btn-outline">
                    원문 보기 ↗
                </a>
            </div>
            <div className="stock-meta num">{article.press} · {article.publishedAt}</div>
            {article.sourceType !== 'NEWS' && (
                <div className="sns-warning-inline">⚠️ 참고용 · 확인되지 않은 정보 (SNS 출처)</div>
            )}
            <ul className="summary-lines">
                {article.summary.map((line, idx) => (
                    <li key={idx}>{line}</li>
                ))}
            </ul>

            <div className="sub-title">📌 종목 매칭 근거 (F-05 / F-06)</div>
            {article.relatedStocks.map((rel) => (
                <div key={rel.code} className="summary-box evidence-card">
                    <div className="evidence-head">
                        <span>{rel.name}</span>
                        <span className="num">
                            <span className={`badge ${rel.relationType === '직접' ? 'badge-direct' : 'badge-indirect'}`}>
                                {rel.relationType} 관련
                            </span>{' '}
                            관련도 {rel.relevance}%
                        </span>
                    </div>
                    <div className="evidence-reason">
                        <strong>연결 이유:</strong> {rel.reason}
                    </div>
                    <div className="evidence-quote">
                        <strong>근거 원문:</strong> {rel.evidence}
                    </div>
                </div>
            ))}
        </div>
    );
}

// 종목 상세 화면 맨 아래 '실시간 종목토론' (뉴스·SNS·언급량 탭이 같은 댓글을 공유)
function StockComments({ stock, comments, user, tabKey, onAdd, onDelete, onRequireLogin }) {
    const [draft, setDraft] = useState('');
    const [filterMode, setFilterMode] = useState('all'); // all | tab

    const currentTag = COMMENT_TAGS[tabKey];
    const prefix = currentTag ? `[${currentTag.label}] ` : '';

    const parsedComments = useMemo(
        () => comments.map((c) => ({ ...c, ...parseComment(c.content) })),
        [comments]
    );
    const visibleComments =
        filterMode === 'tab' ? parsedComments.filter((c) => c.tagKey === tabKey) : parsedComments;

    const handleSubmit = (e) => {
        e.preventDefault();
        if (!user) {
            onRequireLogin();
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
                    <span className="card-caption">뉴스·SNS·언급량 탭에서 실시간 공유되는 종목 의견입니다</span>
                </div>
                <div className="segmented" role="group" aria-label="의견 필터">
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
            </div>

            {visibleComments.length === 0 ? (
                <div className="empty-text">
                    {filterMode === 'tab'
                        ? `[${currentTag?.label}] 탭에서 남긴 의견이 아직 없습니다.`
                        : '아직 등록된 의견이 없습니다.'}
                </div>
            ) : (
                <ul className="comment-list">
                    {visibleComments.map((c) => (
                        <li key={c.commentId} className="comment-item">
                            <div className="comment-meta">
                                {c.tagKey && (
                                    <span className={`comment-tag ${COMMENT_TAGS[c.tagKey].className}`}>
                                        {COMMENT_TAGS[c.tagKey].label}
                                    </span>
                                )}
                                <strong>{c.author}</strong>
                                <span className="num">{formatDateTime(c.createdAt)}</span>
                                {user?.username === c.author && (
                                    <button type="button" className="link-btn" onClick={() => onDelete(c.commentId)}>
                                        삭제
                                    </button>
                                )}
                            </div>
                            <p className="comment-content">{c.text}</p>
                        </li>
                    ))}
                </ul>
            )}

            <form className="comment-form" onSubmit={handleSubmit}>
                <textarea
                    className="comment-input"
                    rows={3}
                    maxLength={COMMENT_MAX_LENGTH - prefix.length}
                    placeholder={
                        user
                            ? `${stock.name}에 대한 의견을 남겨 주세요.`
                            : '로그인 후 댓글을 작성할 수 있습니다. 첫 댓글을 남겨보세요!'
                    }
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                />
                <div className="comment-form-footer">
                    <span className="stock-meta">
                        {currentTag && (
                            <>
                                <span className={`comment-tag ${currentTag.className}`}>{currentTag.label}</span>{' '}
                                말머리가 자동으로 붙습니다 ·{' '}
                            </>
                        )}
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
    const [activeView, setActiveView] = useState('home'); // home | news | sns | mention | ranking
    const [watchlistCodes, setWatchlistCodes] = useState(INITIAL_WATCHLIST_CODES);
    const [selectedStockCode, setSelectedStockCode] = useState(INITIAL_WATCHLIST_CODES[0] || STOCKS_DATA[0].code);
    const [selectedArticleId, setSelectedArticleId] = useState(null);

    // 관심종목 추가 입력
    const [watchAddQuery, setWatchAddQuery] = useState('');

    // 상단 종목 검색 및 자동완성
    const [searchQuery, setSearchQuery] = useState('');
    const [showAutocomplete, setShowAutocomplete] = useState(false);

    // 언급량 추이 기간, 뉴스·SNS 목록 기간·정렬
    const [trendPeriod, setTrendPeriod] = useState('today'); // today | 7d | 30d
    const [articlePeriod, setArticlePeriod] = useState('ALL'); // ALL | 0 | 7 (일)
    const [articleSort, setArticleSort] = useState('latest'); // latest | relevance

    // 시스템 상태 및 로그인, 토스트 메시지 상태
    const [sysStatus, setSysStatus] = useState(INITIAL_SYSTEM_STATUS);
    const [user, setUser] = useState(null);
    const [showLoginModal, setShowLoginModal] = useState(false);
    const [loginForm, setLoginForm] = useState({ username: '', password: '' });
    const [toast, setToast] = useState(null);

    // 종목별 댓글
    const [commentsByStock, setCommentsByStock] = useState(INITIAL_STOCK_COMMENTS);

    const mainRef = useRef(null);

    // 토스트 팝업 트리거 함수
    const triggerToast = (msg) => setToast({ id: Date.now(), text: msg });

    useEffect(() => {
        if (!toast) return undefined;
        const timer = setTimeout(() => setToast(null), 2500);
        return () => clearTimeout(timer);
    }, [toast]);

    // 화면을 바꾸면 메인 영역 스크롤을 맨 위로
    useEffect(() => {
        mainRef.current?.scrollTo({ top: 0 });
    }, [activeView]);

    // 실시간 연결 상태 자동 재연결 시뮬레이션 (N-08)
    useEffect(() => {
        if (sysStatus.streamStatus === 'RECONNECTING') {
            const timer = setTimeout(() => {
                setSysStatus((prev) => ({
                    ...prev,
                    streamStatus: 'CONNECTED',
                    lastUpdated: {
                        ...prev.lastUpdated,
                        quote: new Date().toTimeString().slice(0, 8),
                    },
                }));
                setToast({ id: Date.now(), text: '⚡ 실시간 시세 스트리밍 자동 재연결 완료' });
            }, 3000);
            return () => clearTimeout(timer);
        }
        return undefined;
    }, [sysStatus.streamStatus]);

    const selectedStock = stockByCode(selectedStockCode) || STOCKS_DATA[0];
    const isInWatchlist = (code) => watchlistCodes.includes(code);

    const watchlistStocks = useMemo(
        () => watchlistCodes.map(stockByCode).filter(Boolean),
        [watchlistCodes]
    );

    const headerSearchResults = useMemo(() => searchStocks(searchQuery, 8), [searchQuery]);
    const watchAddCandidates = useMemo(() => searchStocks(watchAddQuery, 6), [watchAddQuery]);

    // 뉴스·SNS 상세 화면에 보여 줄 선택 종목의 글 목록
    const detailArticles = useMemo(() => {
        if (activeView !== 'news' && activeView !== 'sns') return [];
        const wantNews = activeView === 'news';
        const relevanceOf = (art) =>
            art.relatedStocks.find((r) => r.code === selectedStockCode)?.relevance ?? 0;
        return ARTICLES_DATA.filter((art) => (art.sourceType === 'NEWS') === wantNews)
            .filter((art) => art.relatedStocks.some((r) => r.code === selectedStockCode))
            .filter((art) => articlePeriod === 'ALL' || art.daysAgo <= Number(articlePeriod))
            .sort((a, b) =>
                articleSort === 'relevance'
                    ? relevanceOf(b) - relevanceOf(a)
                    : b.publishedAt.localeCompare(a.publishedAt)
            );
    }, [activeView, selectedStockCode, articlePeriod, articleSort]);

    const selectedArticle =
        detailArticles.find((a) => a.id === selectedArticleId) || detailArticles[0] || null;

    const currentSummary = STOCK_SUMMARIES_DATA[selectedStockCode] || null;
    const currentTrend = trendOf(selectedStockCode);
    const trendSeries = currentTrend[trendPeriod] || currentTrend.today;
    const currentComments = commentsByStock[selectedStockCode] || [];

    // 요약 배너용 오늘 뉴스·SNS 매칭 건수 (오늘 1시간 단위 언급량 합계)
    const todayCounts = useMemo(
        () =>
            (trendOf(selectedStockCode).today || []).reduce(
                (acc, pt) => ({ news: acc.news + pt.news, sns: acc.sns + pt.sns }),
                { news: 0, sns: 0 }
            ),
        [selectedStockCode]
    );

    const rankedStocks = useMemo(
        () => [...STOCKS_DATA].sort((a, b) => b.todayMatchedCount - a.todayMatchedCount),
        []
    );

    const requireLogin = (msg) => {
        triggerToast(msg);
        setShowLoginModal(true);
    };

    const handleSelectStock = (code) => {
        setSelectedStockCode(code);
        setSelectedArticleId(null);
    };

    const handleRefreshData = () => {
        const nowStr = new Date().toTimeString().slice(0, 8);
        setSysStatus((prev) => ({
            ...prev,
            lastUpdated: {
                quote: nowStr,
                newsSns: nowStr,
                summary: nowStr,
            },
        }));
        triggerToast(`🔄 최신 데이터로 갱신되었습니다. (${nowStr})`);
    };

    const handleCycleStreamStatus = () => {
        const order = ['CONNECTED', 'RECONNECTING', 'DISCONNECTED'];
        const next = order[(order.indexOf(sysStatus.streamStatus) + 1) % order.length];
        setSysStatus((prev) => ({ ...prev, streamStatus: next }));
        triggerToast(`⚡ 시세 스트리밍 상태: ${next}`);
    };

    // 관심종목 추가 (POST /api/watchlist { stockCode } 자리). 성공하면 true
    const handleAddWatchlist = (code) => {
        if (!user) {
            requireLogin('🔒 관심종목 추가는 로그인이 필요합니다.');
            return false;
        }
        const stock = stockByCode(code);
        if (!stock) return false;
        if (watchlistCodes.includes(code)) {
            triggerToast(`이미 관심종목에 있는 종목입니다: ${stock.name}`);
            return false;
        }
        // 최근 추가 순 (GET /api/watchlist 정렬과 동일)
        setWatchlistCodes((prev) => [code, ...prev]);
        triggerToast(`★ ${stock.name} 관심종목에 추가했습니다.`);
        return true;
    };

    // 관심종목 삭제 (DELETE /api/watchlist/{stockCode} 자리)
    const handleRemoveWatchlist = (code) => {
        if (!user) {
            requireLogin('🔒 관심종목 삭제는 로그인이 필요합니다.');
            return;
        }
        const stock = stockByCode(code);
        setWatchlistCodes((prev) => prev.filter((c) => c !== code));
        triggerToast(`☆ ${stock?.name ?? code} 관심종목에서 삭제했습니다.`);
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
            triggerToast('추가할 종목명이나 종목코드를 입력하세요.');
            return;
        }
        const target = watchAddCandidates.find((s) => !isInWatchlist(s.code));
        if (!target) {
            triggerToast(
                watchAddCandidates.length > 0
                    ? '검색된 종목이 모두 관심종목에 있습니다.'
                    : '일치하는 종목을 찾지 못했습니다.'
            );
            return;
        }
        if (handleAddWatchlist(target.code)) setWatchAddQuery('');
    };

    const handlePickWatchCandidate = (code) => {
        if (handleAddWatchlist(code)) setWatchAddQuery('');
    };

    const handleSelectSearchResult = (stock) => {
        handleSelectStock(stock.code);
        setSearchQuery('');
        setShowAutocomplete(false);
        triggerToast(`🔍 ${stock.name}(${stock.code}) 종목을 선택했습니다.`);
    };

    const handleLoginSubmit = (e) => {
        e.preventDefault();
        if (!loginForm.username.trim() || !loginForm.password.trim()) return;
        setUser({ username: loginForm.username.trim() });
        setShowLoginModal(false);
        setLoginForm({ username: '', password: '' });
        triggerToast(`👋 환영합니다, ${loginForm.username.trim()}님!`);
    };

    const handleLogout = () => {
        setUser(null);
        triggerToast('로그아웃했습니다.');
    };

    // content에는 '[뉴스] 내용'처럼 말머리가 붙은 문자열이 들어옵니다.
    const handleAddComment = (content) => {
        const newComment = {
            commentId: Date.now(),
            stockCode: selectedStockCode,
            author: user.username,
            content,
            createdAt: nowIsoSeoul(),
        };
        setCommentsByStock((prev) => ({
            ...prev,
            [selectedStockCode]: [...(prev[selectedStockCode] || []), newComment],
        }));
        triggerToast('💬 의견을 등록했습니다.');
    };

    const handleDeleteComment = (commentId) => {
        setCommentsByStock((prev) => ({
            ...prev,
            [selectedStockCode]: (prev[selectedStockCode] || []).filter((c) => c.commentId !== commentId),
        }));
        triggerToast('의견을 삭제했습니다.');
    };

    const activeNavItem = NAV_ITEMS.find((n) => n.key === activeView) || NAV_ITEMS[0];
    const lastUpdatedShort = sysStatus.lastUpdated.quote.slice(0, 5);

    // ---------- 선택 종목 프로 요약 배너 (홈·상세 공통) ----------
    const renderStockBanner = ({ withWatchToggle = false } = {}) => (
        <section className="card-panel stock-banner">
            <div className="banner-top">
                <div className="banner-id">
                    <div className="banner-name-row">
                        <h2 className="banner-name">{selectedStock.name}</h2>
                        <span className="stock-code num">{selectedStock.code}</span>
                        <span className="market-tag">{selectedStock.market}</span>
                        {isInWatchlist(selectedStock.code) && <span className="watch-mark" title="관심종목">★</span>}
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
                    <span className="price-big num">
                        {selectedStock.price.toLocaleString()}
                        <small>원</small>
                    </span>
                    <RatePill rate={selectedStock.changeRate} size="lg" />
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
                        <span className="stat-label">마지막 매칭</span>
                        <span className="stat-value num">{selectedStock.lastMatchedAt}</span>
                    </div>
                </div>
                <div className="ai-oneliner">
                    <span className="ai-badge">AI 핵심 요약</span>
                    <p>{currentSummary?.headline ?? '아직 이 종목의 AI 요약이 없습니다.'}</p>
                </div>
                {withWatchToggle && (
                    <button
                        type="button"
                        className={`btn-outline watch-toggle ${isInWatchlist(selectedStock.code) ? 'on' : ''}`}
                        onClick={() => handleToggleWatchlist(selectedStock.code)}
                    >
                        {isInWatchlist(selectedStock.code) ? '★ 관심종목 해제' : '☆ 관심종목 추가'}
                    </button>
                )}
            </div>
        </section>
    );

    // ---------- 홈 화면 ----------
    const renderHome = () => (
        <div className="home-grid">
            <section className="card-panel watchlist-card">
                <div className="card-header">
                    <div className="card-title">
                        ⭐ 관심종목 <span className="count-badge num">{watchlistStocks.length}</span>
                    </div>
                    {!user && <span className="card-hint">추가·삭제는 로그인 후 가능</span>}
                </div>

                <form className="watch-add" onSubmit={handleWatchAddSubmit}>
                    <div className="search-input-wrap">
                        <input
                            type="text"
                            className="search-input"
                            placeholder="종목명·코드로 관심종목 추가"
                            value={watchAddQuery}
                            onChange={(e) => setWatchAddQuery(e.target.value)}
                        />
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
                        <div className="empty-text">관심종목이 없습니다. 위 입력창에서 관심종목을 추가해보세요.</div>
                    )}
                    {watchlistStocks.map((st) => (
                        <div
                            key={st.code}
                            className={`stock-row ${st.code === selectedStockCode ? 'selected' : ''}`}
                            onClick={() => handleSelectStock(st.code)}
                        >
                            <div className="stock-name-group">
                                <div className="stock-name">{st.name}</div>
                                <div className="stock-meta num">
                                    {st.code} · 매칭 {st.todayMatchedCount}건
                                </div>
                            </div>
                            <div className="stock-row-right">
                                <div className="stock-price-group">
                                    <div className="price-text num">{st.price.toLocaleString()}원</div>
                                    <RatePill rate={st.changeRate} size="sm" />
                                </div>
                                <button
                                    type="button"
                                    className="remove-btn"
                                    title="관심종목에서 삭제하기"
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

            <div className="home-right">
                {renderStockBanner()}

                <section className="card-panel trend-card">
                    <div className="card-header">
                        <div className="card-title">📈 검색량(언급량) 추이</div>
                        <ChipGroup options={TREND_PERIODS} value={trendPeriod} onChange={setTrendPeriod} />
                    </div>
                    <MentionTrendChart series={trendSeries} />
                    <div className="card-footer">
                        <button type="button" className="btn-text" onClick={() => setActiveView('mention')}>
                            언급량 상세 보기 →
                        </button>
                    </div>
                </section>
            </div>
        </div>
    );

    // ---------- 상세 화면 공통: 관심종목 빠른 전환 바 (상단 고정) ----------
    const renderQuickSwitch = () => {
        const extraStock = isInWatchlist(selectedStock.code) ? null : selectedStock;
        return (
            <nav className="quick-switch" aria-label="관심종목 빠른 전환">
                <span className="quick-label">관심종목</span>
                <div className="quick-chips">
                    {extraStock && (
                        <button type="button" className="quick-chip active" title="검색으로 선택한 종목">
                            <span className="quick-chip-tag">선택</span>
                            <span className="quick-chip-name">{extraStock.name}</span>
                            <span className={`quick-chip-rate num ${rateTone(extraStock.changeRate)}`}>
                                {formatRate(extraStock.changeRate)}
                            </span>
                        </button>
                    )}
                    {watchlistStocks.map((st) => (
                        <button
                            key={st.code}
                            type="button"
                            className={`quick-chip ${st.code === selectedStockCode ? 'active' : ''}`}
                            onClick={() => handleSelectStock(st.code)}
                        >
                            <span className="quick-chip-name">{st.name}</span>
                            <span className={`quick-chip-rate num ${rateTone(st.changeRate)}`}>
                                {formatRate(st.changeRate)}
                            </span>
                        </button>
                    ))}
                    {watchlistStocks.length === 0 && (
                        <span className="stock-meta">관심종목을 추가하면 여기서 바로 전환할 수 있습니다.</span>
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
            onRequireLogin={() => requireLogin('🔒 종목토론 작성은 로그인이 필요합니다.')}
        />
    );

    // ---------- 뉴스 / SNS 상세 화면 ----------
    const renderArticleView = (isNews) => (
        <div className="detail-view">
            {renderQuickSwitch()}
            {renderStockBanner({ withWatchToggle: true })}

            <section className="card-panel">
                <div className="card-header">
                    <div className="card-title">
                        {isNews ? '📰' : '💬'} {selectedStock.name} {isNews ? '뉴스 종합 요약' : 'SNS 반응 요약'}
                    </div>
                    {currentSummary && <span className="stock-meta num">요약 갱신 {currentSummary.updatedAt}</span>}
                </div>
                {currentSummary ? (
                    <>
                        <p className="summary-box">{isNews ? currentSummary.newsSummary : currentSummary.snsSummary}</p>
                        {!isNews && <SentimentBar ratio={currentSummary.sentimentRatio} />}
                    </>
                ) : (
                    <div className="empty-text">아직 이 종목의 요약이 없습니다.</div>
                )}
                {!isNews && (
                    <div className="sns-warning-inline sns-warning-block">
                        ⚠️ SNS 게시글은 신뢰도 검증 전인 참고용 정보입니다.
                    </div>
                )}
            </section>

            <section className="detail-two-col">
                <div className="card-panel">
                    <div className="card-header">
                        <div className="card-title">
                            {isNews ? '뉴스 목록' : 'SNS 글 목록'}{' '}
                            <span className="count-badge num">{detailArticles.length}</span>
                        </div>
                    </div>
                    <div className="filter-bar">
                        <ChipGroup options={ARTICLE_PERIODS} value={articlePeriod} onChange={setArticlePeriod} />
                        <select
                            className="sort-select"
                            value={articleSort}
                            onChange={(e) => setArticleSort(e.target.value)}
                        >
                            <option value="latest">최신순</option>
                            <option value="relevance">관련도순</option>
                        </select>
                    </div>
                    <ArticleList
                        articles={detailArticles}
                        selectedId={selectedArticle?.id}
                        onSelect={setSelectedArticleId}
                    />
                </div>
                <div className="card-panel">
                    <div className="card-header">
                        <div className="card-title">🔍 선택 글 상세 및 연결 근거</div>
                    </div>
                    <ArticleDetail article={selectedArticle} />
                </div>
            </section>

            {renderComments()}
        </div>
    );

    // ---------- 언급량 상세 화면 ----------
    const renderMentionView = () => {
        const totalNews = trendSeries.reduce((sum, pt) => sum + pt.news, 0);
        const totalSns = trendSeries.reduce((sum, pt) => sum + pt.sns, 0);
        const grandTotal = totalNews + totalSns;
        const maxRowTotal = Math.max(...trendSeries.map((pt) => pt.news + pt.sns), 1);
        return (
            <div className="detail-view">
                {renderQuickSwitch()}
                {renderStockBanner({ withWatchToggle: true })}

                <section className="card-panel trend-card">
                    <div className="card-header">
                        <div className="card-title">📈 {selectedStock.name} 뉴스·SNS 언급량 추이</div>
                        <ChipGroup options={TREND_PERIODS} value={trendPeriod} onChange={setTrendPeriod} />
                    </div>
                    <MentionTrendChart series={trendSeries} plotHeight={300} />
                </section>

                <section className="detail-two-col">
                    <div className="card-panel">
                        <div className="card-header">
                            <div className="card-title">구간별 언급량</div>
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
                                    const rowTotal = pt.news + pt.sns;
                                    const share = grandTotal > 0 ? (rowTotal / grandTotal) * 100 : 0;
                                    return (
                                        <tr key={pt.label} className={rowTotal === maxRowTotal ? 'peak-row' : ''}>
                                            <td className="num">{pt.label}</td>
                                            <td className="num-col">{pt.news.toLocaleString()}</td>
                                            <td className="num-col">{pt.sns.toLocaleString()}</td>
                                            <td className="num-col total-col">
                                                <div className="gauge-cell">
                                                    <div className="gauge-track" title={`비중 ${formatPercent(share)}`}>
                                                        <div
                                                            className="gauge-fill"
                                                            style={{ width: `${(rowTotal / maxRowTotal) * 100}%` }}
                                                        />
                                                    </div>
                                                    <b>{rowTotal.toLocaleString()}</b>
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
                                    <td className="num-col">{totalNews.toLocaleString()}</td>
                                    <td className="num-col">{totalSns.toLocaleString()}</td>
                                    <td className="num-col total-col">
                                        <div className="gauge-cell">
                                            <span />
                                            <b>{grandTotal.toLocaleString()}</b>
                                            <span className="gauge-share">100.0%</span>
                                        </div>
                                    </td>
                                </tr>
                            </tfoot>
                        </table>
                    </div>
                    <div className="card-panel">
                        <div className="card-header">
                            <div className="card-title">종목 이슈 요약</div>
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
                        {currentSummary && (
                            <>
                                <div className="sub-title">SNS 감성 비율</div>
                                <SentimentBar ratio={currentSummary.sentimentRatio} />
                            </>
                        )}
                    </div>
                </section>

                {renderComments()}
            </div>
        );
    };

    // ---------- 이슈 순위 화면 ----------
    const renderRankingView = () => (
        <div className="detail-view">
            <section className="card-panel">
                <div className="card-header">
                    <div className="card-title">🔥 실시간 뉴스·SNS 언급 급증 이슈 종목 순위</div>
                    <span className="card-hint">종목을 누르면 뉴스 상세로 이동</span>
                </div>
                <div className="ranking-grid">
                    {rankedStocks.map((st, idx) => (
                        <div
                            key={st.code}
                            className="stock-row ranking-row"
                            onClick={() => {
                                handleSelectStock(st.code);
                                setActiveView('news');
                            }}
                        >
                            <div className="rank-no num">{idx + 1}</div>
                            <div className="rank-body">
                                <div className="stock-name">{st.name}</div>
                                <div className="stock-meta">테마: {st.themes.join(', ')}</div>
                            </div>
                            <div className="stock-price-group">
                                <div className="price-text num">{st.price.toLocaleString()}원</div>
                                <RatePill rate={st.changeRate} size="sm" />
                            </div>
                        </div>
                    ))}
                </div>
            </section>
        </div>
    );

    return (
        <div className="app-shell">
            {/* 1. 왼쪽 사이드바 */}
            <nav className="left-nav-menu" aria-label="메인 네비게이션">
                <div className="nav-logo" title="뉴스×종목 매칭 대시보드">
                    N×S
                </div>
                {NAV_ITEMS.map((item) => (
                    <button
                        key={item.key}
                        type="button"
                        className={`nav-item-btn ${activeView === item.key ? 'active' : ''}`}
                        onClick={() => setActiveView(item.key)}
                    >
                        <span className="nav-icon">{item.icon}</span>
                        <span>{item.label}</span>
                    </button>
                ))}
            </nav>

            <div className="main-area">
                {/* 2. 상단 헤더: 서비스명 · 종목 검색 · 실시간 상태 · 로그인 */}
                <header className="top-header">
                    <div className="brand-title">
                        <span>뉴스 × 종목 매칭 AI 대시보드</span>
                        <span className="brand-sub">{activeNavItem.title}</span>
                    </div>

                    <div className="search-container">
                        <div className="search-input-wrap">
                            <input
                                type="text"
                                className="search-input"
                                placeholder="종목 검색 (삼성전자, 삼전, 005930)"
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
                                    onMouseDown={(e) => e.preventDefault()}
                                    onClick={() => setSearchQuery('')}
                                    title="검색어 지우기"
                                >
                                    ✕
                                </button>
                            )}

                            {showAutocomplete && searchQuery.trim() && (
                                // mousedown 기본 동작을 막아 입력창 blur 전에 클릭이 처리되게 합니다.
                                <div className="autocomplete-dropdown" onMouseDown={(e) => e.preventDefault()}>
                                    <div className="auto-section-label">종목 검색 결과</div>
                                    {headerSearchResults.length === 0 && (
                                        <div className="auto-empty">일치하는 종목이 없습니다.</div>
                                    )}
                                    {headerSearchResults.map((s) => (
                                        <div key={s.code} className="auto-row">
                                            <button
                                                type="button"
                                                className="auto-item"
                                                onClick={() => handleSelectSearchResult(s)}
                                            >
                                                <span>
                                                    <strong>{s.name}</strong> <span className="num">({s.code})</span>
                                                </span>
                                                <RatePill rate={s.changeRate} size="sm" />
                                            </button>
                                            <button
                                                type="button"
                                                className="star-btn"
                                                title={isInWatchlist(s.code) ? '관심종목 해제' : '관심종목 추가'}
                                                onClick={() => handleToggleWatchlist(s.code)}
                                            >
                                                {isInWatchlist(s.code) ? '★' : '☆'}
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="header-right">
                        <div className="header-status">
                            <button
                                type="button"
                                className={`live-indicator ${sysStatus.streamStatus}`}
                                title="클릭하여 상태변경 테스트"
                                onClick={handleCycleStreamStatus}
                            >
                                <span className="live-dot" aria-hidden="true" />
                                {STREAM_LABELS[sysStatus.streamStatus] ?? sysStatus.streamStatus}
                            </button>
                            <button
                                type="button"
                                className="feed-badge"
                                title="클릭하여 최신 데이터로 새로고침"
                                onClick={handleRefreshData}
                            >
                                <span>KIS 시세 · AI 매칭</span>
                                <span className="feed-divider" aria-hidden="true" />
                                <span>
                                    최근 갱신 <b className="num">{lastUpdatedShort}</b>
                                </span>
                            </button>
                        </div>

                        {user ? (
                            <>
                                <span className="user-name">{user.username}님</span>
                                <button type="button" className="btn-outline" onClick={handleLogout}>
                                    로그아웃
                                </button>
                            </>
                        ) : (
                            <button type="button" className="btn-primary" onClick={() => setShowLoginModal(true)}>
                                로그인
                            </button>
                        )}
                    </div>
                </header>

                {/* 3. 메인 콘텐츠: 홈 또는 사이드바에서 고른 상세 화면 */}
                <main className="main-content" ref={mainRef}>
                    {activeView === 'home' && renderHome()}
                    {activeView === 'news' && renderArticleView(true)}
                    {activeView === 'sns' && renderArticleView(false)}
                    {activeView === 'mention' && renderMentionView()}
                    {activeView === 'ranking' && renderRankingView()}
                </main>
            </div>

            {/* 알림 토스트 팝업 */}
            {toast && (
                <div key={toast.id} className="toast-popup">
                    {toast.text}
                </div>
            )}

            {showLoginModal && (
                <div className="modal-backdrop" onClick={() => setShowLoginModal(false)}>
                    <div className="modal-card" onClick={(e) => e.stopPropagation()}>
                        <h3 style={{ marginBottom: '12px' }}>로그인</h3>
                        <p style={{ fontSize: '12px', color: '#6B7684', marginBottom: '12px' }}>
                            관심종목 추가·삭제와 종목토론 작성을 위해 로그인이 필요합니다.
                        </p>
                        <form onSubmit={handleLoginSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                            <input
                                type="text"
                                className="search-input"
                                placeholder="아이디"
                                value={loginForm.username}
                                onChange={(e) => setLoginForm({ ...loginForm, username: e.target.value })}
                                required
                            />
                            <input
                                type="password"
                                className="search-input"
                                placeholder="비밀번호"
                                value={loginForm.password}
                                onChange={(e) => setLoginForm({ ...loginForm, password: e.target.value })}
                                required
                            />
                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '6px' }}>
                                <button type="button" className="btn-outline" onClick={() => setShowLoginModal(false)}>
                                    취소
                                </button>
                                <button type="submit" className="btn-primary">
                                    로그인
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}

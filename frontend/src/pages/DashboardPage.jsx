// src/pages/DashboardPage.jsx
import { useState, useMemo, useEffect } from 'react';
import {
    INITIAL_SYSTEM_STATUS,
    STOCKS_DATA,
    ARTICLES_DATA,
    STOCK_SUMMARIES_DATA,
    MENTION_TRENDS_DATA,
    INITIAL_BOARD_POSTS,
} from '../data/mockData';
import '../styles/dashboard.css';

export default function DashboardPage() {
    const [activeNav, setActiveNav] = useState('dashboard'); // dashboard | ranking | board
    const [stocks, setStocks] = useState(STOCKS_DATA);
    const [selectedStockCode, setSelectedStockCode] = useState('005930');
    const [selectedArticleId, setSelectedArticleId] = useState('art-101');

    // 좌측 종목 리스트 탭 및 정렬
    const [stockTab, setStockTab] = useState('watchlist'); // watchlist | all
    const [stockSort, setStockSort] = useState('default');

    // 뉴스·SNS 필터 및 정렬
    const [sourceFilter, setSourceFilter] = useState('ALL'); // ALL | NEWS | SNS
    const [articleSort, setArticleSort] = useState('latest');

    // 통합 검색 및 자동완성
    const [searchQuery, setSearchQuery] = useState('');
    const [searchPeriod, setSearchPeriod] = useState('ALL');
    const [showAutocomplete, setShowAutocomplete] = useState(false);

    // 언급량 추이 기간
    const [trendPeriod, setTrendPeriod] = useState('today'); // today | 7d | 30d

    // 시스템 상태 및 로그인, 토스트 메시지 상태
    const [sysStatus, setSysStatus] = useState(INITIAL_SYSTEM_STATUS);
    const [summaries, setSummaries] = useState(STOCK_SUMMARIES_DATA);
    const [user, setUser] = useState(null);
    const [showLoginModal, setShowLoginModal] = useState(false);
    const [loginForm, setLoginForm] = useState({ username: '', password: '' });
    const [toastMessage, setToastMessage] = useState(null);

    const [boardPosts, setBoardPosts] = useState(INITIAL_BOARD_POSTS);
    const [newPostTitle, setNewPostTitle] = useState('');
    const [newPostContent, setNewPostContent] = useState('');

    // 토스트 팝업 트리거 함수
    const triggerToast = (msg) => {
        setToastMessage(msg);
        setTimeout(() => setToastMessage(null), 2500);
    };

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
                triggerToast('⚡ 실시간 시세 스트리밍 자동 재연결 완료');
            }, 3000);
            return () => clearTimeout(timer);
        }
    }, [sysStatus.streamStatus]);

    const selectedStock = useMemo(
        () => stocks.find((s) => s.code === selectedStockCode) || stocks[0],
        [stocks, selectedStockCode]
    );

    const displayedStocks = useMemo(() => {
        let list = [...stocks];
        if (stockTab === 'watchlist' && activeNav !== 'ranking') {
            list = list.filter((s) => s.isWatchlist);
        }
        if (stockSort === 'up') {
            list = list.filter((s) => s.changeRate > 0).sort((a, b) => b.changeRate - a.changeRate);
        } else if (stockSort === 'down') {
            list = list.filter((s) => s.changeRate < 0).sort((a, b) => a.changeRate - b.changeRate);
        }
        return list;
    }, [stocks, stockTab, stockSort, activeNav]);

    const filteredArticles = useMemo(() => {
        const matched = ARTICLES_DATA.filter((art) => {
            if (searchPeriod !== 'ALL' && art.daysAgo > Number(searchPeriod)) return false;
            if (sourceFilter === 'NEWS' && art.sourceType !== 'NEWS') return false;
            if (sourceFilter === 'SNS' && art.sourceType === 'NEWS') return false;

            const hasStock = art.relatedStocks.some((r) => r.code === selectedStockCode);
            if (!hasStock && selectedStockCode !== '005930') return false;
            return true;
        });

        const finalList = matched.length > 0 ? matched : ARTICLES_DATA;

        return finalList.sort((a, b) => {
            if (articleSort === 'relevance') {
                const relA = a.relatedStocks.find((r) => r.code === selectedStockCode)?.relevance || 75;
                const relB = b.relatedStocks.find((r) => r.code === selectedStockCode)?.relevance || 75;
                return relB - relA;
            }
            return b.publishedAt.localeCompare(a.publishedAt);
        });
    }, [selectedStockCode, sourceFilter, articleSort, searchPeriod]);

    const selectedArticle = useMemo(() => {
        return (
            filteredArticles.find((a) => a.id === selectedArticleId) ||
            filteredArticles[0] ||
            null
        );
    }, [filteredArticles, selectedArticleId]);

    const matchedSnsForArticle = useMemo(() => {
        const snsList = ARTICLES_DATA.filter((art) => art.sourceType !== 'NEWS');
        return snsList.length > 0 ? snsList.slice(0, 5) : ARTICLES_DATA.slice(0, 3);
    }, []);

    const searchResults = useMemo(() => {
        const q = searchQuery.trim().toLowerCase();
        if (!q) return { matchedStocks: [], matchedArticles: [] };
        const matchedStocks = stocks.filter(
            (s) =>
                s.name.toLowerCase().includes(q) ||
                s.code.includes(q) ||
                s.aliases.some((al) => al.toLowerCase().includes(q))
        );
        const matchedArticles = ARTICLES_DATA.filter(
            (a) =>
                a.title.toLowerCase().includes(q) ||
                a.summary.some((line) => line.toLowerCase().includes(q))
        );
        return { matchedStocks, matchedArticles };
    }, [searchQuery, stocks]);

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
        triggerToast(`🔄 최신 데이터로 갱신되었습니다 (${nowStr})`);
    };

    const handleToggleWatchlist = (code, e) => {
        e.stopPropagation();
        if (!user) {
            triggerToast('🔒 관심 종목 설정은 로그인이 필요합니다.');
            setShowLoginModal(true);
            return;
        }
        setStocks((prev) =>
            prev.map((s) => (s.code === code ? { ...s, isWatchlist: !s.isWatchlist } : s))
        );
        const target = stocks.find(s => s.code === code);
        triggerToast(target?.isWatchlist ? '★ 관심 종목 해제됨' : '★ 관심 종목 등록됨');
    };

    const handleLoginSubmit = (e) => {
        e.preventDefault();
        if (!loginForm.username.trim() || !loginForm.password.trim()) return;
        setUser({ username: loginForm.username.trim() });
        setShowLoginModal(false);
        setLoginForm({ username: '', password: '' });
        triggerToast(`👋 환영합니다, ${loginForm.username.trim()}님!`);
    };

    const handleAddBoardPost = (e) => {
        e.preventDefault();
        if (!user) {
            triggerToast('🔒 토론 글 작인은 로그인이 필요합니다.');
            setShowLoginModal(true);
            return;
        }
        if (!newPostTitle.trim() || !newPostContent.trim()) return;
        const newPost = {
            id: `post-${Date.now()}`,
            author: user.username,
            title: newPostTitle.trim(),
            content: newPostContent.trim(),
            createdAt: new Date().toTimeString().slice(0, 5),
            likes: 0,
            likedByMe: false,
            comments: [],
        };
        setBoardPosts((prev) => ({
            ...prev,
            [selectedStockCode]: [newPost, ...(prev[selectedStockCode] || [])],
        }));
        setNewPostTitle('');
        setNewPostContent('');
        triggerToast('💬 종목 토론 의견이 등록되었습니다.');
    };

    const currentStockSummary = summaries[selectedStockCode] || {
        newsSummary: `${selectedStock.name} 관련 최신 실시간 뉴스 및 공시 분석 요약입니다.`,
        snsSummary: '종토방 및 커뮤니티에서 긍정적인 실적 기대감과 수급 유입 반응이 공존하고 있습니다.',
        sentimentRatio: { positive: 65, neutral: 25, negative: 10 },
        updatedAt: sysStatus.lastUpdated.summary,
    };

    const currentTrend = MENTION_TRENDS_DATA[selectedStockCode] || MENTION_TRENDS_DATA.default;
    const trendSeries = currentTrend[trendPeriod] || currentTrend.today;
    const currentPosts = boardPosts[selectedStockCode] || INITIAL_BOARD_POSTS['005930'];

    return (
        <div className="app-shell">
            {/* 1. 왼쪽 슬림 메뉴바 */}
            <nav className="left-nav-menu" aria-label="메인 네비게이션">
                <div className="nav-logo" title="뉴스×종목 매칭 대시보드">
                    N×S
                </div>
                <button
                    type="button"
                    className={`nav-item-btn ${activeNav === 'dashboard' ? 'active' : ''}`}
                    onClick={() => setActiveNav('dashboard')}
                >
                    <span className="nav-icon">📊</span>
                    <span>대시보드</span>
                </button>
                <button
                    type="button"
                    className={`nav-item-btn ${activeNav === 'ranking' ? 'active' : ''}`}
                    onClick={() => setActiveNav('ranking')}
                >
                    <span className="nav-icon">🔥</span>
                    <span>이슈순위</span>
                </button>
                <button
                    type="button"
                    className={`nav-item-btn ${activeNav === 'board' ? 'active' : ''}`}
                    onClick={() => setActiveNav('board')}
                >
                    <span className="nav-icon">💬</span>
                    <span>종목토론</span>
                </button>
            </nav>

            <div className="main-area">
                {/* 2. 상단 헤더 */}
                <header className="top-header">
                    <div className="brand-title">
                        <span>뉴스 × 종목 매칭 AI 대시보드</span>
                        <span className="brand-sub">
                            {activeNav === 'dashboard' && '종합 메인'}
                            {activeNav === 'ranking' && '실시간 이슈 종목 랭킹'}
                            {activeNav === 'board' && '종목별 전용 토론방'}
                        </span>
                    </div>

                    <div className="search-container">
                        <div className="search-input-wrap">
                            <input
                                type="text"
                                className="search-input"
                                placeholder="종목(삼전, 005930) 또는 키워드 통합 검색..."
                                value={searchQuery}
                                onFocus={() => setShowAutocomplete(true)}
                                onBlur={() => {
                                    setTimeout(() => {
                                        setShowAutocomplete(false);
                                    }, 180);
                                }}
                                onChange={(e) => {
                                    setSearchQuery(e.target.value);
                                    setShowAutocomplete(true);
                                }}
                            />
                            {searchQuery && (
                                <button
                                    type="button"
                                    className="clear-search-btn"
                                    onClick={() => setSearchQuery('')}
                                    title="검색어 지우기"
                                >
                                    ✕
                                </button>
                            )}

                            {showAutocomplete && searchQuery.trim() && (
                                <div className="autocomplete-dropdown">
                                    <div className="auto-section-label">종목 매칭 결과</div>
                                    {searchResults.matchedStocks.map((s) => (
                                        <button
                                            key={s.code}
                                            type="button"
                                            className="auto-item"
                                            onClick={() => {
                                                setSelectedStockCode(s.code);
                                                setSearchQuery('');
                                                setShowAutocomplete(false);
                                                setActiveNav('dashboard');
                                                triggerToast(`🔍 ${s.name}(${s.code}) 종목으로 이동했습니다.`);
                                            }}
                                        >
                                            <span><strong>{s.name}</strong> ({s.code})</span>
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="header-right">
                        <button
                            type="button"
                            className={`stream-badge ${sysStatus.streamStatus}`}
                            title="클릭하여 상태 변경 테스트"
                            onClick={() => {
                                const order = ['CONNECTED', 'RECONNECTING', 'DISCONNECTED'];
                                const next = order[(order.indexOf(sysStatus.streamStatus) + 1) % order.length];
                                setSysStatus((prev) => ({ ...prev, streamStatus: next }));
                                triggerToast(`⚡ 시세 스트리밍 상태: ${next}`);
                            }}
                        >
                            ● {sysStatus.streamStatus === 'CONNECTED' ? '실시간 연동 중' : sysStatus.streamStatus === 'RECONNECTING' ? '자동 재연결 중...' : '연결 끊김'}
                        </button>

                        <div
                            className="update-times-box"
                            onClick={handleRefreshData}
                            style={{ cursor: 'pointer' }}
                            title="클릭하여 최신 데이터로 새로고침"
                        >
                            <span>최신 갱신: {sysStatus.lastUpdated.quote} 🔄</span>
                        </div>

                        {user ? (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <span style={{ fontSize: '12px', fontWeight: 700 }}>{user.username}님</span>
                                <button type="button" className="btn-outline" onClick={() => setUser(null)}>로그아웃</button>
                            </div>
                        ) : (
                            <button type="button" className="btn-primary" onClick={() => setShowLoginModal(true)}>로그인</button>
                        )}
                    </div>
                </header>

                {/* 3. 메인 콘텐츠 뷰 */}
                <main className="dashboard-grid">
                    {activeNav === 'dashboard' && (
                        <>
                            {/* 좌측 패널 */}
                            <aside className="left-column">
                                <section className="card-panel watchlist-card">
                                    <div className="card-header">
                                        <div className="card-title">📌 관심·이슈 종목</div>
                                        <div style={{ display: 'flex', gap: '4px' }}>
                                            <button
                                                type="button"
                                                className={`chip-btn ${stockTab === 'watchlist' ? 'active' : ''}`}
                                                onClick={() => setStockTab('watchlist')}
                                            >
                                                관심종목
                                            </button>
                                            <button
                                                type="button"
                                                className={`chip-btn ${stockTab === 'all' ? 'active' : ''}`}
                                                onClick={() => setStockTab('all')}
                                            >
                                                전체
                                            </button>
                                        </div>
                                    </div>

                                    <div className="scroll-list">
                                        {displayedStocks.map((st) => (
                                            <div
                                                key={st.code}
                                                className={`stock-row ${st.code === selectedStockCode ? 'selected' : ''}`}
                                                onClick={() => setSelectedStockCode(st.code)}
                                            >
                                                <div className="stock-name-group">
                                                    <div className="stock-name">{st.name}</div>
                                                    <div className="stock-meta">매칭 {st.todayMatchedCount}건</div>
                                                </div>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                    <div className="stock-price-group">
                                                        <div className="price-text">{st.price.toLocaleString()}원</div>
                                                        <div className={`stock-meta ${st.changeRate >= 0 ? 'up' : 'down'}`}>
                                                            {st.changeRate > 0 ? `+${st.changeRate}` : st.changeRate}%
                                                        </div>
                                                    </div>
                                                    <button
                                                        type="button"
                                                        onClick={(e) => handleToggleWatchlist(st.code, e)}
                                                        style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: '15px' }}
                                                        title="관심 종목 등록/해제"
                                                    >
                                                        {st.isWatchlist ? '★' : '☆'}
                                                    </button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </section>

                                <section className="card-panel newslist-card">
                                    <div className="card-header">
                                        <div className="card-title">📰 {selectedStock.name} 뉴스·SNS</div>
                                    </div>
                                    <div className="filter-bar">
                                        <button
                                            type="button"
                                            className={`chip-btn ${sourceFilter === 'ALL' ? 'active' : ''}`}
                                            onClick={() => setSourceFilter('ALL')}
                                        >
                                            전체
                                        </button>
                                        <button
                                            type="button"
                                            className={`chip-btn ${sourceFilter === 'NEWS' ? 'active' : ''}`}
                                            onClick={() => setSourceFilter('NEWS')}
                                        >
                                            뉴스만
                                        </button>
                                        <button
                                            type="button"
                                            className={`chip-btn ${sourceFilter === 'SNS' ? 'active' : ''}`}
                                            onClick={() => setSourceFilter('SNS')}
                                        >
                                            SNS만
                                        </button>
                                    </div>
                                    <div className="scroll-list">
                                        {filteredArticles.map((art) => {
                                            const isSns = art.sourceType !== 'NEWS';
                                            return (
                                                <article
                                                    key={art.id}
                                                    className={`article-item ${selectedArticle?.id === art.id ? 'selected' : ''}`}
                                                    onClick={() => setSelectedArticleId(art.id)}
                                                >
                                                    <div className="article-top-meta">
                                                        <span className={`badge ${!isSns ? 'badge-news' : 'badge-sns'}`}>
                                                            {art.sourceType}
                                                        </span>
                                                        <span>{art.publishedAt}</span>
                                                    </div>
                                                    <div style={{ fontWeight: 700, fontSize: '13px' }}>{art.title}</div>
                                                    {isSns && (
                                                        <div className="sns-warning-inline" style={{ marginTop: '3px' }}>
                                                            ⚠️ 참고용 · 확인되지 않은 정보
                                                        </div>
                                                    )}
                                                </article>
                                            );
                                        })}
                                    </div>
                                </section>
                            </aside>

                            {/* 우측 패널 */}
                            <section className="right-column">
                                <div className="right-top-row">
                                    <div className="card-panel">
                                        <div className="card-header">
                                            <div className="card-title">{selectedStock.name} 종합 요약</div>
                                        </div>
                                        <div className="summary-box">
                                            <p><strong>[뉴스 요약]</strong> {currentStockSummary.newsSummary}</p>
                                            <p style={{ marginTop: '6px' }}><strong>[SNS 반응]</strong> {currentStockSummary.snsSummary}</p>
                                        </div>
                                    </div>

                                    <div className="card-panel">
                                        <div className="card-header">
                                            <div className="card-title">📈 뉴스·SNS 언급량 추이</div>
                                            <div style={{ display: 'flex', gap: '3px' }}>
                                                <button
                                                    type="button"
                                                    className={`chip-btn ${trendPeriod === 'today' ? 'active' : ''}`}
                                                    onClick={() => setTrendPeriod('today')}
                                                >
                                                    오늘
                                                </button>
                                                <button
                                                    type="button"
                                                    className={`chip-btn ${trendPeriod === '7d' ? 'active' : ''}`}
                                                    onClick={() => setTrendPeriod('7d')}
                                                >
                                                    7일
                                                </button>
                                                <button
                                                    type="button"
                                                    className={`chip-btn ${trendPeriod === '30d' ? 'active' : ''}`}
                                                    onClick={() => setTrendPeriod('30d')}
                                                >
                                                    30일
                                                </button>
                                            </div>
                                        </div>

                                        <div
                                            style={{
                                                flex: 1,
                                                display: 'flex',
                                                alignItems: 'flex-end',
                                                justifyContent: 'space-around',
                                                padding: '12px 6px 4px',
                                                border: '1px solid #f1f5f9',
                                                borderRadius: '8px',
                                                background: '#f8fafc',
                                                minHeight: '120px',
                                            }}
                                        >
                                            {trendSeries.map((pt) => {
                                                const total = pt.news + pt.sns;
                                                const maxTotal = Math.max(...trendSeries.map((d) => d.news + d.sns), 10);
                                                const newsH = Math.max(Math.round((pt.news / maxTotal) * 80), 6);
                                                const snsH = Math.max(Math.round((pt.sns / maxTotal) * 80), 6);
                                                return (
                                                    <div
                                                        key={pt.label}
                                                        style={{
                                                            display: 'flex',
                                                            flexDirection: 'column',
                                                            alignItems: 'center',
                                                            gap: '3px',
                                                        }}
                                                    >
                                                        <span style={{ fontSize: '10px', color: '#475569', fontWeight: 700 }}>
                                                            {total}
                                                        </span>
                                                        <div style={{ display: 'flex', alignItems: 'flex-end', gap: '2px', height: '85px' }}>
                                                            <div
                                                                title={`뉴스 ${pt.news}건`}
                                                                style={{
                                                                    width: '10px',
                                                                    height: `${newsH}px`,
                                                                    backgroundColor: '#2563eb',
                                                                    borderRadius: '2px 2px 0 0',
                                                                }}
                                                            />
                                                            <div
                                                                title={`SNS ${pt.sns}건`}
                                                                style={{
                                                                    width: '10px',
                                                                    height: `${snsH}px`,
                                                                    backgroundColor: '#f59e0b',
                                                                    borderRadius: '2px 2px 0 0',
                                                                }}
                                                            />
                                                        </div>
                                                        <span style={{ fontSize: '10px', color: '#64748b' }}>{pt.label}</span>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                </div>

                                {/* 우측 하단: 글 상세 및 근거 원문 인용 카드 */}
                                <div className="right-bottom-row" style={{ gridTemplateColumns: '1fr 1fr' }}>
                                    <div className="card-panel">
                                        <div className="card-header">
                                            <div className="card-title">🔍 선택 글 상세 분석 및 연결 근거</div>
                                            {selectedArticle && (
                                                <a
                                                    href={selectedArticle.url}
                                                    target="_blank"
                                                    rel="noreferrer"
                                                    className="btn-outline"
                                                    style={{ textDecoration: 'none', fontSize: '11px' }}
                                                >
                                                    원문 보기 ↗
                                                </a>
                                            )}
                                        </div>
                                        {selectedArticle ? (
                                            <div className="scroll-list">
                                                <h4 style={{ marginBottom: '6px', fontSize: '14px' }}>{selectedArticle.title}</h4>
                                                {selectedArticle.sourceType !== 'NEWS' && (
                                                    <div className="sns-warning-inline" style={{ marginBottom: '6px', display: 'inline-block' }}>
                                                        ⚠️ 참고용 · 확인되지 않은 정보 (SNS 출처)
                                                    </div>
                                                )}
                                                <ul style={{ paddingLeft: '16px', fontSize: '12.5px', color: '#334155', lineHeight: '1.5' }}>
                                                    {selectedArticle.summary.map((s, idx) => (
                                                        <li key={idx} style={{ marginBottom: '3px' }}>{s}</li>
                                                    ))}
                                                </ul>

                                                <div style={{ marginTop: '10px', fontWeight: 800, fontSize: '12px', color: '#0f172a' }}>
                                                    📌 종목 매칭 근거 상세 (F-05 / F-06)
                                                </div>
                                                {selectedArticle.relatedStocks.map((rel) => (
                                                    <div key={rel.code} className="summary-box" style={{ background: '#fff', marginTop: '6px', padding: '8px' }}>
                                                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', fontWeight: 700 }}>
                                                            <span>{rel.name}</span>
                                                            <span>
                                                                <span className={`badge ${rel.relationType === '직접' ? 'badge-direct' : 'badge-indirect'}`}>
                                                                    {rel.relationType} 관련
                                                                </span>{' '}
                                                                관련도 {rel.relevance}%
                                                            </span>
                                                        </div>
                                                        <div style={{ fontSize: '11.5px', color: '#475569', marginTop: '3px' }}>
                                                            <strong>연결 이유:</strong> {rel.reason}
                                                        </div>
                                                        <div className="evidence-quote" style={{ fontSize: '11px', marginTop: '4px' }}>
                                                            <strong>근거 원문:</strong> {rel.evidence}
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        ) : (
                                            <div style={{ color: '#64748b' }}>글을 선택해주세요.</div>
                                        )}
                                    </div>

                                    <div className="card-panel">
                                        <div className="card-header">
                                            <div className="card-title">💬 인접 시각 SNS 반응 (최대 5건)</div>
                                        </div>
                                        <div className="sns-warning-inline" style={{ marginBottom: '6px' }}>
                                            ⚠️ SNS 게시글은 신뢰도 검증 전인 참고용 정보입니다.
                                        </div>
                                        <div className="scroll-list">
                                            {matchedSnsForArticle.map((sns) => (
                                                <div key={sns.id} className="article-item" style={{ padding: '8px' }}>
                                                    <div style={{ fontWeight: 700, fontSize: '12px' }}>{sns.title}</div>
                                                    <div style={{ fontSize: '11px', color: '#64748b' }}>{sns.publishedAt} · {sns.press}</div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            </section>
                        </>
                    )}

                    {activeNav === 'ranking' && (
                        <div className="card-panel" style={{ gridColumn: '1 / -1', height: '100%' }}>
                            <div className="card-header">
                                <div className="card-title">🔥 실시간 뉴스·SNS 언급 급증 이슈 종목 랭킹</div>
                            </div>
                            <div className="scroll-list" style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '10px' }}>
                                {stocks
                                    .sort((a, b) => b.todayMatchedCount - a.todayMatchedCount)
                                    .map((st, idx) => (
                                        <div
                                            key={st.code}
                                            className="stock-row"
                                            onClick={() => {
                                                setSelectedStockCode(st.code);
                                                setActiveNav('dashboard');
                                            }}
                                            style={{ padding: '14px', background: '#fff' }}
                                        >
                                            <div style={{ fontSize: '15px', fontWeight: 800, color: '#2563eb', width: '35px' }}>
                                                {idx + 1}위
                                            </div>
                                            <div style={{ flex: 1 }}>
                                                <div style={{ fontWeight: 800, fontSize: '15px' }}>{st.name}</div>
                                                <div style={{ fontSize: '12px', color: '#64748b' }}>테마: {st.themes.join(', ')}</div>
                                            </div>
                                            <div style={{ textAlign: 'right' }}>
                                                <div style={{ fontWeight: 700 }}>{st.price.toLocaleString()}원</div>
                                                <div className={st.changeRate >= 0 ? 'up' : 'down'}>
                                                    {st.changeRate > 0 ? `+${st.changeRate}` : st.changeRate}%
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                            </div>
                        </div>
                    )}

                    {activeNav === 'board' && (
                        <div className="card-panel" style={{ gridColumn: '1 / -1', height: '100%' }}>
                            <div className="card-header">
                                <div className="card-title">💬 종목별 전용 토론방 (현재 선택: {selectedStock.name})</div>
                                <button
                                    type="button"
                                    className="btn-outline"
                                    onClick={() => {
                                        const code = prompt('토론방을 볼 종목 코드를 입력하세요 (예: 000660)');
                                        if (code && stocks.some((s) => s.code === code)) setSelectedStockCode(code);
                                    }}
                                >
                                    다른 종목 선택하기
                                </button>
                            </div>

                            <form onSubmit={handleAddBoardPost} style={{ marginBottom: '14px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                <input
                                    type="text"
                                    className="search-input"
                                    placeholder="토론방 게시글 제목 입력..."
                                    value={newPostTitle}
                                    onChange={(e) => setNewPostTitle(e.target.value)}
                                />
                                <div style={{ display: 'flex', gap: '8px' }}>
                                    <input
                                        type="text"
                                        className="search-input"
                                        placeholder="종목에 대한 자유로운 의견이나 분석을 남겨주세요..."
                                        value={newPostContent}
                                        onChange={(e) => setNewPostContent(e.target.value)}
                                    />
                                    <button type="submit" className="btn-primary" style={{ padding: '0 20px' }}>
                                        등록
                                    </button>
                                </div>
                            </form>

                            <div className="scroll-list" style={{ flex: 1 }}>
                                {currentPosts.map((post) => (
                                    <div key={post.id} className="article-item" style={{ cursor: 'default', padding: '14px' }}>
                                        <div className="article-top-meta">
                                            <strong>{post.author}</strong>
                                            <span>{post.createdAt}</span>
                                        </div>
                                        <div style={{ fontWeight: 800, fontSize: '14px', margin: '4px 0' }}>{post.title}</div>
                                        <div style={{ fontSize: '13px', color: '#334155' }}>{post.content}</div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </main>
            </div>

            {/* 알림 토스트 팝업 */}
            {toastMessage && <div className="toast-popup">{toastMessage}</div>}

            {showLoginModal && (
                <div className="modal-backdrop" onClick={() => setShowLoginModal(false)}>
                    <div className="modal-card" onClick={(e) => e.stopPropagation()}>
                        <h3 style={{ marginBottom: '12px' }}>로그인</h3>
                        <p style={{ fontSize: '12px', color: '#64748b', marginBottom: '12px' }}>
                            관심 종목 설정 및 토론방 글 작성을 위해 로그인이 필요합니다.
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
                                <button type="button" className="btn-outline" onClick={() => setShowLoginModal(false)}>취소</button>
                                <button type="submit" className="btn-primary">로그인</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
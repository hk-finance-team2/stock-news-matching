// 화면에서 부르는 백엔드 API 모음. 주소·조건은 docs/api.md 와 같음 (바뀌면 둘 다 고침)
// 응답은 백엔드 모양 그대로 돌려줌. 화면 모양으로 바꾸는 일은 adapters.js
// 모든 함수의 마지막 인자 options 에 { signal } 을 넣으면 요청을 취소할 수 있음 (검색어가 바뀔 때 등)

import { apiDelete, apiGet, apiPost, apiUrl, tokenStore } from './client';

export { ApiError, tokenStore } from './client';

/** 종목 */
export const stockApi = {
  /** 종목 검색 (이름·코드·별칭, 순위는 백엔드가 정함) → { items: [{ stockCode, stockName, market, sector }], totalCount } */
  search: (q, { page = 1, size = 20 } = {}, options) => apiGet('/api/stocks', { q, page, size }, options),
  /** 종목 하나 → { stockCode, stockName, market, sector } */
  get: (stockCode, options) => apiGet(`/api/stocks/${stockCode}`, undefined, options),
  /** 오늘의 이슈 종목 → { items: [{ rank, stockCode, stockName, articleCount, avgRelevance, lastPublishedAt }] } */
  issues: ({ source, limit = 10 } = {}, options) => apiGet('/api/stocks/issues', { source, limit }, options),
  /** 오늘의 종합 요약·감성 비율 (요약이 아직 없으면 newsSummary·snsSummary 가 null) */
  summary: (stockCode, { source } = {}, options) =>
    apiGet(`/api/stocks/${stockCode}/summary`, { source }, options),
  /** 종합 요약 다시 생성 (로그인 필요). AI 서버가 같은 종목은 10분에 1번만 새로 만듦 → { regenerated, summary } */
  regenerate: (stockCode) => apiPost(`/api/stocks/${stockCode}/summary`),
  /** 언급량 추이. period: today | 7d | 30d → { unit, items: [{ time, newsCount, snsCount, totalCount }] } */
  mentions: (stockCode, period = 'today', options) =>
    apiGet(`/api/stocks/${stockCode}/mentions`, { period }, options),
};

/** 뉴스·SNS 글 */
export const articleApi = {
  /** 글 목록. 조건: stockCode, source(NEWS|SNS), sort(latest|relevance), minRelevance, q, period(today|7d|30d), page, size */
  list: (params = {}, options) => apiGet('/api/articles', params, options),
  /** 글 상세 (연결 이유·근거 문장·키워드·가까운 SNS 포함) */
  get: (articleId, options) => apiGet(`/api/articles/${articleId}`, undefined, options),
};

/** 통합 검색 (종목 5개 + 글 한 페이지) → { q, stocks: { items, totalCount }, articles: { items, totalCount } } */
export const searchApi = {
  all: (q, { period, source, sort, page, size } = {}, options) =>
    apiGet('/api/search', { q, period, source, sort, page, size }, options),
};

/** 회원 */
export const authApi = {
  signup: (loginId, password) => apiPost('/api/auth/signup', { loginId, password }),
  /** 로그인하면 토큰을 저장해 두므로 이후 요청에 자동으로 붙음 */
  login: async (loginId, password) => {
    const res = await apiPost('/api/auth/login', { loginId, password });
    if (res?.accessToken) tokenStore.set(res.accessToken);
    return res;
  },
  me: (options) => apiGet('/api/auth/me', undefined, options),
  logout: () => tokenStore.clear(),
};

/** 종목코드 정규화 (숫자·영문 혼합 종목코드 '0007C0' 등 모두 허용) */
function normalizeStockCodePayload(input) {
  const raw =
    typeof input === 'object' && input !== null
      ? input.stockCode ?? input.code ?? ''
      : input ?? '';
  return String(raw).trim().toUpperCase();
}

/** 관심 종목 (로그인 필요) */
export const watchlistApi = {
  list: (options) => apiGet('/api/watchlist', undefined, options),
  articles: (params = {}, options) => apiGet('/api/watchlist/articles', params, options),
  add: (stockCode, options) =>
    apiPost('/api/watchlist', { stockCode: normalizeStockCodePayload(stockCode) }, options),
  remove: (stockCode, options) =>
    apiDelete(`/api/watchlist/${encodeURIComponent(normalizeStockCodePayload(stockCode))}`, options),
};

/** 종목 토론 게시판 */
export const boardApi = {
  posts: (stockCode, { page = 1, size = 20 } = {}, options) =>
    apiGet(`/api/stocks/${stockCode}/posts`, { page, size }, options),
  post: (postId, options) => apiGet(`/api/posts/${postId}`, undefined, options),
  write: (stockCode, title, content) => apiPost(`/api/stocks/${stockCode}/posts`, { title, content }),
  removePost: (postId) => apiDelete(`/api/posts/${postId}`),
  comments: (postId, options) => apiGet(`/api/posts/${postId}/comments`, undefined, options),
  writeComment: (postId, content) => apiPost(`/api/posts/${postId}/comments`, { content }),
  removeComment: (commentId) => apiDelete(`/api/comments/${commentId}`),
  toggleLike: (postId) => apiPost(`/api/posts/${postId}/like`),
};

/** 데이터 상태 (마지막 수집·요약 시각) */
export const statusApi = {
  get: (options) => apiGet('/api/status', undefined, options),
};

/**
 * 429 QUOTE_BUSY(KIS 초당 한도에 걸림)면 잠깐 쉬고 한 번만 다시 부름 (QA: 홈에서 가끔 현재가가 빈 칸으로 남던 것)
 * 백엔드도 KIS에 두 번 다시 묻고 나서야 429를 주므로, 여기서는 한 번이면 충분. 그사이 화면이 바뀌어 취소되면 바로 멈춤
 */
const BUSY_RETRY_MS = 1500;
async function retryIfBusy(call, signal) {
  try {
    return await call();
  } catch (err) {
    if (err?.status !== 429 || err.code !== 'QUOTE_BUSY' || signal?.aborted) throw err;
    await new Promise((resolve, reject) => {
      const timer = setTimeout(resolve, BUSY_RETRY_MS);
      signal?.addEventListener(
        'abort',
        () => {
          clearTimeout(timer);
          reject(new DOMException('Aborted', 'AbortError'));
        },
        { once: true }
      );
    });
    return call();
  }
}

/** 시세 (서버에서 KIS_ENABLED=true 일 때만, 아니면 503 QUOTE_DISABLED → "시세 준비 중") */
export const quoteApi = {
  get: (stockCode, options) =>
    retryIfBusy(() => apiGet(`/api/quotes/${stockCode}`, undefined, options), options?.signal),
  /** 최대 10종목 */
  many: (codes, options) =>
    retryIfBusy(() => apiGet('/api/quotes', { codes: codes.join(',') }, options), options?.signal),
  /**
   * 봉 차트. unit: 1m | 5m | 10m | 30m | day | week | month | year → { unit, date, items: [{ time, open, high, low, close, volume }] }
   * date: 분봉의 그날 (없으면 오늘). to: 일·주·월봉을 그 날짜(포함)까지 거꾸로 100개 (과거 이어 받기)
   */
  chart: (stockCode, unit = 'day', { date, to } = {}, options) =>
    retryIfBusy(() => apiGet(`/api/quotes/${stockCode}/chart`, { unit, date, to }, options), options?.signal),
  /** 실시간 방송(SSE) 주소. 최대 5종목 (docs/api.md 시세). 듣는 쪽은 hooks/useQuoteStream.js */
  streamUrl: (codes) => apiUrl(`/api/quotes/stream?codes=${encodeURIComponent(codes.join(','))}`),
};

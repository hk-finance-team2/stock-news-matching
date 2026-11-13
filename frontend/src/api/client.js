// 백엔드 API 호출 공용 함수
// - 주소: VITE_API_BASE_URL (비우면 지금 페이지와 같은 주소)
//   개발 중에는 비워 두면 vite.config.js의 프록시가 /api 요청을 백엔드(localhost:8080)로 넘겨 줌 → CORS 걱정 없음
//   배포할 때만 frontend/.env 에 VITE_API_BASE_URL=https://백엔드주소 를 적음
// - 응답 규칙(docs/api.md 1절): 목록은 { items, totalCount }, 실패는 { code, message } + HTTP 상태
// - 로그인 토큰: tokenStore에 저장해 두면 요청마다 Authorization: Bearer 를 붙임

const BASE_URL = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '');
const TOKEN_KEY = 'snm_access_token';

/** 전체 주소 (fetch 가 아닌 EventSource 처럼 주소만 필요한 곳) */
export function apiUrl(path) {
  return `${BASE_URL}${path}`;
}

/** API 실패. code는 백엔드 오류 코드(예: STOCK_NOT_FOUND), message는 화면에 그대로 보여 줘도 되는 문장 */
export class ApiError extends Error {
  constructor(status, code, message) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
  }
}

/** 로그인 토큰 보관 (브라우저 저장소를 못 쓰는 환경에서도 앱이 멈추지 않게 try/catch) */
export const tokenStore = {
  get() {
    try {
      return localStorage.getItem(TOKEN_KEY);
    } catch {
      return null;
    }
  },
  set(token) {
    try {
      localStorage.setItem(TOKEN_KEY, token);
    } catch {
      // 저장 못 해도 이번 화면에서는 계속 동작
    }
  },
  clear() {
    try {
      localStorage.removeItem(TOKEN_KEY);
    } catch {
      // ignore storage error
    }
  },
};

/** 값이 없는 조건(undefined·null·'')은 주소에서 뺌 */
function toQuery(params = {}) {
  const qs = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') qs.append(key, String(value));
  });
  const text = qs.toString();
  return text ? `?${text}` : '';
}

async function request(method, path, { params, body, signal } = {}) {
  const headers = { Accept: 'application/json' };
  const token = tokenStore.get();
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body !== undefined) headers['Content-Type'] = 'application/json';

  const init = { method, headers, signal };
  if (body !== undefined) init.body = JSON.stringify(body);
  const res = await fetch(`${BASE_URL}${path}${toQuery(params)}`, init);

  // 만료·위조 토큰이면 로그인이 필요 없는 API도 401 → 토큰을 지우고 알림 (docs/api.md 2절)
  if (res.status === 401) tokenStore.clear();

  if (res.status === 204) return { status: 204, ok: true };
  const data = await res.json().catch(() => null);
  const isSuccessStatus = res.status === 200 || res.status === 201 || res.ok;
  if (!isSuccessStatus) {
    throw new ApiError(res.status, data?.code || 'UNKNOWN', data?.message || '요청을 처리하지 못했습니다.');
  }
  if (data && typeof data === 'object') {
    try {
      Object.defineProperty(data, 'status', { value: res.status, enumerable: false });
    } catch {
      // ignore if frozen
    }
    return data;
  }
  return { status: res.status, ok: true, data };
}

export const apiGet = (path, params, options = {}) => request('GET', path, { ...options, params });
export const apiPost = (path, body, options = {}) => request('POST', path, { ...options, body });
export const apiDelete = (path, options = {}) => request('DELETE', path, options);

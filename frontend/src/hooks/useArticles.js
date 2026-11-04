// 글 목록·상세를 백엔드에서 받아 오는 도구 (화면 모양 변환은 api/adapters.js)
import { useCallback, useEffect, useRef, useState } from 'react';
import { articleApi } from '../api';
import { toUiArticle } from '../api/adapters';

const PAGE_SIZE = 20;

/** 화면 기간 버튼(ALL|0|7|30) → API 기간(today|7d|30d). 검색에도 씀 */
export const PERIOD_PARAM = { ALL: undefined, 0: 'today', 7: '7d', 30: '30d' };

/**
 * 화면 필터 상태 → GET /api/articles 조건 (값이 없으면 undefined → 주소에서 빠짐)
 * channel: ALL|NEWS|SNS, sentiment: ALL|POSITIVE|…, period: ALL|0|7|30, minRelevance: 0|50|…, sort: latest|relevance
 */
export function toArticleParams({ channel, sentiment, period, minRelevance, sort, stockCode, q }) {
  return {
    source: channel === 'ALL' ? undefined : channel,
    sentiment: sentiment === 'ALL' ? undefined : sentiment,
    period: PERIOD_PARAM[period],
    minRelevance: minRelevance > 0 ? minRelevance : undefined,
    sort,
    stockCode,
    q,
  };
}

/**
 * 글 목록을 한 쪽(20개)씩. params가 바뀌면 처음부터 다시 받고, 진행 중이던 요청은 취소
 * fetchPage(params, signal)을 바꿔 끼우면 관심 종목 글(watchlistApi.articles)에도 씀
 * enabled가 false면 부르지 않음 (예: 로그인 전 관심 종목 글)
 * resetKey: 서버에 보내지는 않지만 바뀌면 처음부터 다시 받을 값 (예: 관심 종목 목록)
 */
export function usePagedArticles(params, { fetchPage = articleApi.list, enabled = true, resetKey = '' } = {}) {
  const key = JSON.stringify({ params, resetKey });
  const [state, setState] = useState({ key: null, items: [], totalCount: 0, page: 0, loading: false, error: null });
  const controllerRef = useRef(null);

  const load = useCallback(
    (page) => {
      controllerRef.current?.abort();
      const controller = new AbortController();
      controllerRef.current = controller;
      // 1쪽부터 다시면 이전 조건의 글을 바로 지움 (조건과 안 맞는 글이 잠깐 보이지 않게)
      setState((prev) =>
        page === 1
          ? { key, items: [], totalCount: 0, page: 0, loading: true, error: null }
          : { ...prev, loading: true, error: null }
      );
      fetchPage({ ...JSON.parse(key).params, page, size: PAGE_SIZE }, { signal: controller.signal })
        .then((res) => {
          const items = res.items.map(toUiArticle);
          setState((prev) => ({
            key,
            items: page === 1 ? items : [...prev.items, ...items],
            totalCount: res.totalCount,
            page,
            loading: false,
            error: null,
          }));
        })
        .catch((err) => {
          if (err.name === 'AbortError') return;
          setState((prev) => ({ ...prev, loading: false, error: err }));
        });
    },
    [key, fetchPage]
  );

  useEffect(() => {
    if (!enabled) return undefined;
    load(1);
    return () => controllerRef.current?.abort();
  }, [load, enabled]);

  const fresh = state.key === key;
  return {
    items: fresh ? state.items : [],
    totalCount: fresh ? state.totalCount : 0,
    loading: state.loading || (enabled && !fresh),
    error: state.error,
    hasMore: fresh && state.items.length < state.totalCount,
    loadMore: () => load(state.page + 1),
    reload: () => load(1),
  };
}

/** 글 하나 상세 (연결 이유·근거 문장·가까운 SNS). id가 없으면 null */
export function useArticleDetail(id) {
  const [state, setState] = useState({ id: null, article: null, error: null });

  useEffect(() => {
    if (!id) return undefined;
    const controller = new AbortController();
    articleApi
      .get(id, { signal: controller.signal })
      .then((res) => setState({ id, article: toUiArticle(res), error: null }))
      .catch((err) => {
        if (err.name !== 'AbortError') setState({ id, article: null, error: err });
      });
    return () => controller.abort();
  }, [id]);

  const fresh = state.id === id;
  return { article: fresh ? state.article : null, error: fresh ? state.error : null, loading: Boolean(id) && !fresh };
}

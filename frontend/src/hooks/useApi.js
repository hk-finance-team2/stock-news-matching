// API 하나를 불러 { data, error, loading, reload } 로 돌려주는 작은 도구
import { useEffect, useState } from 'react';

/**
 * fetcher(signal) 이 Promise 를 돌려주면 그 결과를 data 로. deps 가 바뀌면 다시 부르고 이전 요청은 취소
 * refreshMs 를 주면 그 간격마다 다시 부름 (예: 데이터 상태 1분마다). enabled 가 false 면 부르지 않음
 */
export function useApi(fetcher, deps, { refreshMs, enabled = true } = {}) {
  const [state, setState] = useState({ data: null, error: null, loading: enabled });
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!enabled) return undefined;
    const controller = new AbortController();
    setState((prev) => ({ ...prev, loading: true }));
    fetcher(controller.signal)
      .then((data) => setState({ data, error: null, loading: false }))
      .catch((err) => {
        if (err.name !== 'AbortError') setState((prev) => ({ ...prev, error: err, loading: false }));
      });
    return () => controller.abort();
    // fetcher 는 매번 새 함수라 넣지 않음. 다시 부를 조건은 deps 로만 정함
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, tick, enabled]);

  useEffect(() => {
    if (!refreshMs || !enabled) return undefined;
    const timer = setInterval(() => setTick((t) => t + 1), refreshMs);
    return () => clearInterval(timer);
  }, [refreshMs, enabled]);

  return { ...state, reload: () => setTick((t) => t + 1) };
}

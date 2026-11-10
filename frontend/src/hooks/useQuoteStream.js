// 실시간 시세 방송(SSE) 듣기 — 기사 화면의 연결 종목 "현재가 · 오늘 등락률"을 열어 둔 동안 계속 갱신 (2026-11-10)
//
// 백엔드 GET /api/quotes/stream?codes=… (docs/api.md 시세): 연결 직후 한 번 + 값이 바뀔 때마다 이벤트 "quote"
// - 생중계 종목은 KIS 웹소켓 체결, 아닌 종목은 5초마다 조회 (서버가 알아서). 한 연결에 최대 5종목
// - 화면을 떠나면(컴포넌트가 사라지면) 연결을 끊음 → 서버가 생중계 자리를 돌려씀
//
// 시세가 꺼진 서버(KIS_ENABLED=false, 팀원 PC)는 503 → 브라우저가 연결을 실패로 닫고 다시 시도하지 않음(EventSource 규칙).
// 네트워크 끊김은 브라우저가 알아서 다시 연결하지만, 연속 MAX_ERRORS 번이면 멈춤 (백엔드가 꺼진 채로 계속 두드리지 않게)
import { useEffect, useRef } from 'react';
import { quoteApi } from '../api';

export const MAX_STREAM_CODES = 5; // 백엔드 QuoteController.MAX_STREAM_CODES 와 같게
const MAX_ERRORS = 3;

/**
 * codes 의 실시간 시세를 들음. 새 값이 올 때마다 onQuote(quote) — quote 는 /api/quotes/{code} 와 같은 모양
 * ({ stockCode, price, changeRate, fetchedAt, live, … }). 앞 5종목만 (주인공 먼저 넘길 것)
 */
export function useQuoteStream(codes, onQuote) {
  const onQuoteRef = useRef(onQuote);
  onQuoteRef.current = onQuote; // 함수가 바뀌어도 다시 연결하지 않게

  const key = [...new Set((codes || []).filter(Boolean))].slice(0, MAX_STREAM_CODES).join(',');

  useEffect(() => {
    if (!key || typeof EventSource === 'undefined') return undefined;
    const source = new EventSource(quoteApi.streamUrl(key.split(',')));
    let errors = 0;

    source.addEventListener('open', () => {
      errors = 0;
    });
    source.addEventListener('quote', (event) => {
      try {
        const quote = JSON.parse(event.data);
        if (quote?.stockCode && quote.price != null) onQuoteRef.current(quote);
      } catch {
        // 깨진 한 건은 버림 (다음 값이 곧 옴)
      }
    });
    source.onerror = () => {
      errors += 1;
      if (source.readyState === EventSource.CLOSED || errors >= MAX_ERRORS) source.close();
    };

    return () => source.close();
  }, [key]);
}

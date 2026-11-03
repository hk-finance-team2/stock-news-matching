package com.hkteam2.stocknews.quote;

import java.math.BigDecimal;
import java.time.OffsetDateTime;

/**
 * 종목 현재가 (GET /api/quotes/{stockCode})
 * direction: UP(상승·상한) / DOWN(하락·하한) / FLAT(보합). 화면 색: 상승 빨강, 하락 파랑 (국내 증권 앱 관례)
 * changeAmount·changeRate는 하락이면 음수
 * fetchedAt: 우리 서버가 KIS에서 받아 온 시각 (캐시 때문에 몇 초 전일 수 있음)
 * live: 지금 실시간(웹소켓) 값인지. 1단계는 REST 조회라 항상 false
 */
public record QuoteResponse(
        String stockCode,
        long price,
        long changeAmount,
        BigDecimal changeRate,
        String direction,
        long open,
        long high,
        long low,
        long accVolume,
        OffsetDateTime fetchedAt,
        boolean live
) {
}

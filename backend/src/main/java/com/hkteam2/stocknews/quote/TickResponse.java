package com.hkteam2.stocknews.quote;

import java.math.BigDecimal;
import java.time.OffsetDateTime;

/**
 * 최근 체결 한 건 (GET /api/quotes/{stockCode}/ticks)
 * volume: 이번 체결 수량(주), strength: 체결 강도 (100보다 크면 사려는 힘이 셈)
 */
public record TickResponse(
        OffsetDateTime time,
        long price,
        long changeAmount,
        BigDecimal changeRate,
        String direction,
        long volume,
        BigDecimal strength
) {
}

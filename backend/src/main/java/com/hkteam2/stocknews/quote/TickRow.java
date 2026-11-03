package com.hkteam2.stocknews.quote;

import java.math.BigDecimal;
import java.time.LocalDateTime;

/** quote_tick 한 줄 (방송용으로 필요한 칸만) */
public record TickRow(
        long tickId,
        String stockCode,
        LocalDateTime tradedAt,
        long price,
        long volume,
        BigDecimal changeRate
) {
}

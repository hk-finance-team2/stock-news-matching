package com.hkteam2.stocknews.quote;

import java.math.BigDecimal;
import java.time.LocalDateTime;

/** quote_snapshot 한 줄 그대로 */
public record QuoteSnapshotRow(
        String stockCode,
        long price,
        String changeSign,
        long changeAmount,
        BigDecimal changeRate,
        long openPrice,
        long highPrice,
        long lowPrice,
        long accVolume,
        LocalDateTime tradedAt,
        LocalDateTime updatedAt
) {
}

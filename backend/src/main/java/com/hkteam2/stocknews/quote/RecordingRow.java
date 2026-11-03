package com.hkteam2.stocknews.quote;

import java.time.LocalDate;
import java.time.LocalDateTime;

/** 녹화된 날 하나 (quote_tick을 날짜로 묶은 것) */
public record RecordingRow(
        LocalDate tradeDate,
        long tickCount,
        LocalDateTime firstAt,
        LocalDateTime lastAt
) {
}

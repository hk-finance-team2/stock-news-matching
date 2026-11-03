package com.hkteam2.stocknews.quote;

import java.math.BigDecimal;
import java.time.OffsetDateTime;

/** 다시 보기 이벤트 "replay": 녹화된 체결 한 건. seq는 1부터 (진행률 표시용) */
public record ReplayTickEvent(
        String stockCode,
        OffsetDateTime time,
        long price,
        BigDecimal changeRate,
        String direction,
        long volume,
        long accVolume,
        long seq
) {
}

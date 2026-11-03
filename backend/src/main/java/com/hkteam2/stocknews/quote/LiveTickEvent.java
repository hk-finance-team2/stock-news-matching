package com.hkteam2.stocknews.quote;

import java.math.BigDecimal;
import java.time.OffsetDateTime;

/** 방송(SSE) 이벤트 "tick": 새 체결 한 건. direction은 전일 대비율 부호로 UP/DOWN/FLAT */
public record LiveTickEvent(
        String stockCode,
        OffsetDateTime time,
        long price,
        BigDecimal changeRate,
        String direction,
        long volume
) {
}

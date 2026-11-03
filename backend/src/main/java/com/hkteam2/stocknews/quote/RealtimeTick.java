package com.hkteam2.stocknews.quote;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;

/**
 * 웹소켓으로 받은 실시간 체결 한 건 (KIS H0STCNT0 한 묶음 = 47칸 중 필요한 것)
 * tradedAt: 거래소 체결 시각, receivedAt: 우리 서버가 받은 시각 → 둘의 차이가 지연
 */
public record RealtimeTick(
        String stockCode,
        LocalDate tradeDate,
        LocalDateTime tradedAt,
        long price,
        String changeSign,
        long changeAmount,
        BigDecimal changeRate,
        long open,
        long high,
        long low,
        long volume,
        long accVolume,
        long accAmount,
        String tradeSide,
        LocalDateTime receivedAt
) {
}

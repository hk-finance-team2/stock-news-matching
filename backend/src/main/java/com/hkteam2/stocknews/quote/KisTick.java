package com.hkteam2.stocknews.quote;

import java.math.BigDecimal;
import java.time.LocalTime;

/**
 * 체결 한 건 (KIS 국내현재가 체결 inquire-ccnl 의 한 줄)
 * strength: 체결 강도(tday_rltv). 매수 체결량 ÷ 매도 체결량 × 100. 100보다 크면 사려는 힘이 셈
 */
public record KisTick(
        LocalTime time,
        long price,
        long changeAmount,
        String changeSign,
        BigDecimal changeRate,
        long volume,
        BigDecimal strength
) {
}

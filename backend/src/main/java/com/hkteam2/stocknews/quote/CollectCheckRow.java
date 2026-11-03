package com.hkteam2.stocknews.quote;

import java.time.LocalDateTime;

/**
 * 수집 점검 재료 (그날, 종목 하나)
 * firstAcc·firstVolume: 첫 체결의 누적 거래량·체결량, lastAcc: 마지막 체결의 누적 거래량
 * → 그 사이에 실제로 거래된 양 = lastAcc − firstAcc + firstVolume, 우리가 저장한 양 = savedVolume
 */
public record CollectCheckRow(
        String stockCode,
        String stockName,
        long tickCount,
        long savedVolume,
        long firstAcc,
        long firstVolume,
        long lastAcc,
        LocalDateTime firstAt,
        LocalDateTime lastAt,
        long avgDelayMs,
        long maxDelayMs
) {
}

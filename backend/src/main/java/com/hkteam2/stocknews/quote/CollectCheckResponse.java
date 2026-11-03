package com.hkteam2.stocknews.quote;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.List;

/**
 * 수집 점검 (GET /api/quotes/check?date=) — 장 마감 뒤 "빠진 체결이 있나"를 숫자로 (특강: Reconciliation)
 *
 * 종목마다
 *   expectedVolume: 처음~마지막 체결 사이에 실제로 거래된 양 (KIS 누적 거래량으로 계산)
 *   savedVolume: 우리가 저장한 체결량 합
 *   coverageRate: savedVolume ÷ expectedVolume × 100 (100%면 하나도 안 빠짐)
 *   missingVolume: expectedVolume − savedVolume
 *   avgDelayMs·maxDelayMs: 받은 시각 − 체결 시각 (체결 시각이 초 단위라 최대 1초는 반올림 오차)
 * 서버가 꺼져 있던 시간·구독 자리를 반납했던 시간도 "빠진 것"으로 셈 → 그런 시간이 없던 날 비교해야 정확
 */
public record CollectCheckResponse(LocalDate date, List<Item> items) {

    public record Item(
            String stockCode,
            String stockName,
            long tickCount,
            long savedVolume,
            long expectedVolume,
            long missingVolume,
            BigDecimal coverageRate,
            OffsetDateTime firstAt,
            OffsetDateTime lastAt,
            long avgDelayMs,
            long maxDelayMs
    ) {
    }
}

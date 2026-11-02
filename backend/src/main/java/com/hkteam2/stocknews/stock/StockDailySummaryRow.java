package com.hkteam2.stocknews.stock;

import java.time.LocalDateTime;

/** 종목의 그날 AI 종합 요약 (DB 조회 결과). 요약은 아직 없으면 null */
public record StockDailySummaryRow(
        String newsSummary,
        String snsSummary,
        LocalDateTime generatedAt
) {
}

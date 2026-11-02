package com.hkteam2.stocknews.stock;

import java.time.LocalDate;
import java.time.OffsetDateTime;

import com.hkteam2.stocknews.common.TimeUtils;

/**
 * 종목별 조회 화면의 "오늘의 종합 요약". 요약 문장은 AI가 1시간마다 만든 것,
 * 감성 비율은 백엔드가 지금 직접 센 것. 요약이 아직 없으면 newsSummary·snsSummary·generatedAt이 null
 */
public record StockSummaryResponse(
        String stockCode,
        String stockName,
        LocalDate date,
        String newsSummary,
        String snsSummary,
        OffsetDateTime generatedAt,
        SentimentRatioResponse sentiment
) {

    public static StockSummaryResponse of(StockResponse stock, LocalDate date, StockDailySummaryRow summary,
                                          SentimentRatioResponse sentiment) {
        return new StockSummaryResponse(stock.stockCode(), stock.stockName(), date,
                summary == null ? null : summary.newsSummary(),
                summary == null ? null : summary.snsSummary(),
                summary == null ? null : TimeUtils.toKst(summary.generatedAt()),
                sentiment);
    }
}

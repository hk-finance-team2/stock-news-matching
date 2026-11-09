package com.hkteam2.stocknews.stock;

import java.time.LocalDate;
import java.time.OffsetDateTime;

import com.hkteam2.stocknews.common.TimeUtils;

/**
 * 종목별 조회 화면의 "오늘의 종합 요약". 요약 문장은 AI가 1시간마다 만든 것,
 * 감성 비율은 백엔드가 지금 직접 센 것. 요약이 아직 없으면 newsSummary·snsSummary·generatedAt이 null
 * generatedAt은 뉴스 요약 시각: SNS가 먼저 줄을 만들면 generated_at에 SNS 시각이 들어가므로 뉴스 요약이 없으면 null
 * (AI 서버 api.py의 "다시 생성" 응답과 같은 규칙)
 * sentimentByEvent: 같은 소식 묶음을 1표로 센 감성 비율 (V13). 이 안의 articleCount·…Count는 "글 수"가 아니라 "소식 수"
 * (같은 호재 소식을 7곳이 쓰면 sentiment는 호재 7표, sentimentByEvent는 1표)
 */
public record StockSummaryResponse(
        String stockCode,
        String stockName,
        LocalDate date,
        String newsSummary,
        String snsSummary,
        OffsetDateTime generatedAt,
        SentimentRatioResponse sentiment,
        SentimentRatioResponse sentimentByEvent
) {

    public static StockSummaryResponse of(StockResponse stock, LocalDate date, StockDailySummaryRow summary,
                                          SentimentRatioResponse sentiment, SentimentRatioResponse sentimentByEvent) {
        return new StockSummaryResponse(stock.stockCode(), stock.stockName(), date,
                summary == null ? null : summary.newsSummary(),
                summary == null ? null : summary.snsSummary(),
                summary == null || summary.newsSummary() == null ? null : TimeUtils.toKst(summary.generatedAt()),
                sentiment, sentimentByEvent);
    }
}

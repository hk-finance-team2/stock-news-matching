package com.hkteam2.stocknews.stock;

/**
 * 종합 요약 다시 생성 결과 (POST /api/stocks/{code}/summary)
 * regenerated: 이번에 AI 가 새로 만들었나. false 면 10분 안에 이미 만들었거나 오늘 기사가 없어 저장된 요약을 그대로 보여 줌
 * summary: 다시 읽은 오늘 요약·감성 비율 (GET /api/stocks/{code}/summary 와 같은 모양)
 */
public record SummaryRegenerateResponse(boolean regenerated, StockSummaryResponse summary) {
}

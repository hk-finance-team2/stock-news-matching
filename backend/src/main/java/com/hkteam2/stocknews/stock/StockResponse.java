package com.hkteam2.stocknews.stock;

/** 종목 한 건의 응답 모양 (JSON 필드는 camelCase) */
public record StockResponse(
        String stockCode,
        String stockName,
        String market,
        String sector
) {
}

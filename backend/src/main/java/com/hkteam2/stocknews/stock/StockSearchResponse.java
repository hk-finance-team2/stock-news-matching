package com.hkteam2.stocknews.stock;

/**
 * 종목 검색 결과 한 건 (GET /api/stocks?q=, GET /api/search 의 stocks)
 * 종목 한 건 응답(StockResponse)에 matchedTheme 만 더함. 종목 상세 등 다른 API에 빈 칸이 생기지 않게 따로 둠
 *
 * matchedTheme: 이름·코드·별칭으로는 안 맞고 **테마로만** 찾은 종목이면 그 테마 (예: "반도체"), 아니면 null
 * → 화면이 "테마: 반도체"처럼 왜 나왔는지 보여 줄 수 있음 (QA #11)
 */
public record StockSearchResponse(
        String stockCode,
        String stockName,
        String market,
        String sector,
        String matchedTheme
) {
}

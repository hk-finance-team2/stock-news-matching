package com.hkteam2.stocknews.article;

import java.util.List;

/** 상세 화면의 관련 종목: 목록 칩(role·factType 포함) + 연결 이유·근거 문장·매칭 키워드 */
public record ArticleStockDetailResponse(
        String stockCode,
        String stockName,
        String matchType,
        Integer relevance,
        String sentiment,
        boolean isMain,
        String role,
        String factType,
        Integer sameNewsCount,
        String firstReportPress,
        boolean firstReport,
        String reason,
        String evidence,
        List<String> matchedKeywords
) {

    public static ArticleStockDetailResponse from(ArticleStockRow row) {
        return new ArticleStockDetailResponse(row.stockCode(), row.stockName(), row.matchType(),
                ArticleStockResponse.toPercent(row.relevance()), row.sentiment(), row.main(),
                ArticleLabels.role(row.main()), row.factType(),
                row.sameNewsCount(), row.firstPress(), row.firstReport(),
                row.reason(), row.evidence(), ArticleDetailResponse.splitKeywords(row.matchedKeywords()));
    }
}

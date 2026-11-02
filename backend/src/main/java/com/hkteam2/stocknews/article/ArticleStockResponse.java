package com.hkteam2.stocknews.article;

import java.math.BigDecimal;

/** 기사에 붙는 관련 종목 칩. relevance는 화면용 % (0~100), AI가 아직 안 채웠으면 null */
public record ArticleStockResponse(
        String stockCode,
        String stockName,
        String matchType,
        Integer relevance,
        String sentiment,
        boolean isMain
) {

    public static ArticleStockResponse from(ArticleStockRow row) {
        return new ArticleStockResponse(row.stockCode(), row.stockName(), row.matchType(),
                toPercent(row.relevance()), row.sentiment(), row.main());
    }

    /** 0.87 -> 87 */
    private static Integer toPercent(BigDecimal relevance) {
        return relevance == null ? null : relevance.movePointRight(2).intValue();
    }
}

package com.hkteam2.stocknews.article;

import java.math.BigDecimal;

/** 기사 × 종목 한 줄 (DB 조회 결과). relevance는 0.00~1.00, 아직 안 채워졌으면 null */
public record ArticleStockRow(
        Long articleId,
        String stockCode,
        String stockName,
        boolean main,
        String sentiment,
        String matchType,
        BigDecimal relevance
) {
}

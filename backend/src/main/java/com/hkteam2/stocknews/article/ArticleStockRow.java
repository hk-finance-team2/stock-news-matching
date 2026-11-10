package com.hkteam2.stocknews.article;

import java.math.BigDecimal;

/**
 * 기사 × 종목 한 줄 (DB 조회 결과). 목록·상세가 같이 씀 (목록은 reason·evidence·matchedKeywords를 안 내보냄)
 * relevance는 0.00~1.00, [확장] 칸은 AI가 아직 안 채웠으면 null
 */
public record ArticleStockRow(
        Long articleId,
        String stockCode,
        String stockName,
        boolean main,
        String sentiment,
        String matchType,
        BigDecimal relevance,
        String reason,
        String evidence,
        String matchedKeywords,
        String factType,
        Integer sameNewsCount,
        Long firstArticleId,
        String firstPress
) {

    /** 이 기사가 같은 소식 묶음의 첫 보도인가 (묶이지 않았으면 false) */
    boolean firstReport() {
        return firstArticleId != null && firstArticleId.equals(articleId);
    }
}

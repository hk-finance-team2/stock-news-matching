package com.hkteam2.stocknews.stock;

import java.math.BigDecimal;
import java.time.LocalDateTime;

/**
 * 이슈 종목 한 줄 (DB 집계 결과). avgRelevance는 0.00~1.00, 관련도가 전부 비었으면 null
 * eventCount: 같은 소식 묶음을 1건으로 센 수 (V13 group_article_id). 묶음이 없으면 articleCount와 같음
 */
public record StockIssueRow(
        String stockCode,
        String stockName,
        long articleCount,
        long eventCount,
        BigDecimal avgRelevance,
        LocalDateTime lastPublishedAt
) {
}

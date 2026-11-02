package com.hkteam2.stocknews.stock;

import java.math.BigDecimal;
import java.time.LocalDateTime;

/** 이슈 종목 한 줄 (DB 집계 결과). avgRelevance는 0.00~1.00, 관련도가 전부 비었으면 null */
public record StockIssueRow(
        String stockCode,
        String stockName,
        long articleCount,
        BigDecimal avgRelevance,
        LocalDateTime lastPublishedAt
) {
}

package com.hkteam2.stocknews.stock;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.OffsetDateTime;

import com.hkteam2.stocknews.common.TimeUtils;

/** 오늘의 이슈 종목 한 줄. avgRelevance는 화면용 %(0~100), 없으면 null */
public record StockIssueResponse(
        int rank,
        String stockCode,
        String stockName,
        long articleCount,
        Integer avgRelevance,
        OffsetDateTime lastPublishedAt
) {

    public static StockIssueResponse of(int rank, StockIssueRow row) {
        return new StockIssueResponse(rank, row.stockCode(), row.stockName(), row.articleCount(),
                toPercent(row.avgRelevance()), TimeUtils.toKst(row.lastPublishedAt()));
    }

    /** 평균이라 소수가 길 수 있음: 0.825 -> 83 (반올림) */
    private static Integer toPercent(BigDecimal relevance) {
        return relevance == null ? null
                : relevance.movePointRight(2).setScale(0, RoundingMode.HALF_UP).intValue();
    }
}

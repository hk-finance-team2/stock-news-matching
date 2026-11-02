package com.hkteam2.stocknews.stock;

/** 감성별 글 수 한 줄 (DB 집계 결과). sentiment: POSITIVE, NEGATIVE, NEUTRAL */
public record SentimentCountRow(
        String sentiment,
        long articleCount
) {
}

package com.hkteam2.stocknews.stock;

/**
 * 감성별 글 수 한 줄 (DB 집계 결과). sentiment: POSITIVE, NEGATIVE, NEUTRAL
 * eventCount: 같은 소식 묶음을 1표로 센 수 (V13). 한 묶음 안에서 감성이 갈리면 각 감성에 1표씩
 */
public record SentimentCountRow(
        String sentiment,
        long articleCount,
        long eventCount
) {
}

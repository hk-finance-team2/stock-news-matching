package com.hkteam2.stocknews.article;

import java.time.LocalDateTime;

/** 기사 상세 (DB 조회 결과). 본문(body)은 조회하지 않음 */
public record ArticleDetailRow(
        Long articleId,
        String sourceType,
        String channel,
        String title,
        String press,
        String reporter,
        LocalDateTime publishedAt,
        String summary,
        String keywords,
        String sentiment,
        String url,
        String model,
        LocalDateTime summarizedAt
) {
}

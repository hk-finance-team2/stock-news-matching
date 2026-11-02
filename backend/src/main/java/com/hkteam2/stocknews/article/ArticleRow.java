package com.hkteam2.stocknews.article;

import java.time.LocalDateTime;

/** 기사 목록 한 줄 (DB 조회 결과). 관련 종목은 따로 가져와 붙임 */
public record ArticleRow(
        Long articleId,
        String sourceType,
        String channel,
        String title,
        String press,
        LocalDateTime publishedAt,
        String summary,
        String url
) {
}

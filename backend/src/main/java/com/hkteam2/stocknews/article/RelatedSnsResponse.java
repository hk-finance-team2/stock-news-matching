package com.hkteam2.stocknews.article;

import java.time.OffsetDateTime;

import com.hkteam2.stocknews.common.TimeUtils;

/** 뉴스 상세 아래에 붙는 가까운 SNS 글 한 줄 */
public record RelatedSnsResponse(
        Long articleId,
        String channel,
        String title,
        String press,
        OffsetDateTime publishedAt,
        String summary,
        String url
) {

    public static RelatedSnsResponse from(ArticleRow row) {
        return new RelatedSnsResponse(row.articleId(), row.channel(), row.title(), row.press(),
                TimeUtils.toKst(row.publishedAt()), row.summary(), row.url());
    }
}

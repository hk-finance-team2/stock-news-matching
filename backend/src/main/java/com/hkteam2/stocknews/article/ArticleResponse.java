package com.hkteam2.stocknews.article;

import java.time.OffsetDateTime;
import java.util.List;

import com.hkteam2.stocknews.common.TimeUtils;

/** 기사 목록 한 줄. 본문은 내보내지 않고 요약과 원문 링크만 */
public record ArticleResponse(
        Long articleId,
        String sourceType,
        String channel,
        String title,
        String press,
        OffsetDateTime publishedAt,
        String summary,
        String url,
        List<ArticleStockResponse> stocks
) {

    public static ArticleResponse from(ArticleRow row, List<ArticleStockResponse> stocks) {
        return new ArticleResponse(row.articleId(), row.sourceType(), row.channel(), row.title(),
                row.press(), TimeUtils.toKst(row.publishedAt()), row.summary(), row.url(), stocks);
    }
}

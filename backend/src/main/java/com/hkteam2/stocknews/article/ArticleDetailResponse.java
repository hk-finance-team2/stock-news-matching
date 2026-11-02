package com.hkteam2.stocknews.article;

import java.time.OffsetDateTime;
import java.util.Arrays;
import java.util.List;

import com.hkteam2.stocknews.common.TimeUtils;

/**
 * 기사 상세. 본문은 내보내지 않고 요약과 원문 링크만.
 * model·summarizedAt은 "AI가 만든 요약" 표시용, relatedSns는 뉴스일 때만 채움 (SNS 글이면 빈 목록)
 */
public record ArticleDetailResponse(
        Long articleId,
        String sourceType,
        String channel,
        String title,
        String press,
        String reporter,
        OffsetDateTime publishedAt,
        String summary,
        List<String> keywords,
        String sentiment,
        String url,
        String model,
        OffsetDateTime summarizedAt,
        List<ArticleStockDetailResponse> stocks,
        List<RelatedSnsResponse> relatedSns
) {

    public static ArticleDetailResponse from(ArticleDetailRow row, List<ArticleStockDetailResponse> stocks,
                                             List<RelatedSnsResponse> relatedSns) {
        return new ArticleDetailResponse(row.articleId(), row.sourceType(), row.channel(), row.title(),
                row.press(), row.reporter(), TimeUtils.toKst(row.publishedAt()), row.summary(),
                splitKeywords(row.keywords()), row.sentiment(), row.url(), row.model(),
                TimeUtils.toKst(row.summarizedAt()), stocks, relatedSns);
    }

    /** DB의 "유가,중동, 정유" -> ["유가", "중동", "정유"]. 비어 있으면 빈 목록 */
    static List<String> splitKeywords(String keywords) {
        if (keywords == null || keywords.isBlank()) {
            return List.of();
        }
        return Arrays.stream(keywords.split(","))
                .map(String::strip)
                .filter(keyword -> !keyword.isEmpty())
                .toList();
    }
}

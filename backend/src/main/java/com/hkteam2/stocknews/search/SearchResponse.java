package com.hkteam2.stocknews.search;

import com.hkteam2.stocknews.article.ArticleResponse;
import com.hkteam2.stocknews.common.ListResponse;
import com.hkteam2.stocknews.stock.StockSearchResponse;

/**
 * 통합 검색 결과 (F-13). 종목과 글을 한 번에.
 * stocks: 위에서 몇 개만 (totalCount로 "종목 더 보기" → GET /api/stocks?q=), articles: 한 페이지
 */
public record SearchResponse(
        String q,
        ListResponse<StockSearchResponse> stocks,
        ListResponse<ArticleResponse> articles
) {
}

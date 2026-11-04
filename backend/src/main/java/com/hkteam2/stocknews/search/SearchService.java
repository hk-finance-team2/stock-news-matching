package com.hkteam2.stocknews.search;

import org.springframework.stereotype.Service;

import com.hkteam2.stocknews.article.ArticleService;
import com.hkteam2.stocknews.common.PageQuery;
import com.hkteam2.stocknews.common.SearchKeyword;
import com.hkteam2.stocknews.common.error.BusinessException;
import com.hkteam2.stocknews.common.error.ErrorCode;
import com.hkteam2.stocknews.stock.StockService;

/**
 * 통합 검색. SQL 없이 종목 검색(StockService)과 글 목록(ArticleService)을 불러서 합치기만 함.
 * 그래서 검색 규칙(종목 순위, 글 정렬·칩)이 각 화면과 항상 같음
 */
@Service
public class SearchService {

    /** 검색 화면 위쪽에 보여 줄 종목 수 */
    static final int STOCK_LIMIT = 5;

    private final StockService stockService;
    private final ArticleService articleService;

    public SearchService(StockService stockService, ArticleService articleService) {
        this.stockService = stockService;
        this.articleService = articleService;
    }

    /** 검색어가 없으면 400 (전체 목록은 각 목록 API로) */
    public SearchResponse search(String q, String period, String source, String sort, PageQuery articlePage) {
        String keyword = SearchKeyword.normalize(q);
        if (keyword == null) {
            throw new BusinessException(ErrorCode.INVALID_REQUEST);
        }
        return new SearchResponse(keyword,
                stockService.getStocks(keyword, new PageQuery(1, STOCK_LIMIT)),
                articleService.getArticles(source, sort, null, null, keyword, period, null, articlePage));
    }
}

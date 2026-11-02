package com.hkteam2.stocknews.search;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.hkteam2.stocknews.common.PageQuery;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.tags.Tag;

/** 통합 검색. 로그인 없이 */
@Tag(name = "검색", description = "종목과 뉴스·SNS 글을 한 번에 검색")
@RestController
@RequestMapping("/api/search")
public class SearchController {

    private final SearchService searchService;

    public SearchController(SearchService searchService) {
        this.searchService = searchService;
    }

    @Operation(summary = "통합 검색",
            description = "stocks: 종목명·코드·별칭으로 찾은 종목 위에서 5개 (규칙은 GET /api/stocks?q=와 같음)."
                    + " articles: 제목·요약·키워드에 검색어가 들어 있는 글 한 페이지 (규칙은 GET /api/articles와 같음)."
                    + " 검색어가 없거나 50자를 넘으면 400")
    @GetMapping
    public SearchResponse search(
            @Parameter(description = "검색어 (필수, 50자 이하)", example = "삼성") @RequestParam(required = false) String q,
            @Parameter(description = "글 기간: today, 7d, 30d (없으면 전체)", example = "7d")
            @RequestParam(required = false) String period,
            @Parameter(description = "글 출처: NEWS 또는 SNS (없으면 전체)") @RequestParam(required = false) String source,
            @Parameter(description = "글 정렬: latest(최신순, 기본) 또는 relevance(관련도순)")
            @RequestParam(defaultValue = "latest") String sort,
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "" + PageQuery.DEFAULT_SIZE) int size) {
        return searchService.search(q, period, source, sort, new PageQuery(page, size));
    }
}

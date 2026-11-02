package com.hkteam2.stocknews.article;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.hkteam2.stocknews.common.ListResponse;
import com.hkteam2.stocknews.common.PageQuery;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.tags.Tag;

/** 뉴스·SNS 글 목록. AI가 저장한 글을 읽기만 함. 로그인 없이 조회 */
@Tag(name = "기사", description = "뉴스·SNS 글 조회 (AI 분석이 끝난 글만)")
@RestController
@RequestMapping("/api/articles")
public class ArticleController {

    private final ArticleService articleService;

    public ArticleController(ArticleService articleService) {
        this.articleService = articleService;
    }

    @Operation(summary = "뉴스·SNS 목록",
            description = "홈은 조건 없이, 종목 화면은 stockCode를 붙여 부릅니다. 관련 종목(stocks)은 관련도 높은 순."
                    + " relevance는 %(0~100), AI가 아직 안 채웠으면 null. page는 1부터, size 1~100 (기본 20)")
    @GetMapping
    public ListResponse<ArticleResponse> getArticles(
            @Parameter(description = "출처: NEWS 또는 SNS (없으면 전체)", example = "NEWS")
            @RequestParam(required = false) String source,
            @Parameter(description = "정렬: latest(최신순, 기본) 또는 relevance(관련도순)", example = "latest")
            @RequestParam(defaultValue = "latest") String sort,
            @Parameter(description = "최소 관련도 % (0~100). 이 값 이상인 종목이 있는 글만", example = "70")
            @RequestParam(required = false) Integer minRelevance,
            @Parameter(description = "이 종목과 연결된 글만 (종목코드 6자리)", example = "005930")
            @RequestParam(required = false) String stockCode,
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "" + PageQuery.DEFAULT_SIZE) int size) {
        return articleService.getArticles(source, sort, minRelevance, stockCode, new PageQuery(page, size));
    }

    @Operation(summary = "글 상세",
            description = "요약·키워드·감성·원문 링크와 관련 종목별 연결 이유(reason)·근거 문장(evidence)."
                    + " 뉴스면 같은 종목이 나온 앞뒤 24시간 안의 SNS를 가까운 순으로 최대 5개(relatedSns)."
                    + " 없는 글이거나 분석이 덜 끝난 글이면 404 ARTICLE_NOT_FOUND")
    @GetMapping("/{articleId}")
    public ArticleDetailResponse getArticle(
            @Parameter(description = "글 번호 (목록의 articleId)") @PathVariable Long articleId) {
        return articleService.getArticle(articleId);
    }
}

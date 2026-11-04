package com.hkteam2.stocknews.watchlist;

import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import com.hkteam2.stocknews.article.ArticleResponse;
import com.hkteam2.stocknews.article.ArticleService;
import com.hkteam2.stocknews.common.ListResponse;
import com.hkteam2.stocknews.common.PageQuery;
import com.hkteam2.stocknews.common.config.OpenApiConfig;
import com.hkteam2.stocknews.common.security.CurrentUser;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;

/** 관심 종목. 모두 로그인 필요 (SecurityConfig의 AUTHENTICATED_PATHS) */
@Tag(name = "관심 종목", description = "로그인한 회원의 관심 종목 등록·조회·삭제")
@SecurityRequirement(name = OpenApiConfig.BEARER_AUTH)
@RestController
@RequestMapping("/api/watchlist")
public class WatchlistController {

    private final WatchlistService watchlistService;
    private final ArticleService articleService;

    public WatchlistController(WatchlistService watchlistService, ArticleService articleService) {
        this.watchlistService = watchlistService;
        this.articleService = articleService;
    }

    @Operation(summary = "내 관심 종목 목록",
            description = "최근에 추가한 순서. todayArticleCount: 오늘(한국 시간 0시~) 이 종목이 나온 글 수,"
                    + " lastMatchedAt: 가장 최근 글 시각 (없으면 null)")
    @GetMapping
    public ListResponse<WatchlistResponse> getMyWatchlist(@AuthenticationPrincipal Jwt jwt) {
        return watchlistService.getMyWatchlist(CurrentUser.id(jwt));
    }

    @Operation(summary = "관심 종목 글 모아 보기",
            description = "내 관심 종목 중 하나라도 연결된 뉴스·SNS. 조건·응답은 GET /api/articles와 같음 (stockCode 제외)."
                    + " 관심 종목이 없으면 빈 목록")
    @GetMapping("/articles")
    public ListResponse<ArticleResponse> getWatchlistArticles(
            @AuthenticationPrincipal Jwt jwt,
            @Parameter(description = "출처: NEWS 또는 SNS (없으면 전체)") @RequestParam(required = false) String source,
            @Parameter(description = "정렬: latest(최신순, 기본) 또는 relevance(관련도순)")
            @RequestParam(defaultValue = "latest") String sort,
            @Parameter(description = "최소 관련도 % (0~100)") @RequestParam(required = false) Integer minRelevance,
            @Parameter(description = "감성: POSITIVE, NEGATIVE, NEUTRAL (없으면 전체)") @RequestParam(required = false) String sentiment,
            @Parameter(description = "기간: today, 7d, 30d (없으면 전체)") @RequestParam(required = false) String period,
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "" + PageQuery.DEFAULT_SIZE) int size) {
        return articleService.getWatchlistArticles(CurrentUser.id(jwt), source, sort, minRelevance, sentiment, period,
                new PageQuery(page, size));
    }

    @Operation(summary = "관심 종목 추가", description = "없는 종목 404 STOCK_NOT_FOUND, 이미 있으면 409 ALREADY_IN_WATCHLIST")
    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public WatchlistResponse add(@AuthenticationPrincipal Jwt jwt, @Valid @RequestBody WatchlistAddRequest request) {
        return watchlistService.add(CurrentUser.id(jwt), request.stockCode());
    }

    @Operation(summary = "관심 종목 삭제", description = "목록에 없으면 404 WATCHLIST_NOT_FOUND")
    @DeleteMapping("/{stockCode}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void remove(@AuthenticationPrincipal Jwt jwt,
                       @Parameter(description = "종목코드 6자리", example = "005930") @PathVariable String stockCode) {
        watchlistService.remove(CurrentUser.id(jwt), stockCode);
    }
}

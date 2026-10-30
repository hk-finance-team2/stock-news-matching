package com.hkteam2.stocknews.board;

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

import com.hkteam2.stocknews.common.ListResponse;
import com.hkteam2.stocknews.common.PageQuery;
import com.hkteam2.stocknews.common.config.OpenApiConfig;
import com.hkteam2.stocknews.common.security.CurrentUser;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;

/** 종목 토론 게시판 글. 보기는 누구나, 쓰기·삭제는 로그인 필요 */
@Tag(name = "게시판", description = "종목 토론 게시판 (보기는 로그인 없이, 쓰기·삭제는 로그인)")
@RestController
@RequestMapping("/api")
public class PostController {

    private final PostService postService;

    public PostController(PostService postService) {
        this.postService = postService;
    }

    @Operation(summary = "종목 게시판 글 목록", description = "최신순. page는 1부터, size는 1~100 (기본 20)")
    @GetMapping("/stocks/{stockCode}/posts")
    public ListResponse<PostSummaryResponse> getPosts(
            @Parameter(description = "종목코드 6자리", example = "005930") @PathVariable String stockCode,
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "" + PageQuery.DEFAULT_SIZE) int size) {
        return postService.getPosts(stockCode, new PageQuery(page, size));
    }

    @Operation(summary = "게시글 상세")
    @GetMapping("/posts/{postId}")
    public PostDetailResponse getPost(@PathVariable Long postId) {
        return postService.getPost(postId);
    }

    @Operation(summary = "게시글 작성", security = @SecurityRequirement(name = OpenApiConfig.BEARER_AUTH))
    @PostMapping("/stocks/{stockCode}/posts")
    @ResponseStatus(HttpStatus.CREATED)
    public PostDetailResponse create(
            @AuthenticationPrincipal Jwt jwt,
            @Parameter(description = "종목코드 6자리", example = "005930") @PathVariable String stockCode,
            @Valid @RequestBody PostCreateRequest request) {
        return postService.create(CurrentUser.id(jwt), stockCode, request);
    }

    @Operation(summary = "게시글 삭제", description = "본인 글만. 남의 글이면 403 NOT_POST_OWNER. 댓글·공감도 함께 삭제",
            security = @SecurityRequirement(name = OpenApiConfig.BEARER_AUTH))
    @DeleteMapping("/posts/{postId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@AuthenticationPrincipal Jwt jwt, @PathVariable Long postId) {
        postService.delete(CurrentUser.id(jwt), postId);
    }
}

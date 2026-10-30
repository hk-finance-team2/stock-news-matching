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
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import com.hkteam2.stocknews.common.ListResponse;
import com.hkteam2.stocknews.common.config.OpenApiConfig;
import com.hkteam2.stocknews.common.security.CurrentUser;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;

/** 게시글 댓글. 보기는 누구나, 쓰기·삭제는 로그인 필요 */
@Tag(name = "게시판")
@RestController
@RequestMapping("/api")
public class CommentController {

    private final CommentService commentService;

    public CommentController(CommentService commentService) {
        this.commentService = commentService;
    }

    @Operation(summary = "댓글 목록", description = "오래된 순. 글이 없으면 404 POST_NOT_FOUND")
    @GetMapping("/posts/{postId}/comments")
    public ListResponse<CommentResponse> getComments(@PathVariable Long postId) {
        return commentService.getComments(postId);
    }

    @Operation(summary = "댓글 작성", security = @SecurityRequirement(name = OpenApiConfig.BEARER_AUTH))
    @PostMapping("/posts/{postId}/comments")
    @ResponseStatus(HttpStatus.CREATED)
    public CommentResponse create(@AuthenticationPrincipal Jwt jwt, @PathVariable Long postId,
                                  @Valid @RequestBody CommentCreateRequest request) {
        return commentService.create(CurrentUser.id(jwt), postId, request);
    }

    @Operation(summary = "댓글 삭제", description = "본인 댓글만. 남의 댓글이면 403 NOT_COMMENT_OWNER",
            security = @SecurityRequirement(name = OpenApiConfig.BEARER_AUTH))
    @DeleteMapping("/comments/{commentId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@AuthenticationPrincipal Jwt jwt, @PathVariable Long commentId) {
        commentService.delete(CurrentUser.id(jwt), commentId);
    }
}

package com.hkteam2.stocknews.board;

import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.hkteam2.stocknews.common.config.OpenApiConfig;
import com.hkteam2.stocknews.common.security.CurrentUser;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;

/** 게시글 공감. 로그인 필요 */
@Tag(name = "게시판")
@RestController
@RequestMapping("/api")
public class LikeController {

    private final LikeService likeService;

    public LikeController(LikeService likeService) {
        this.likeService = likeService;
    }

    @Operation(summary = "공감 토글", description = "누르면 공감, 다시 누르면 취소. 결과 상태와 전체 공감 수를 돌려줌",
            security = @SecurityRequirement(name = OpenApiConfig.BEARER_AUTH))
    @PostMapping("/posts/{postId}/like")
    public LikeResponse toggle(@AuthenticationPrincipal Jwt jwt, @PathVariable Long postId) {
        return likeService.toggle(CurrentUser.id(jwt), postId);
    }
}

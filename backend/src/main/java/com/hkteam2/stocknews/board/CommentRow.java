package com.hkteam2.stocknews.board;

import java.time.LocalDateTime;

/** 댓글 한 줄 (DB 조회 결과) */
public record CommentRow(
        Long commentId,
        Long postId,
        String content,
        String authorLoginId,
        LocalDateTime createdAt
) {
}

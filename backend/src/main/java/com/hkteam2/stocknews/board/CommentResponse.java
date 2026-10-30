package com.hkteam2.stocknews.board;

import java.time.OffsetDateTime;

import com.hkteam2.stocknews.common.TimeUtils;

/** 댓글 한 건 */
public record CommentResponse(
        Long commentId,
        Long postId,
        String content,
        String authorLoginId,
        OffsetDateTime createdAt
) {

    public static CommentResponse from(CommentRow row) {
        return new CommentResponse(row.commentId(), row.postId(), row.content(), row.authorLoginId(),
                TimeUtils.toKst(row.createdAt()));
    }
}

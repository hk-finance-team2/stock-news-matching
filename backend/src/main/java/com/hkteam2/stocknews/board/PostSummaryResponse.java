package com.hkteam2.stocknews.board;

import java.time.OffsetDateTime;

import com.hkteam2.stocknews.common.TimeUtils;

/** 게시글 목록 한 줄. 본문은 빼고 제목·작성자·댓글 수·공감 수만 */
public record PostSummaryResponse(
        Long postId,
        String title,
        String authorLoginId,
        OffsetDateTime createdAt,
        long commentCount,
        long likeCount
) {

    public static PostSummaryResponse from(PostSummaryRow row) {
        return new PostSummaryResponse(row.postId(), row.title(), row.authorLoginId(),
                TimeUtils.toKst(row.createdAt()), row.commentCount(), row.likeCount());
    }
}

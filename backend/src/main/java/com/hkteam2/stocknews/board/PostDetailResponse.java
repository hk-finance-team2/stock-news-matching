package com.hkteam2.stocknews.board;

import java.time.OffsetDateTime;

import com.hkteam2.stocknews.common.TimeUtils;

/** 게시글 상세 */
public record PostDetailResponse(
        Long postId,
        String stockCode,
        String stockName,
        String title,
        String content,
        String authorLoginId,
        OffsetDateTime createdAt,
        long commentCount,
        long likeCount
) {

    public static PostDetailResponse from(PostDetailRow row) {
        return new PostDetailResponse(row.postId(), row.stockCode(), row.stockName(), row.title(), row.content(),
                row.authorLoginId(), TimeUtils.toKst(row.createdAt()), row.commentCount(), row.likeCount());
    }
}

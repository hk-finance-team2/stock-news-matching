package com.hkteam2.stocknews.board;

import java.time.LocalDateTime;

/** 게시글 목록 한 줄 (DB 조회 결과) */
public record PostSummaryRow(
        Long postId,
        String title,
        String authorLoginId,
        LocalDateTime createdAt,
        Long commentCount,
        Long likeCount
) {
}

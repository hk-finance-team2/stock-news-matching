package com.hkteam2.stocknews.board;

import java.time.LocalDateTime;

/** 게시글 상세 (DB 조회 결과) */
public record PostDetailRow(
        Long postId,
        String stockCode,
        String stockName,
        String title,
        String content,
        String authorLoginId,
        LocalDateTime createdAt,
        Long commentCount,
        Long likeCount
) {
}

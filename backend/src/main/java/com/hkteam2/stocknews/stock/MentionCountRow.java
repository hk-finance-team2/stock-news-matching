package com.hkteam2.stocknews.stock;

import java.time.LocalDateTime;

/** 시간 칸 하나의 글 수 (DB 집계 결과). bucket: 칸 시각 (예: 08:00 또는 11/01 0:00) */
public record MentionCountRow(
        LocalDateTime bucket,
        long newsCount,
        long snsCount
) {
}

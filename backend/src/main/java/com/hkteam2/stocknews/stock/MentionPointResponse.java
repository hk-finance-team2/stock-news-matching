package com.hkteam2.stocknews.stock;

import java.time.OffsetDateTime;

/** 그래프의 점(칸) 하나. time: 칸 시작 시각 (1시간 칸이면 08:00 = 08:00~08:59) */
public record MentionPointResponse(
        OffsetDateTime time,
        long newsCount,
        long snsCount,
        long totalCount
) {
}

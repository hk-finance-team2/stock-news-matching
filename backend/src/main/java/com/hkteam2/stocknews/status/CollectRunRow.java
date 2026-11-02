package com.hkteam2.stocknews.status;

import java.time.LocalDateTime;

/** AI 수집 실행 한 번 (DB 조회 결과). status: RUNNING, SUCCESS, FAILED. 실행 중이면 finishedAt이 null */
public record CollectRunRow(
        String status,
        LocalDateTime startedAt,
        LocalDateTime finishedAt,
        int collectedCount,
        int summarizedCount
) {
}

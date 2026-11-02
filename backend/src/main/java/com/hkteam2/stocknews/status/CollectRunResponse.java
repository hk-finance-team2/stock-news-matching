package com.hkteam2.stocknews.status;

import java.time.OffsetDateTime;

import com.hkteam2.stocknews.common.TimeUtils;

/** 가장 최근 수집 실행. 실패 원인(error)은 내부 정보라 내보내지 않음 */
public record CollectRunResponse(
        String status,
        OffsetDateTime startedAt,
        OffsetDateTime finishedAt,
        int collectedCount,
        int summarizedCount
) {

    public static CollectRunResponse from(CollectRunRow row) {
        return new CollectRunResponse(row.status(), TimeUtils.toKst(row.startedAt()), TimeUtils.toKst(row.finishedAt()),
                row.collectedCount(), row.summarizedCount());
    }
}

package com.hkteam2.stocknews.status;

import java.time.OffsetDateTime;

import com.hkteam2.stocknews.common.TimeUtils;

/**
 * 데이터 상태 (F-16). 화면의 "뉴스 3분 전 · SNS 10분 전 · 요약 40분 전" 표시용.
 * 각 시각은 아직 데이터가 없으면 null, lastRun은 수집 기록이 없으면 null
 */
public record DataStatusResponse(
        OffsetDateTime newsCollectedAt,
        OffsetDateTime snsCollectedAt,
        OffsetDateTime summaryGeneratedAt,
        OffsetDateTime lastSuccessAt,
        CollectRunResponse lastRun
) {

    public static DataStatusResponse of(DataStatusRow row, CollectRunResponse lastRun) {
        return new DataStatusResponse(TimeUtils.toKst(row.newsCollectedAt()), TimeUtils.toKst(row.snsCollectedAt()),
                TimeUtils.toKst(row.summaryGeneratedAt()), TimeUtils.toKst(row.lastSuccessAt()), lastRun);
    }
}

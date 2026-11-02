package com.hkteam2.stocknews.status;

import java.time.LocalDateTime;

/** 마지막 갱신 시각 4개 (DB 조회 결과). 데이터가 없으면 null */
public record DataStatusRow(
        LocalDateTime newsCollectedAt,
        LocalDateTime snsCollectedAt,
        LocalDateTime summaryGeneratedAt,
        LocalDateTime lastSuccessAt
) {

    /** 아무 데이터도 없을 때 */
    static final DataStatusRow EMPTY = new DataStatusRow(null, null, null, null);
}

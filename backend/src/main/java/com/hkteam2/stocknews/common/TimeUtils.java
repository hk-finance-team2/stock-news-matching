package com.hkteam2.stocknews.common;

import java.time.LocalDateTime;
import java.time.OffsetDateTime;
import java.time.ZoneId;

/**
 * DB의 DATETIME(한국 시간, 시간대 정보 없음)을 API 약속 형식(+09:00 포함)으로 바꿈.
 * 예: 2026-10-30T15:00 -> 2026-10-30T15:00:00+09:00
 */
public final class TimeUtils {

    public static final ZoneId KST = ZoneId.of("Asia/Seoul");

    private TimeUtils() {
    }

    public static OffsetDateTime toKst(LocalDateTime dateTime) {
        return dateTime == null ? null : dateTime.atZone(KST).toOffsetDateTime();
    }
}

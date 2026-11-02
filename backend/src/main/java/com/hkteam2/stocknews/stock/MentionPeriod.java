package com.hkteam2.stocknews.stock;

import java.time.LocalDateTime;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.List;

import com.hkteam2.stocknews.common.error.BusinessException;
import com.hkteam2.stocknews.common.error.ErrorCode;

/**
 * 언급량 그래프의 기간 (F-14). 기간마다 시작 시각과 칸 단위가 정해져 있음
 * - today: 오늘 0시부터 1시간 칸 (지금 시각 칸까지)
 * - 7d, 30d: 오늘 포함 7일·30일, 1일 칸 (맨 오른쪽 칸이 항상 오늘)
 */
public enum MentionPeriod {

    TODAY("today", ChronoUnit.HOURS, "HOUR", 0),
    WEEK("7d", ChronoUnit.DAYS, "DAY", 6),
    MONTH("30d", ChronoUnit.DAYS, "DAY", 29);

    private final String value;
    private final ChronoUnit unit;
    private final String unitName;
    private final int daysBefore;

    MentionPeriod(String value, ChronoUnit unit, String unitName, int daysBefore) {
        this.value = value;
        this.unit = unit;
        this.unitName = unitName;
        this.daysBefore = daysBefore;
    }

    /** "today", "7d", "30d" → 기간. 그 밖은 400 */
    public static MentionPeriod from(String value) {
        for (MentionPeriod period : values()) {
            if (period.value.equals(value)) {
                return period;
            }
        }
        throw new BusinessException(ErrorCode.INVALID_REQUEST);
    }

    /** 첫 칸 시각. 예: 7d면 6일 전 0시 */
    public LocalDateTime start(LocalDateTime now) {
        return now.toLocalDate().minusDays(daysBefore).atStartOfDay();
    }

    /** 마지막 칸(지금이 들어가는 칸) 시각. 예: 10:42 → 1시간 칸이면 10:00, 1일 칸이면 0:00 */
    public LocalDateTime lastBucket(LocalDateTime now) {
        return now.truncatedTo(unit);
    }

    /** 이 시각 전까지의 글만 셈 (마지막 칸의 끝). 작성 시각이 미래로 잘못 들어온 글은 빠짐 */
    public LocalDateTime end(LocalDateTime now) {
        return lastBucket(now).plus(1, unit);
    }

    /** 첫 칸부터 마지막 칸까지 모든 칸 시각 (빈 칸 포함). 출석부의 "반 전체 명단" */
    public List<LocalDateTime> buckets(LocalDateTime now) {
        List<LocalDateTime> buckets = new ArrayList<>();
        LocalDateTime last = lastBucket(now);
        for (LocalDateTime time = start(now); !time.isAfter(last); time = time.plus(1, unit)) {
            buckets.add(time);
        }
        return buckets;
    }

    public String value() {
        return value;
    }

    /** API와 SQL에서 쓰는 칸 단위 이름: HOUR 또는 DAY */
    public String unitName() {
        return unitName;
    }
}

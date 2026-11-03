package com.hkteam2.stocknews.quote;

import java.util.Arrays;
import java.util.Optional;

/**
 * 차트 단위 (GET /api/quotes/{code}/chart?unit=)
 * 분봉: 그날 1분봉을 KIS에서 받아 서버가 n분씩 묶음 (CandleAggregator)
 * 일·주·월·년봉: KIS가 묶어 준 것을 그대로 (기간분류코드 D/W/M/Y)
 */
public enum ChartUnit {
    MIN_1("1m", 1, null),
    MIN_5("5m", 5, null),
    MIN_10("10m", 10, null),
    MIN_30("30m", 30, null),
    DAY("day", 0, "D"),
    WEEK("week", 0, "W"),
    MONTH("month", 0, "M"),
    YEAR("year", 0, "Y");

    private final String code;
    private final int minutes;
    private final String periodCode;

    ChartUnit(String code, int minutes, String periodCode) {
        this.code = code;
        this.minutes = minutes;
        this.periodCode = periodCode;
    }

    public String code() {
        return code;
    }

    /** 분봉이면 묶을 분 수, 아니면 0 */
    public int minutes() {
        return minutes;
    }

    public boolean isMinute() {
        return minutes > 0;
    }

    /** KIS 기간분류코드 D/W/M/Y (분봉이면 null) */
    String periodCode() {
        return periodCode;
    }

    /** 요청 값 → 단위. 옛 값 minute(= 1m)도 받음 */
    public static Optional<ChartUnit> of(String code) {
        if ("minute".equals(code)) {
            return Optional.of(MIN_1);
        }
        return Arrays.stream(values()).filter(u -> u.code.equals(code)).findFirst();
    }
}

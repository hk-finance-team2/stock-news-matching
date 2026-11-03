package com.hkteam2.stocknews.quote;

import java.time.LocalDate;
import java.util.Arrays;
import java.util.Optional;

/** 급등·급락 이력 기간. 요청 값 3m·6m·1y (오늘 포함 그 기간) */
public enum BigMovePeriod {
    THREE_MONTHS("3m", 3),
    SIX_MONTHS("6m", 6),
    ONE_YEAR("1y", 12);

    private final String code;
    private final int months;

    BigMovePeriod(String code, int months) {
        this.code = code;
        this.months = months;
    }

    public String code() {
        return code;
    }

    LocalDate from(LocalDate today) {
        return today.minusMonths(months);
    }

    public static Optional<BigMovePeriod> of(String code) {
        return Arrays.stream(values()).filter(p -> p.code.equals(code)).findFirst();
    }
}

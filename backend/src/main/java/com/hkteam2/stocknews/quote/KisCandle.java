package com.hkteam2.stocknews.quote;

import java.time.LocalDateTime;

/** 봉 하나 (분봉이면 그 분, 일봉이면 그날 0시). 시각은 한국 시간 */
public record KisCandle(
        LocalDateTime time,
        long open,
        long high,
        long low,
        long close,
        long volume
) {
}

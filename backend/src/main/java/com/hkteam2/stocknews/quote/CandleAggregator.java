package com.hkteam2.stocknews.quote;

import java.time.LocalDateTime;
import java.time.LocalTime;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.List;

/**
 * 1분봉 → n분봉 묶기 (KIS·DB 없이 계산만 → 단위 테스트로 바로 확인)
 *
 * 구간은 장 시작(09:00)부터 n분씩: 5분봉이면 09:00, 09:05, 09:10 … (봉 시각 = 구간이 시작하는 시각)
 * 한 구간: 시가 = 첫 봉 시가, 종가 = 마지막 봉 종가, 고가 = 가장 높은 값, 저가 = 가장 낮은 값, 거래량 = 합
 */
final class CandleAggregator {

    static final LocalTime MARKET_OPEN = LocalTime.of(9, 0);

    private CandleAggregator() {
    }

    /** @param oneMinute 1분봉, 오래된 것부터 (한 날짜) */
    static List<KisCandle> aggregate(List<KisCandle> oneMinute, int minutes) {
        if (minutes <= 1) {
            return List.copyOf(oneMinute);
        }
        List<KisCandle> out = new ArrayList<>();
        LocalDateTime bucket = null;
        long open = 0, high = 0, low = 0, close = 0, volume = 0;
        for (KisCandle c : oneMinute) {
            LocalDateTime b = bucketStart(c.time(), minutes);
            if (!b.equals(bucket)) {
                if (bucket != null) {
                    out.add(new KisCandle(bucket, open, high, low, close, volume));
                }
                bucket = b;
                open = c.open();
                high = c.high();
                low = c.low();
                volume = 0;
            }
            high = Math.max(high, c.high());
            low = Math.min(low, c.low());
            close = c.close();
            volume += c.volume();
        }
        if (bucket != null) {
            out.add(new KisCandle(bucket, open, high, low, close, volume));
        }
        return out;
    }

    /** 09:00부터 n분 단위로 내림. 예: 5분, 09:13 → 09:10 */
    static LocalDateTime bucketStart(LocalDateTime time, int minutes) {
        LocalDateTime open = time.toLocalDate().atTime(MARKET_OPEN);
        long offset = ChronoUnit.MINUTES.between(open, time.truncatedTo(ChronoUnit.MINUTES));
        return open.plusMinutes(Math.floorDiv(offset, minutes) * minutes);
    }
}

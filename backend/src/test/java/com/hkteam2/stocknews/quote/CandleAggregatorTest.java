package com.hkteam2.stocknews.quote;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

import org.junit.jupiter.api.Test;

/** 1분봉 → n분봉 묶기 (계산만, KIS 없음) */
class CandleAggregatorTest {

    private static final LocalDate DAY = LocalDate.of(2026, 10, 30);

    static KisCandle m(int hour, int minute, long open, long high, long low, long close, long volume) {
        return new KisCandle(DAY.atTime(hour, minute), open, high, low, close, volume);
    }

    @Test
    void 다섯_개씩_묶으면_시가는_처음_종가는_마지막_고저는_최고최저_거래량은_합() {
        List<KisCandle> oneMinute = List.of(
                m(9, 0, 100, 105, 99, 104, 10),
                m(9, 1, 104, 110, 103, 108, 20),
                m(9, 4, 108, 109, 95, 97, 5),     // 09:02·09:03은 거래가 없어 봉이 없음
                m(9, 5, 97, 98, 96, 98, 7));     // 다음 구간

        List<KisCandle> five = CandleAggregator.aggregate(oneMinute, 5);

        assertThat(five).containsExactly(
                new KisCandle(DAY.atTime(9, 0), 100, 110, 95, 97, 35),
                new KisCandle(DAY.atTime(9, 5), 97, 98, 96, 98, 7));
    }

    @Test
    void 구간은_장_시작_09시부터_n분씩() {
        assertThat(CandleAggregator.bucketStart(DAY.atTime(9, 13), 5)).isEqualTo(DAY.atTime(9, 10));
        assertThat(CandleAggregator.bucketStart(DAY.atTime(9, 29), 30)).isEqualTo(DAY.atTime(9, 0));
        assertThat(CandleAggregator.bucketStart(DAY.atTime(15, 30), 30)).isEqualTo(DAY.atTime(15, 30));   // 장 마감 동시호가 봉
        assertThat(CandleAggregator.bucketStart(DAY.atTime(10, 7), 10)).isEqualTo(LocalDateTime.of(DAY, java.time.LocalTime.of(10, 0)));
    }

    @Test
    void 일분봉은_그대로_빈_목록은_빈_목록() {
        List<KisCandle> one = List.of(m(9, 0, 1, 1, 1, 1, 1), m(9, 1, 2, 2, 2, 2, 2));
        assertThat(CandleAggregator.aggregate(one, 1)).isEqualTo(one);
        assertThat(CandleAggregator.aggregate(List.of(), 5)).isEmpty();
    }

    @Test
    void 단위_값_읽기_옛_값_minute는_1분봉() {
        assertThat(ChartUnit.of("minute")).contains(ChartUnit.MIN_1);
        assertThat(ChartUnit.of("30m")).contains(ChartUnit.MIN_30);
        assertThat(ChartUnit.of("year")).contains(ChartUnit.YEAR);
        assertThat(ChartUnit.of("2m")).isEmpty();
        assertThat(ChartUnit.WEEK.periodCode()).isEqualTo("W");
    }
}

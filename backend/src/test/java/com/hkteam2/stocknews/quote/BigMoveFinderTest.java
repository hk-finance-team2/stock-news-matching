package com.hkteam2.stocknews.quote;

import static org.assertj.core.api.Assertions.assertThat;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

import org.junit.jupiter.api.Test;

/** 급등·급락한 날 고르기 (계산만, KIS·DB 없음) */
class BigMoveFinderTest {

    static KisCandle day(int dayOfMonth, long close) {
        return new KisCandle(LocalDate.of(2026, 10, dayOfMonth).atStartOfDay(), close, close, close, close, 1000L * dayOfMonth);
    }

    @Test
    void 전날_종가_대비_기준_이상만_고른다() {
        List<KisCandle> candles = List.of(
                day(1, 10000),
                day(2, 10500),    // +5.00% → 딱 기준 (포함)
                day(5, 10900),    // +3.81% → 빠짐
                day(6, 10300),    // -5.50% → 급락
                day(7, 10790));   // +4.76% → 빠짐
        List<BigMoveFinder.BigMove> moves = BigMoveFinder.find(candles, new BigDecimal("5"));

        assertThat(moves).extracting(BigMoveFinder.BigMove::date)
                .containsExactly(LocalDate.of(2026, 10, 2), LocalDate.of(2026, 10, 6));
        assertThat(moves.get(0).changeRate()).isEqualByComparingTo("5.00");
        assertThat(moves.get(1).changeAmount()).isEqualTo(-600);
        assertThat(moves.get(1).changeRate()).isEqualByComparingTo("-5.50");
        assertThat(moves.get(1).volume()).isEqualTo(6000);
    }

    @Test
    void 첫_봉은_전날_종가가_없어_계산하지_않고_전날_종가가_0이면_건너뜀() {
        assertThat(BigMoveFinder.find(List.of(day(1, 10000)), BigDecimal.ONE)).isEmpty();
        assertThat(BigMoveFinder.find(List.of(day(1, 0), day(2, 10000)), BigDecimal.ONE)).isEmpty();
    }
}

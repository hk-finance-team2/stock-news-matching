package com.hkteam2.stocknews.stock;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.List;
import java.util.Map;

import org.junit.jupiter.api.Test;

/** 감성 개수 → % 변환. 서버·DB 없이 계산만 확인 */
class SentimentRatioResponseTest {

    @Test
    void 셋이_같으면_합이_100이_되게_첫_칸에_1을_더한다() {
        // 그냥 반올림하면 33 + 33 + 33 = 99
        assertThat(SentimentRatioResponse.toPercents(List.of(1L, 1L, 1L))).containsExactly(34, 33, 33);
    }

    @Test
    void 버린_소수점이_큰_칸에_먼저_더한다() {
        // 3/8 = 37.5, 5/8 = 62.5 → 버림 37, 62 → 남은 1은 나머지가 같으니 앞 칸 → 38, 62
        assertThat(SentimentRatioResponse.toPercents(List.of(3L, 5L, 0L))).containsExactly(38, 62, 0);
        // 1/6 = 16.7, 2/6 = 33.3, 3/6 = 50 → 버림 16, 33, 50 → 남은 1은 소수점 .7인 첫 칸 → 17, 33, 50
        assertThat(SentimentRatioResponse.toPercents(List.of(1L, 2L, 3L))).containsExactly(17, 33, 50);
    }

    @Test
    void 글이_없으면_모두_0() {
        assertThat(SentimentRatioResponse.toPercents(List.of(0L, 0L, 0L))).containsExactly(0, 0, 0);
    }

    @Test
    void 없는_감성은_0건으로_본다() {
        SentimentRatioResponse ratio = SentimentRatioResponse.from(Map.of("POSITIVE", 1L, "NEUTRAL", 1L));
        assertThat(ratio.articleCount()).isEqualTo(2);
        assertThat(ratio.negativeCount()).isZero();
        assertThat(List.of(ratio.positive(), ratio.negative(), ratio.neutral())).containsExactly(50, 0, 50);
    }
}

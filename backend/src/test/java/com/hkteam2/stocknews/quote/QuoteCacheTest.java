package com.hkteam2.stocknews.quote;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneId;
import java.time.ZoneOffset;
import java.util.concurrent.atomic.AtomicInteger;

import org.junit.jupiter.api.Test;

/** 짧은 캐시: 시간 안에는 다시 묻지 않고, 지나면 다시 묻고, 실패는 저장하지 않음 */
class QuoteCacheTest {

    /** 테스트에서 마음대로 돌릴 수 있는 시계 */
    static class MutableClock extends Clock {
        Instant now = Instant.parse("2026-11-03T01:00:00Z");

        @Override
        public ZoneId getZone() {
            return ZoneOffset.UTC;
        }

        @Override
        public Clock withZone(ZoneId zone) {
            return this;
        }

        @Override
        public Instant instant() {
            return now;
        }
    }

    @Test
    void 시간_안에는_다시_묻지_않고_지나면_다시_묻는다() {
        MutableClock clock = new MutableClock();
        QuoteCache cache = new QuoteCache(clock);
        AtomicInteger calls = new AtomicInteger();

        assertThat(cache.get("price:005930", Duration.ofSeconds(5), calls::incrementAndGet)).isEqualTo(1);
        clock.now = clock.now.plusSeconds(4);
        assertThat(cache.get("price:005930", Duration.ofSeconds(5), calls::incrementAndGet)).isEqualTo(1);   // 저장본
        clock.now = clock.now.plusSeconds(2);
        assertThat(cache.get("price:005930", Duration.ofSeconds(5), calls::incrementAndGet)).isEqualTo(2);   // 5초 지남
        assertThat(cache.get("price:000660", Duration.ofSeconds(5), calls::incrementAndGet)).isEqualTo(3);   // 다른 키
    }

    @Test
    void 실패한_결과는_저장하지_않는다() {
        QuoteCache cache = new QuoteCache(new MutableClock());
        assertThatThrownBy(() -> cache.get("k", Duration.ofSeconds(5), () -> {
            throw new KisApiException("EGW00201", "초당 거래건수를 초과하였습니다.");
        })).isInstanceOf(KisApiException.class);
        assertThat(cache.get("k", Duration.ofSeconds(5), () -> "ok")).isEqualTo("ok");
    }

    @Test
    void KIS_부호를_화면용_방향으로() {
        assertThat(QuoteService.direction("1")).isEqualTo("UP");     // 상한
        assertThat(QuoteService.direction("2")).isEqualTo("UP");     // 상승
        assertThat(QuoteService.direction("3")).isEqualTo("FLAT");   // 보합
        assertThat(QuoteService.direction("4")).isEqualTo("DOWN");   // 하한
        assertThat(QuoteService.direction("5")).isEqualTo("DOWN");   // 하락
        assertThat(QuoteService.direction(null)).isEqualTo("FLAT");
    }
}

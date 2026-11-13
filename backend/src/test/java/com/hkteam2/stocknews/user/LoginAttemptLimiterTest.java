package com.hkteam2.stocknews.user;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneId;
import java.time.ZoneOffset;

import org.junit.jupiter.api.Test;

/** 로그인 시도 제한: 시계를 직접 움직여 10분 규칙을 확인 */
class LoginAttemptLimiterTest {

    /** 테스트에서 시간을 앞으로 돌릴 수 있는 시계 */
    static final class MovableClock extends Clock {
        Instant now = Instant.parse("2026-11-13T01:00:00Z");

        void plus(Duration d) {
            now = now.plus(d);
        }

        @Override public ZoneId getZone() { return ZoneOffset.UTC; }
        @Override public Clock withZone(ZoneId zone) { return this; }
        @Override public Instant instant() { return now; }
    }

    private final MovableClock clock = new MovableClock();
    private final LoginAttemptLimiter limiter = new LoginAttemptLimiter(clock);

    private void fail(int times, String id, String ip) {
        for (int i = 0; i < times; i++) {
            limiter.onFailure(id, ip);
        }
    }

    @Test
    void 네_번까지는_안_막히고_다섯_번째에_막힌다() {
        fail(4, "user1", "1.1.1.1");
        assertThat(limiter.isLocked("user1", "1.1.1.1")).isFalse();
        fail(1, "user1", "1.1.1.1");
        assertThat(limiter.isLocked("user1", "1.1.1.1")).isTrue();
    }

    @Test
    void 십분이_지나면_풀린다() {
        fail(5, "user1", "1.1.1.1");
        clock.plus(Duration.ofMinutes(9));
        assertThat(limiter.isLocked("user1", "1.1.1.1")).isTrue();
        clock.plus(Duration.ofMinutes(1).plusSeconds(1));
        assertThat(limiter.isLocked("user1", "1.1.1.1")).isFalse();
    }

    @Test
    void 틀린_횟수는_십분이_지나면_처음부터_센다() {
        fail(4, "user1", "1.1.1.1");
        clock.plus(Duration.ofMinutes(11));
        fail(1, "user1", "1.1.1.1");
        assertThat(limiter.isLocked("user1", "1.1.1.1")).isFalse();
    }

    @Test
    void 성공하면_센_것을_지운다() {
        fail(4, "user1", "1.1.1.1");
        limiter.onSuccess("user1", "1.1.1.1");
        fail(4, "user1", "1.1.1.1");
        assertThat(limiter.isLocked("user1", "1.1.1.1")).isFalse();
    }

    @Test
    void 다른_곳에서는_주인이_계속_로그인할_수_있다() {
        // 남이 일부러 틀려서 진짜 주인을 잠그지 못하게 IP 도 같이 봄
        fail(5, "user1", "6.6.6.6");
        assertThat(limiter.isLocked("user1", "6.6.6.6")).isTrue();
        assertThat(limiter.isLocked("user1", "1.1.1.1")).isFalse();
    }

    @Test
    void 아이디_대소문자는_같은_아이디로_센다() {
        fail(3, "User1", "1.1.1.1");
        fail(2, "user1", "1.1.1.1");
        assertThat(limiter.isLocked("USER1", "1.1.1.1")).isTrue();
    }
}

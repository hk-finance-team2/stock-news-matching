package com.hkteam2.stocknews.user;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.Locale;
import java.util.concurrent.ConcurrentHashMap;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;

/**
 * 로그인 시도 제한 (무차별 대입 막기). 같은 아이디 + 같은 IP 에서 10분 안에 5번 틀리면 그때부터 10분 동안 막음.
 * - 막힌 동안은 비밀번호 검사(BCrypt)도 하지 않음 → 서버 부담도 줄임
 * - 성공하면 그 기록을 지움
 * - 아이디만 기준으로 하면 남이 일부러 틀려서 진짜 주인을 잠글 수 있어서 IP 도 같이 봄
 * - 메모리에 셈: 서버가 한 대라 충분. 서버를 여러 대로 늘리면 Redis 같은 공용 저장소가 필요 (한계)
 * - 한계: IP 를 계속 바꾸거나 여러 아이디에 흩어 시도하는 공격은 이것만으로 못 막음
 */
@Component
public class LoginAttemptLimiter {

    static final int MAX_FAILURES = 5;
    static final Duration WINDOW = Duration.ofMinutes(10);
    static final Duration LOCK = Duration.ofMinutes(10);
    private static final int CLEANUP_SIZE = 10_000; // 기록이 이만큼 쌓이면 오래된 것을 지움 (메모리가 끝없이 늘지 않게)

    private final Clock clock;
    private final ConcurrentHashMap<String, Attempts> attempts = new ConcurrentHashMap<>();

    @Autowired
    public LoginAttemptLimiter() {
        this(Clock.systemUTC());
    }

    LoginAttemptLimiter(Clock clock) {
        this.clock = clock;
    }

    /** 지금 막혀 있으면 true */
    public boolean isLocked(String loginId, String ip) {
        Attempts a = attempts.get(key(loginId, ip));
        return a != null && a.lockedUntil != null && clock.instant().isBefore(a.lockedUntil);
    }

    /** 틀렸을 때. 10분 안에 5번째면 잠금 */
    public void onFailure(String loginId, String ip) {
        Instant now = clock.instant();
        attempts.compute(key(loginId, ip), (k, old) -> {
            Attempts a = (old == null || now.isAfter(old.windowStart.plus(WINDOW))) ? new Attempts(now) : old;
            a.failures++;
            if (a.failures >= MAX_FAILURES) {
                a.lockedUntil = now.plus(LOCK);
            }
            return a;
        });
        if (attempts.size() > CLEANUP_SIZE) {
            attempts.entrySet().removeIf(e -> e.getValue().expired(now));
        }
    }

    /** 성공했을 때 기록을 지움 */
    public void onSuccess(String loginId, String ip) {
        attempts.remove(key(loginId, ip));
    }

    private static String key(String loginId, String ip) {
        return (loginId == null ? "" : loginId.toLowerCase(Locale.ROOT)) + "|" + ip;
    }

    private static final class Attempts {
        final Instant windowStart;
        int failures;
        Instant lockedUntil;

        Attempts(Instant windowStart) {
            this.windowStart = windowStart;
        }

        boolean expired(Instant now) {
            Instant end = windowStart.plus(WINDOW);
            if (lockedUntil != null && lockedUntil.isAfter(end)) {
                end = lockedUntil;
            }
            return now.isAfter(end);
        }
    }
}

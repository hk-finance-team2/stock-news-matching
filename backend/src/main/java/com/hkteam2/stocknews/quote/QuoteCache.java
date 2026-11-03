package com.hkteam2.stocknews.quote;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.concurrent.ConcurrentHashMap;
import java.util.function.Supplier;

/**
 * 짧은 캐시 ("냉장고"): 같은 것을 몇 초 안에 또 물으면 KIS에 다시 묻지 않고 저장해 둔 답을 줌
 * 사용자가 여럿이어도 KIS 호출은 종목·종류마다 ttl에 한 번 → 초당 호출 한도를 지킴
 *
 * 같은 키를 여러 요청이 동시에 물으면 한 요청만 KIS에 가고 나머지는 그 결과를 기다려 씀 (키마다 잠금)
 * 실패한 결과는 저장하지 않음 (다음 요청이 다시 시도)
 */
class QuoteCache {

    private record Entry(Object value, Instant expiresAt) {
    }

    private final ConcurrentHashMap<String, Entry> entries = new ConcurrentHashMap<>();
    private final ConcurrentHashMap<String, Object> locks = new ConcurrentHashMap<>();
    private final Clock clock;

    QuoteCache(Clock clock) {
        this.clock = clock;
    }

    @SuppressWarnings("unchecked")
    <T> T get(String key, Duration ttl, Supplier<T> loader) {
        Entry e = entries.get(key);
        if (fresh(e)) {
            return (T) e.value();
        }
        synchronized (locks.computeIfAbsent(key, k -> new Object())) {
            e = entries.get(key);
            if (fresh(e)) {
                return (T) e.value();   // 기다리는 동안 다른 요청이 채워 둠
            }
            T value = loader.get();
            entries.put(key, new Entry(value, clock.instant().plus(ttl)));
            return value;
        }
    }

    private boolean fresh(Entry e) {
        return e != null && clock.instant().isBefore(e.expiresAt());
    }
}

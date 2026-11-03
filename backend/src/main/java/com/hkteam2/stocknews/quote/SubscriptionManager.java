package com.hkteam2.stocknews.quote;

import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.TreeMap;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.TimeUnit;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

import jakarta.annotation.PostConstruct;
import jakarta.annotation.PreDestroy;

/**
 * 생중계(웹소켓 구독) 자리 관리 — "방송 카메라 몇 대를 어디에 둘까"
 *
 * 자리 = KIS 웹소켓 등록 한도 (공식 41건, 신규 키는 처음 3일 동안 3건으로 보임)
 *   고정 자리: KIS_FIXED_CODES (항상 생중계)
 *   돌려쓰는 자리: 나머지. 방송(SSE)으로 누가 보고 있는 종목에 줌
 * 규칙
 *   ① 누가 종목을 보기 시작하면(보는 사람 수 +1) 생중계가 아니면 자리를 줌
 *      빈자리가 없으면 "아무도 안 보는" 돌려쓰는 자리 중 가장 오래 쉰 것을 해제하고 그 자리를 줌
 *      그것도 없으면 그 종목은 REST 5초 조회로 대신 (방송국이 처리)
 *   ② 보는 사람이 0명이 되어도 바로 끊지 않고 60초 기다림 (새로고침·잠깐 이동 때 등록·해제 반복 방지 —
 *      KIS 공지: 등록·해제를 무리하게 반복하면 앱키·IP 차단 가능)
 *   ③ KIS가 MAX SUBSCRIBE OVER로 거절하면 실제 한도를 지금 성공한 수로 낮춤 (스스로 알아냄)
 *   ④ 웹소켓이 다시 붙으면 지금 자리 목록을 다시 등록
 */
@Component
@ConditionalOnProperty(name = "KIS_ENABLED", havingValue = "true")
public class SubscriptionManager implements KisWebSocketClient.SubscriptionListener {

    private static final Logger log = LoggerFactory.getLogger(SubscriptionManager.class);
    static final Duration IDLE_RELEASE = Duration.ofSeconds(60);

    private final KisWebSocketClient ws;
    private final KisProperties props;
    private final ScheduledExecutorService scheduler =
            Executors.newSingleThreadScheduledExecutor(r -> new Thread(r, "kis-subscription"));

    private final Set<String> fixed;
    /** 자리를 준 종목 (등록 요청 중이거나 성공). 고정 + 돌려쓰기 */
    private final Set<String> active = new LinkedHashSet<>();
    private final Map<String, Integer> viewers = new HashMap<>();
    private final Map<String, Instant> idleSince = new HashMap<>();
    private int capacity;

    public SubscriptionManager(KisWebSocketClient ws, KisProperties props) {
        this.ws = ws;
        this.props = props;
        this.capacity = props.maxSubscriptions();
        this.fixed = new LinkedHashSet<>(props.fixedCodes().subList(0, Math.min(props.fixedCodes().size(), capacity)));
        this.active.addAll(fixed);
    }

    @PostConstruct
    void start() {
        ws.setListener(this);
        scheduler.scheduleWithFixedDelay(this::housekeeping, 10, 10, TimeUnit.SECONDS);
    }

    @PreDestroy
    void stop() {
        scheduler.shutdownNow();
    }

    // ----- 방송국이 알려 주는 "보기 시작 / 그만 봄" -----

    public synchronized void watch(String code) {
        viewers.merge(code, 1, Integer::sum);
        idleSince.remove(code);
        ensure(code);
    }

    public synchronized void unwatch(String code) {
        int n = viewers.merge(code, -1, Integer::sum);
        if (n <= 0) {
            viewers.remove(code);
            idleSince.put(code, Instant.now());
        }
    }

    /** 생중계 자리를 주거나, 가장 오래 쉰 돌려쓰는 자리를 넘겨받음 */
    private void ensure(String code) {
        if (active.contains(code)) {
            return;
        }
        if (active.size() >= capacity) {
            String victim = oldestIdleRotating();
            if (victim == null) {
                return;   // 다 누가 보고 있음 → REST로 대신
            }
            release(victim);
        }
        active.add(code);
        ws.subscribe(code);
        log.info("생중계 자리 {} 줌 (사용 {}/{})", code, active.size(), capacity);
    }

    private String oldestIdleRotating() {
        String best = null;
        Instant bestAt = null;
        for (String code : active) {
            if (fixed.contains(code) || viewers.containsKey(code)) {
                continue;
            }
            Instant at = idleSince.getOrDefault(code, Instant.EPOCH);
            if (bestAt == null || at.isBefore(bestAt)) {
                best = code;
                bestAt = at;
            }
        }
        return best;
    }

    private void release(String code) {
        active.remove(code);
        idleSince.remove(code);
        ws.unsubscribe(code);
        log.info("생중계 자리 {} 반납 (사용 {}/{})", code, active.size(), capacity);
    }

    /** 10초마다: 60초 넘게 아무도 안 본 돌려쓰는 자리 반납 → 자리를 못 받은 종목에 다시 줌 */
    private synchronized void housekeeping() {
        try {
            Instant limit = Instant.now().minus(IDLE_RELEASE);
            for (String code : new ArrayList<>(active)) {
                Instant idle = idleSince.get(code);
                if (!fixed.contains(code) && !viewers.containsKey(code) && idle != null && idle.isBefore(limit)) {
                    release(code);
                }
            }
            for (String code : new ArrayList<>(viewers.keySet())) {
                ensure(code);
            }
        } catch (RuntimeException e) {
            log.warn("생중계 자리 정리 실패: {}", e.getMessage());
        }
    }

    // ----- 웹소켓이 알려 주는 것 -----

    /** 다시 붙었을 때: 지금 자리 목록을 다시 등록 (등록 요청은 0.2초 간격) */
    @Override
    public void onConnected() {
        List<String> codes;
        synchronized (this) {
            codes = List.copyOf(active);
        }
        for (String code : codes) {
            ws.subscribe(code);
            try {
                Thread.sleep(200);
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
                return;
            }
        }
    }

    @Override
    public synchronized void onResult(String code, boolean ok, String message) {
        if (ok || code == null) {
            return;
        }
        if (message != null && message.contains("MAX SUBSCRIBE")) {
            active.remove(code);
            int confirmed = ws.subscribedCodes().size();
            if (confirmed < capacity) {
                log.warn("KIS 등록 한도가 {}개로 보임 (설정 {}). 신규 키는 처음 3일 동안 낮음", confirmed, capacity);
                capacity = Math.max(1, confirmed);
            }
        }
    }

    // ----- 상태 -----

    public synchronized int capacity() {
        return capacity;
    }

    public synchronized List<String> fixedCodes() {
        return List.copyOf(fixed);
    }

    public synchronized List<String> activeCodes() {
        return List.copyOf(active);
    }

    /** 종목별 지금 보는 사람 수 (코드 순) */
    public synchronized Map<String, Integer> viewers() {
        return new TreeMap<>(viewers);
    }

    /** 자리를 못 받아 REST로 대신하는 종목 */
    public synchronized List<String> waitingCodes() {
        List<String> out = new ArrayList<>();
        new LinkedHashMap<>(viewers).keySet().forEach(c -> {
            if (!active.contains(c)) {
                out.add(c);
            }
        });
        return out;
    }
}

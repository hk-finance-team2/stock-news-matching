package com.hkteam2.stocknews.quote;

import java.io.IOException;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.TimeUnit;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import com.hkteam2.stocknews.common.TimeUtils;

import jakarta.annotation.PostConstruct;
import jakarta.annotation.PreDestroy;

/**
 * 방송국 (SSE): 브라우저가 "이 종목들 들을게"라고 연결해 두면, 바뀐 것만 밀어 줌
 *
 * 특강 원칙 "브라우저마다 DB를 조회하지 않는다": 사용자가 100명이어도 DB 조회는 이 방송국 한 곳에서 1초마다 한 번
 * 1초마다:
 *   ① 듣는 사람이 있는 종목의 현재가 줄(quote_snapshot) 중 지난번 이후 바뀐 것 → 이벤트 "quote" (live=true)
 *   ② 생중계가 아닌 종목(구독 자리 없음)은 5초마다 REST 조회(5초 캐시) → "quote" (live=false)
 *   ③ 지난번 이후 새로 저장된 체결(quote_tick) → 이벤트 "tick"
 * 연결하자마자: 지금 현재가를 한 번 보냄 ("처음 값은 바로, 이후는 push")
 * 15초마다: 빈 신호(주석)를 보내 중간 장비가 연결을 끊지 않게 함
 * 연결이 끊기면(화면을 떠남·시간 초과·오류) 목록에서 지움
 */
@Component
@ConditionalOnProperty(name = "KIS_ENABLED", havingValue = "true")
public class QuoteStreamHub {

    private static final Logger log = LoggerFactory.getLogger(QuoteStreamHub.class);
    private static final long TIMEOUT_MS = Duration.ofMinutes(30).toMillis();   // 그 뒤엔 브라우저가 알아서 다시 연결
    private static final Duration REST_EVERY = Duration.ofSeconds(5);
    private static final int MAX_TICKS_PER_ROUND = 500;

    /** 연결 하나 = 브라우저 탭 하나가 듣는 종목들 */
    private record Client(SseEmitter emitter, Set<String> codes) {
    }

    private final QuoteMapper mapper;
    private final QuoteService quotes;
    private final Set<Client> clients = ConcurrentHashMap.newKeySet();
    private final ScheduledExecutorService scheduler =
            Executors.newSingleThreadScheduledExecutor(r -> new Thread(r, "quote-stream"));

    // 아래 셋은 scheduler 스레드에서만 씀
    private long lastTickId;
    private final Map<String, LocalDateTime> lastSentUpdate = new HashMap<>();
    private final Map<String, Instant> lastRestAt = new HashMap<>();

    public QuoteStreamHub(QuoteMapper mapper, QuoteService quotes) {
        this.mapper = mapper;
        this.quotes = quotes;
    }

    @PostConstruct
    void start() {
        lastTickId = mapper.maxTickId();   // 서버 켜기 전 체결은 다시 보내지 않음
        scheduler.scheduleWithFixedDelay(this::publishSafely, 1, 1, TimeUnit.SECONDS);
        scheduler.scheduleWithFixedDelay(this::heartbeat, 15, 15, TimeUnit.SECONDS);
    }

    @PreDestroy
    void stop() {
        scheduler.shutdownNow();
        clients.forEach(c -> c.emitter().complete());
    }

    /** 새 청취자. 돌려준 SseEmitter를 Controller가 그대로 응답으로 돌려줌 (연결이 열린 채로 유지됨) */
    public SseEmitter subscribe(List<String> codes) {
        SseEmitter emitter = new SseEmitter(TIMEOUT_MS);
        Client client = new Client(emitter, Set.copyOf(codes));
        emitter.onCompletion(() -> clients.remove(client));
        emitter.onTimeout(() -> clients.remove(client));
        emitter.onError(e -> clients.remove(client));
        clients.add(client);
        scheduler.execute(() -> sendInitial(client));   // KIS 조회가 느릴 수 있어 요청 스레드에서 하지 않음
        return emitter;
    }

    public int clientCount() {
        return clients.size();
    }

    private void sendInitial(Client c) {
        for (String code : c.codes()) {
            try {
                send(c, "quote", quotes.price(code));
            } catch (RuntimeException e) {
                log.debug("첫 현재가 실패 {}: {}", code, e.getMessage());
            }
        }
    }

    private void publishSafely() {
        try {
            publish();
        } catch (RuntimeException e) {
            log.warn("방송 실패: {}", e.getMessage());
        }
    }

    private void publish() {
        Set<String> watched = new HashSet<>();
        clients.forEach(c -> watched.addAll(c.codes()));
        if (watched.isEmpty()) {
            lastTickId = Math.max(lastTickId, mapper.maxTickId());   // 아무도 안 들을 때 쌓인 체결은 건너뜀
            return;
        }
        // ① 생중계 종목: 현재가 줄이 바뀌었으면
        Set<String> live = new HashSet<>();
        for (QuoteSnapshotRow s : mapper.findSnapshots(watched)) {
            if (!quotes.isLive(s)) {
                continue;
            }
            live.add(s.stockCode());
            LocalDateTime prev = lastSentUpdate.get(s.stockCode());
            if (prev == null || s.updatedAt().isAfter(prev)) {
                lastSentUpdate.put(s.stockCode(), s.updatedAt());
                broadcast(s.stockCode(), "quote", QuoteService.fromSnapshot(s));
            }
        }
        // ② 생중계가 아닌 종목: 5초마다 REST (QuoteService가 5초 캐시 + 호출 간격 조절)
        Instant now = Instant.now();
        for (String code : watched) {
            if (live.contains(code)) {
                continue;
            }
            Instant last = lastRestAt.get(code);
            if (last == null || last.plus(REST_EVERY).isBefore(now)) {
                lastRestAt.put(code, now);
                try {
                    broadcast(code, "quote", quotes.price(code));
                } catch (RuntimeException e) {
                    log.debug("REST 현재가 실패 {}: {}", code, e.getMessage());
                }
            }
        }
        // ③ 새 체결
        List<TickRow> ticks = mapper.findTicksAfter(watched, lastTickId, MAX_TICKS_PER_ROUND);
        for (TickRow t : ticks) {
            int sign = t.changeRate().signum();
            broadcast(t.stockCode(), "tick", new LiveTickEvent(t.stockCode(), TimeUtils.toKst(t.tradedAt()), t.price(),
                    t.changeRate(), sign > 0 ? "UP" : (sign < 0 ? "DOWN" : "FLAT"), t.volume()));
            lastTickId = Math.max(lastTickId, t.tickId());
        }
        if (ticks.size() < MAX_TICKS_PER_ROUND) {
            lastTickId = Math.max(lastTickId, mapper.maxTickId());   // 안 듣는 종목 체결은 건너뜀
        }
    }

    private void broadcast(String code, String event, Object data) {
        for (Client c : clients) {
            if (c.codes().contains(code)) {
                send(c, event, data);
            }
        }
    }

    private void heartbeat() {
        for (Client c : clients) {
            try {
                synchronized (c) {
                    c.emitter().send(SseEmitter.event().comment("ping"));
                }
            } catch (IOException | IllegalStateException e) {
                drop(c);
            }
        }
    }

    private void send(Client c, String event, Object data) {
        try {
            synchronized (c) {   // 한 연결에 두 스레드가 동시에 쓰지 않게
                c.emitter().send(SseEmitter.event().name(event).data(data, MediaType.APPLICATION_JSON));
            }
        } catch (IOException | IllegalStateException e) {
            drop(c);   // 브라우저가 이미 떠남
        }
    }

    /**
     * 끊긴 연결을 목록에서 뺌. 이미 깨진 응답에 complete()를 부르면 Spring이 오류(AsyncRequestNotUsableException)를
     * 한 번 더 내므로 부르지 않음 → 정리는 서블릿 컨테이너가 onError/onCompletion으로 함
     */
    private void drop(Client c) {
        clients.remove(c);
    }
}

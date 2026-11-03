package com.hkteam2.stocknews.quote;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.WebSocket;
import java.nio.ByteBuffer;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Set;
import java.util.TreeSet;
import java.util.concurrent.CompletionStage;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.atomic.AtomicLong;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.stereotype.Component;

import com.hkteam2.stocknews.common.TimeUtils;

import jakarta.annotation.PreDestroy;

/**
 * KIS 실시간 체결 받기 (웹소켓, 받는 쪽 Receiver)
 *
 * 흐름: 서버 준비 완료 → 웹소켓 접속키 받기 → 접속 → 고정 종목 구독 등록 → 체결이 올 때마다
 *   데이터 줄 → TickParser로 읽어 대기열(TickBuffer)에 넣기만 함 (저장은 TickWriter가 따로)
 *   읽지 못한 줄 → 격리함(quote_quarantine)에 원문 보관
 *   PINGPONG → 같은 내용으로 pong 응답 (안 하면 KIS가 연결을 끊음)
 *   구독 응답(JSON) → 성공·실패 로그
 * 끊기면 1·2·4·8…초(최대 60초) 뒤 다시 접속하고 구독도 다시 등록
 *
 * JDK 기본 웹소켓(java.net.http.WebSocket) 사용 → 라이브러리 추가 없음
 * 접속키·키는 로그에 찍지 않음
 */
@Component
@ConditionalOnProperty(name = "KIS_ENABLED", havingValue = "true")
public class KisWebSocketClient {

    private static final Logger log = LoggerFactory.getLogger(KisWebSocketClient.class);
    private static final Pattern RT_CD = Pattern.compile("\"rt_cd\"\\s*:\\s*\"([^\"]*)\"");
    private static final Pattern MSG1 = Pattern.compile("\"msg1\"\\s*:\\s*\"([^\"]*)\"");
    private static final Pattern TR_KEY = Pattern.compile("\"tr_key\"\\s*:\\s*\"([^\"]*)\"");
    private static final int MAX_RAW = 5000;

    private final KisProperties props;
    private final KisTokenManager tokens;
    private final TickBuffer buffer;
    private final QuoteMapper mapper;
    private final HttpClient http = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(10)).build();
    private final ScheduledExecutorService scheduler =
            Executors.newSingleThreadScheduledExecutor(r -> new Thread(r, "kis-websocket"));

    private volatile boolean running;
    private volatile WebSocket socket;
    private volatile String approvalKey;
    private volatile LocalDateTime connectedAt;
    private volatile LocalDateTime lastMessageAt;
    private final AtomicBoolean reconnectPending = new AtomicBoolean();
    private final Set<String> subscribed = ConcurrentHashMap.newKeySet();
    private final AtomicLong messages = new AtomicLong();
    private final AtomicLong quarantined = new AtomicLong();
    private final AtomicLong reconnects = new AtomicLong();
    private int failures;
    private volatile SubscriptionListener listener;

    /** 구독 자리 관리자(SubscriptionManager)가 접속·등록 결과를 받는 창구 */
    public interface SubscriptionListener {
        /** 접속(재접속) 직후: 등록할 종목을 다시 보내 달라는 신호 */
        void onConnected();

        /** 등록·해제 응답. ok=false면 message에 이유 (예: MAX SUBSCRIBE OVER) */
        void onResult(String code, boolean ok, String message);
    }

    public void setListener(SubscriptionListener listener) {
        this.listener = listener;
    }

    public KisWebSocketClient(KisProperties props, KisTokenManager tokens, TickBuffer buffer, QuoteMapper mapper) {
        this.props = props;
        this.tokens = tokens;
        this.buffer = buffer;
        this.mapper = mapper;
    }

    /** 서버가 다 켜진 뒤 접속 (켜지는 도중에 KIS를 기다리지 않게) */
    @EventListener(ApplicationReadyEvent.class)
    public void start() {
        running = true;
        scheduler.execute(this::connect);
    }

    @PreDestroy
    void stop() {
        running = false;
        WebSocket ws = socket;
        if (ws != null) {
            ws.abort();
        }
        scheduler.shutdownNow();
    }

    private void connect() {
        reconnectPending.set(false);
        if (!running) {
            return;
        }
        try {
            approvalKey = tokens.approvalKey();
            WebSocket old = socket;
            if (old != null) {
                old.abort();
            }
            socket = http.newWebSocketBuilder()
                    .buildAsync(URI.create(props.webSocketUrl()), new Listener())
                    .get(15, TimeUnit.SECONDS);
            connectedAt = LocalDateTime.now(TimeUtils.KST);
            failures = 0;
            subscribed.clear();
            log.info("KIS 웹소켓 연결됨 ({})", props.mode());
            SubscriptionListener l = listener;
            if (l != null) {
                l.onConnected();   // 자리 관리자가 지금 자리 목록을 0.2초 간격으로 등록
            }
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
        } catch (Exception e) {
            log.warn("KIS 웹소켓 연결 실패: {} {}", e.getClass().getSimpleName(), e.getMessage());
            scheduleReconnect();
        }
    }

    /** 실시간 등록. 연결 전이면 건너뜀 (접속하면 자리 관리자가 다시 보냄) */
    public void subscribe(String code) {
        if (connected()) {
            send(subscribeMessage(code, "1"));
        }
    }

    /** 실시간 해제 */
    public void unsubscribe(String code) {
        subscribed.remove(code);
        if (connected()) {
            send(subscribeMessage(code, "2"));
        }
    }

    private void scheduleReconnect() {
        connectedAt = null;
        if (!running || !reconnectPending.compareAndSet(false, true)) {
            return;   // 이미 다시 접속하기로 함 (onClose·onError가 같이 와도 한 번만)
        }
        failures++;
        long delay = Math.min(60, 1L << Math.min(failures - 1, 6));
        reconnects.incrementAndGet();
        log.info("KIS 웹소켓 {}초 뒤 다시 접속", delay);
        scheduler.schedule(this::connect, delay, TimeUnit.SECONDS);
    }

    /** 구독 등록("1")·해제("2") 메시지. 헤더에 웹소켓 접속키 */
    private String subscribeMessage(String code, String trType) {
        return "{\"header\":{\"approval_key\":\"" + approvalKey + "\",\"custtype\":\"P\",\"tr_type\":\"" + trType
                + "\",\"content-type\":\"utf-8\"},\"body\":{\"input\":{\"tr_id\":\"" + TickParser.TR_ID
                + "\",\"tr_key\":\"" + code + "\"}}}";
    }

    /** 보내기 (앞 메시지가 다 나간 뒤 다음 것. 여러 스레드가 동시에 보내지 않게 synchronized) */
    private synchronized void send(String text) {
        WebSocket ws = socket;
        if (ws != null) {
            try {
                ws.sendText(text, true).join();
            } catch (RuntimeException e) {
                log.warn("KIS 웹소켓 보내기 실패: {}", e.getMessage());
            }
        }
    }

    /** 받은 메시지 하나 처리 */
    void handle(WebSocket ws, String msg) {
        messages.incrementAndGet();
        LocalDateTime now = LocalDateTime.now(TimeUtils.KST);
        lastMessageAt = now;
        if (TickParser.isData(msg)) {
            TickParser.Result r = TickParser.parse(msg, now);
            if (r.error() == null) {
                buffer.add(r.ticks());
            } else {
                quarantine(msg, r.error(), now);
            }
            return;
        }
        if (msg.contains("\"PINGPONG\"")) {
            byte[] payload = msg.getBytes(StandardCharsets.UTF_8);
            if (payload.length <= 125) {
                ws.sendPong(ByteBuffer.wrap(payload));
            } else {
                ws.sendText(msg, true);
            }
            return;
        }
        String rt = find(RT_CD, msg);
        String key = find(TR_KEY, msg);
        String m = find(MSG1, msg);
        boolean ok = "0".equals(rt) || (m != null && m.contains("ALREADY IN SUBSCRIBE"));   // 이미 등록돼 있어도 성공으로 봄
        if (ok && key != null) {
            if (m != null && m.contains("UNSUBSCRIBE")) {
                subscribed.remove(key);
            } else {
                subscribed.add(key);
            }
            log.info("KIS 실시간 {}: {}", key, m);
        } else {
            log.warn("KIS 실시간 응답 {}: rt_cd={} {}", key, rt, m);
        }
        SubscriptionListener l = listener;
        if (l != null) {
            l.onResult(key, ok, m);
        }
    }

    private void quarantine(String raw, String reason, LocalDateTime now) {
        quarantined.incrementAndGet();
        try {
            mapper.insertQuarantine(raw.length() > MAX_RAW ? raw.substring(0, MAX_RAW) : raw, reason, now);
        } catch (RuntimeException e) {
            log.warn("격리함 저장 실패: {}", e.getMessage());
        }
    }

    private static String find(Pattern p, String s) {
        Matcher m = p.matcher(s);
        return m.find() ? m.group(1) : null;
    }

    /** 웹소켓 이벤트 받기. 텍스트가 여러 조각으로 올 수 있어 last가 올 때까지 이어 붙임 */
    private final class Listener implements WebSocket.Listener {

        private final StringBuilder partial = new StringBuilder();

        @Override
        public void onOpen(WebSocket webSocket) {
            webSocket.request(1);
        }

        @Override
        public CompletionStage<?> onText(WebSocket webSocket, CharSequence data, boolean last) {
            partial.append(data);
            if (last) {
                String msg = partial.toString();
                partial.setLength(0);
                try {
                    handle(webSocket, msg);
                } catch (RuntimeException e) {
                    log.warn("실시간 메시지 처리 실패: {}", e.getMessage());
                }
            }
            webSocket.request(1);
            return null;
        }

        @Override
        public CompletionStage<?> onClose(WebSocket webSocket, int statusCode, String reason) {
            log.warn("KIS 웹소켓 끊김: {} {}", statusCode, reason);
            scheduleReconnect();
            return null;
        }

        @Override
        public void onError(WebSocket webSocket, Throwable error) {
            log.warn("KIS 웹소켓 오류: {} {}", error.getClass().getSimpleName(), error.getMessage());
            scheduleReconnect();
        }
    }

    // ----- 상태 (GET /api/quotes/status) -----

    public boolean connected() {
        return connectedAt != null;
    }

    public LocalDateTime connectedAt() {
        return connectedAt;
    }

    public LocalDateTime lastMessageAt() {
        return lastMessageAt;
    }

    public List<String> subscribedCodes() {
        return List.copyOf(new TreeSet<>(subscribed));
    }

    public long messages() {
        return messages.get();
    }

    public long quarantined() {
        return quarantined.get();
    }

    public long reconnects() {
        return reconnects.get();
    }
}

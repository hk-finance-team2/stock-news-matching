package com.hkteam2.stocknews.quote;

import java.io.IOException;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Duration;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.atomic.AtomicInteger;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import com.hkteam2.stocknews.common.TimeUtils;

import jakarta.annotation.PreDestroy;

/**
 * 녹화본(quote_tick)으로 하는 일: 다시 보기, 녹화된 날 목록, 수집 점검
 * DB만 읽으므로 KIS 스위치와 상관없이 동작 (녹화본이 있는 PC라면 키가 없어도 다시 보기 가능)
 *
 * 다시 보기 = CCTV 재생: 체결 사이 실제 간격 ÷ 배속만큼 기다렸다가 다음 체결을 보냄
 *   - 긴 공백(서버가 꺼져 있던 시간 등)은 최대 5초로 줄임
 *   - 한 번에 500건씩 읽어 메모리를 아낌
 *   - 브라우저가 떠나면(보내기 실패) 멈춤. 동시에 최대 5개
 */
@Service
public class QuoteHistoryService {

    private static final Logger log = LoggerFactory.getLogger(QuoteHistoryService.class);
    static final int MAX_REPLAYS = 5;
    private static final int PAGE = 500;
    private static final long MAX_GAP_MS = 5000;
    private static final long TIMEOUT_MS = Duration.ofHours(2).toMillis();

    private final QuoteMapper mapper;
    private final ExecutorService pool =
            Executors.newFixedThreadPool(MAX_REPLAYS, r -> new Thread(r, "quote-replay"));
    private final AtomicInteger running = new AtomicInteger();

    public QuoteHistoryService(QuoteMapper mapper) {
        this.mapper = mapper;
    }

    @PreDestroy
    void stop() {
        pool.shutdownNow();
    }

    public List<RecordingResponse> recordings(String stockCode) {
        return mapper.findRecordings(stockCode).stream()
                .map(r -> new RecordingResponse(r.tradeDate(), r.tickCount(),
                        TimeUtils.toKst(r.firstAt()), TimeUtils.toKst(r.lastAt())))
                .toList();
    }

    /** 다시 보기 시작. 이벤트: start(한 번) → replay(체결마다) → end(한 번) */
    public SseEmitter replay(String stockCode, LocalDate date, LocalTime from, int speed) {
        if (running.incrementAndGet() > MAX_REPLAYS) {
            running.decrementAndGet();
            throw new ReplayBusyException();
        }
        SseEmitter emitter = new SseEmitter(TIMEOUT_MS);
        AtomicBoolean closed = new AtomicBoolean();
        emitter.onCompletion(() -> closed.set(true));
        emitter.onTimeout(() -> closed.set(true));
        emitter.onError(e -> closed.set(true));
        try {
            pool.execute(() -> run(emitter, closed, stockCode, date, date.atTime(from), speed));
        } catch (RuntimeException e) {
            running.decrementAndGet();
            throw e;
        }
        return emitter;
    }

    private void run(SseEmitter emitter, AtomicBoolean closed, String code, LocalDate date, LocalDateTime from, int speed) {
        long sent = 0;
        try {
            long total = mapper.countReplayTicks(code, date, from);
            emitter.send(SseEmitter.event().name("start").data(Map.of("stockCode", code, "date", date.toString(),
                    "from", from.toLocalTime().toString(), "speed", speed, "total", total), MediaType.APPLICATION_JSON));
            LocalDateTime prev = null;
            long afterId = 0;
            while (!closed.get()) {
                List<TickRow> page = mapper.findReplayTicks(code, date, from, afterId, PAGE);
                if (page.isEmpty()) {
                    break;
                }
                for (TickRow t : page) {
                    if (closed.get()) {
                        break;
                    }
                    if (prev != null) {
                        long gap = Math.min(Duration.between(prev, t.tradedAt()).toMillis(), MAX_GAP_MS);
                        if (gap > 0) {
                            Thread.sleep(gap / speed);
                        }
                    }
                    int sign = t.changeRate().signum();
                    emitter.send(SseEmitter.event().name("replay").data(new ReplayTickEvent(code,
                            TimeUtils.toKst(t.tradedAt()), t.price(), t.changeRate(),
                            sign > 0 ? "UP" : (sign < 0 ? "DOWN" : "FLAT"), t.volume(), t.accVolume(), ++sent),
                            MediaType.APPLICATION_JSON));
                    prev = t.tradedAt();
                    afterId = t.tickId();
                }
            }
            if (!closed.get()) {
                emitter.send(SseEmitter.event().name("end").data(Map.of("sent", sent), MediaType.APPLICATION_JSON));
                emitter.complete();
            }
        } catch (IOException | IllegalStateException e) {
            log.debug("다시 보기 연결 끊김 ({}건 보냄)", sent);   // 브라우저가 떠남
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
        } catch (RuntimeException e) {
            log.warn("다시 보기 실패: {}", e.getMessage());
        } finally {
            running.decrementAndGet();
        }
    }

    /** 수집 점검: 종목마다 저장한 체결량이 실제 거래량(누적 거래량 차이)의 몇 %인지 */
    public CollectCheckResponse check(LocalDate date) {
        List<CollectCheckResponse.Item> items = mapper.checkCollection(date).stream().map(r -> {
            long expected = r.lastAcc() - r.firstAcc() + r.firstVolume();
            BigDecimal rate = expected <= 0 ? BigDecimal.ZERO
                    : BigDecimal.valueOf(r.savedVolume() * 100.0 / expected).setScale(2, RoundingMode.HALF_UP);
            return new CollectCheckResponse.Item(r.stockCode(), r.stockName(), r.tickCount(), r.savedVolume(),
                    expected, Math.max(0, expected - r.savedVolume()), rate,
                    TimeUtils.toKst(r.firstAt()), TimeUtils.toKst(r.lastAt()), r.avgDelayMs(), r.maxDelayMs());
        }).toList();
        return new CollectCheckResponse(date, items);
    }
}

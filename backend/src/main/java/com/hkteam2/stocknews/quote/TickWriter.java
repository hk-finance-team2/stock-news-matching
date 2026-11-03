package com.hkteam2.stocknews.quote;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicLong;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;
import org.springframework.transaction.support.TransactionTemplate;

import com.hkteam2.stocknews.common.TimeUtils;

import jakarta.annotation.PostConstruct;
import jakarta.annotation.PreDestroy;

/**
 * 대기열의 체결을 1초마다 모아서 한 번에 저장 (Batch)
 * 한 묶음 = 트랜잭션 하나: 체결 이력(quote_tick) + 종목별 현재가(quote_snapshot)를 같이 저장하고 같이 취소
 * 체결마다 COMMIT 하면 피크(초당 수백 건) 때 DB가 못 따라감 → BEGIN … INSERT N개 … COMMIT 1번
 * 저장에 실패하면 그 묶음은 로그를 남기고 버림 (대기열이 막혀 수신까지 멈추는 것보다 낫다고 판단, 버린 수를 셈)
 */
@Component
@ConditionalOnProperty(name = "KIS_ENABLED", havingValue = "true")
public class TickWriter {

    private static final Logger log = LoggerFactory.getLogger(TickWriter.class);
    private static final int MAX_BATCH = 2000;

    private final TickBuffer buffer;
    private final QuoteMapper mapper;
    private final TransactionTemplate tx;
    private final ScheduledExecutorService scheduler =
            Executors.newSingleThreadScheduledExecutor(r -> new Thread(r, "kis-tick-writer"));
    private final AtomicLong saved = new AtomicLong();
    private final AtomicLong failed = new AtomicLong();

    public TickWriter(TickBuffer buffer, QuoteMapper mapper, TransactionTemplate tx) {
        this.buffer = buffer;
        this.mapper = mapper;
        this.tx = tx;
    }

    @PostConstruct
    void start() {
        scheduler.scheduleWithFixedDelay(this::flushSafely, 1, 1, TimeUnit.SECONDS);
    }

    @PreDestroy
    void stop() {
        scheduler.shutdown();
        flushSafely();   // 서버를 끌 때 남은 체결까지 저장
    }

    private void flushSafely() {
        try {
            while (flush() == MAX_BATCH) {
                // 한 번에 다 못 꺼냈으면 바로 한 번 더 (밀린 것 따라잡기)
            }
        } catch (RuntimeException e) {
            log.warn("체결 저장 실패: {}", e.getMessage());
        }
    }

    /** 한 묶음 저장. 꺼낸 수 */
    int flush() {
        List<RealtimeTick> batch = new ArrayList<>();
        int n = buffer.drainTo(batch, MAX_BATCH);
        if (n == 0) {
            return 0;
        }
        // 현재가는 종목마다 이 묶음의 마지막(누적 거래량이 가장 큰) 체결 하나만
        Map<String, RealtimeTick> latest = new LinkedHashMap<>();
        for (RealtimeTick t : batch) {
            latest.merge(t.stockCode(), t, (a, b) -> b.accVolume() >= a.accVolume() ? b : a);
        }
        LocalDateTime now = LocalDateTime.now(TimeUtils.KST);
        try {
            Integer inserted = tx.execute(status -> {
                int rows = mapper.insertTicks(batch);
                mapper.upsertSnapshots(new ArrayList<>(latest.values()), now);
                return rows;
            });
            saved.addAndGet(inserted == null ? 0 : inserted);
        } catch (RuntimeException e) {
            failed.addAndGet(n);
            throw e;
        }
        return n;
    }

    public long saved() {
        return saved.get();
    }

    public long failed() {
        return failed.get();
    }
}

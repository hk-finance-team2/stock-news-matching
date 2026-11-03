package com.hkteam2.stocknews.quote;

import java.util.List;
import java.util.concurrent.LinkedBlockingQueue;
import java.util.concurrent.atomic.AtomicLong;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

/**
 * 받기와 저장 사이의 대기열 (메모리)
 * 받는 쪽(웹소켓)은 여기 넣기만 하고 바로 다음 메시지를 받으러 감 → DB가 잠깐 느려져도 수신이 멈추지 않음
 * 저장하는 쪽(TickWriter)이 1초마다 꺼내 감
 * 꽉 차면(DB가 오래 멈춤) 새 체결을 버리고 그 수를 셈 → 상태 API·정합성 점검에서 보임
 */
@Component
@ConditionalOnProperty(name = "KIS_ENABLED", havingValue = "true")
public class TickBuffer {

    private static final Logger log = LoggerFactory.getLogger(TickBuffer.class);
    static final int CAPACITY = 200_000;

    private final LinkedBlockingQueue<RealtimeTick> queue = new LinkedBlockingQueue<>(CAPACITY);
    private final AtomicLong received = new AtomicLong();
    private final AtomicLong dropped = new AtomicLong();

    public void add(List<RealtimeTick> ticks) {
        for (RealtimeTick t : ticks) {
            received.incrementAndGet();
            if (!queue.offer(t)) {
                if (dropped.incrementAndGet() % 1000 == 1) {
                    log.warn("체결 대기열이 꽉 차서 버림 (지금까지 {}건). DB 저장이 밀리고 있음", dropped.get());
                }
            }
        }
    }

    /** 최대 max건을 꺼내 list에 담음. 꺼낸 수 */
    public int drainTo(List<RealtimeTick> list, int max) {
        return queue.drainTo(list, max);
    }

    public int size() {
        return queue.size();
    }

    public long received() {
        return received.get();
    }

    public long dropped() {
        return dropped.get();
    }
}

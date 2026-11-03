package com.hkteam2.stocknews.quote;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

/**
 * KIS REST 호출 줄 세우기: 서버 전체에서 KIS로 가는 요청 사이를 최소 간격만큼 띄움
 *
 * 왜: 사용자가 몇 명이든 KIS 입장에서는 내 앱키 하나가 부르는 것. 2026-11-03 시험에서 조회 3~4번을
 * 연달아 보내자 EGW00201(초당 거래건수 초과)이 남 → 간격을 두고 보냄
 * 기본 500ms(초당 2건). KIS가 정한 정확한 한도는 포털 공지로 확인 후 KIS_REST_MIN_INTERVAL_MS 로 조정
 *
 * 줄 서기: 앞 사람이 나간 뒤 간격이 지나야 다음 사람이 들어감 (synchronized 안에서 기다림)
 */
@Component
@ConditionalOnProperty(name = "KIS_ENABLED", havingValue = "true")
public class KisRateLimiter {

    private final long minIntervalNanos;
    private long nextAllowedAt = 0;

    public KisRateLimiter(@Value("${KIS_REST_MIN_INTERVAL_MS:500}") long minIntervalMs) {
        this.minIntervalNanos = minIntervalMs * 1_000_000L;
    }

    /** 내 차례가 될 때까지 기다림 */
    public synchronized void acquire() {
        long now = System.nanoTime();
        long wait = nextAllowedAt - now;
        if (wait > 0) {
            try {
                Thread.sleep(wait / 1_000_000L, (int) (wait % 1_000_000L));
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
                throw new KisApiException("INTERRUPTED", "기다리는 중 중단됨");
            }
        }
        nextAllowedAt = Math.max(now, nextAllowedAt) + minIntervalNanos;
    }
}

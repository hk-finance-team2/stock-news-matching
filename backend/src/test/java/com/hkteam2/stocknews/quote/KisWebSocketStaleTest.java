package com.hkteam2.stocknews.quote;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.LocalDateTime;

import org.junit.jupiter.api.Test;

/**
 * 반쯤 죽은 웹소켓 찾기 (2026-11-10): 11/10 13:06 다시 접속·구독 성공 뒤 13:07:48 부터 메시지가 끊겼는데 상태는 "연결됨"이었음.
 * 장중·구독 중·60초 넘게 무소식이면 다시 접속해야 함. 장 밖은 조용한 게 정상
 */
class KisWebSocketStaleTest {

    /** 2026-11-10 (화) */
    private static LocalDateTime tue(int h, int m, int s) {
        return LocalDateTime.of(2026, 11, 10, h, m, s);
    }

    @Test
    void 장중에_60초_넘게_메시지가_없으면_죽은_연결() {
        LocalDateTime connected = tue(13, 6, 35);
        LocalDateTime last = tue(13, 7, 48);
        assertThat(KisWebSocketClient.stale(tue(13, 8, 48), connected, last, true)).isFalse();   // 딱 60초는 아직
        assertThat(KisWebSocketClient.stale(tue(13, 8, 49), connected, last, true)).isTrue();
        assertThat(KisWebSocketClient.stale(tue(15, 19, 0), connected, last, true)).isTrue();    // 11/10 실제 상황
    }

    @Test
    void 접속_뒤_아무것도_안_왔으면_접속_시각부터_잰다() {
        LocalDateTime connected = tue(10, 0, 0);
        assertThat(KisWebSocketClient.stale(tue(10, 0, 50), connected, null, true)).isFalse();
        assertThat(KisWebSocketClient.stale(tue(10, 1, 1), connected, null, true)).isTrue();
        // 예전 연결의 마지막 메시지는 새 연결과 상관없음
        assertThat(KisWebSocketClient.stale(tue(10, 0, 50), connected, tue(9, 30, 0), true)).isFalse();
    }

    @Test
    void 장_밖이나_구독이_없거나_끊긴_상태면_보지_않는다() {
        LocalDateTime connected = tue(8, 0, 0);
        assertThat(KisWebSocketClient.stale(tue(8, 59, 0), connected, null, true)).isFalse();    // 장 전
        assertThat(KisWebSocketClient.stale(tue(15, 31, 0), tue(15, 0, 0), null, true)).isFalse(); // 장 뒤
        LocalDateTime saturday = LocalDateTime.of(2026, 11, 14, 11, 0);
        assertThat(KisWebSocketClient.stale(saturday, saturday.minusHours(1), null, true)).isFalse();
        assertThat(KisWebSocketClient.stale(tue(11, 0, 0), tue(10, 0, 0), null, false)).isFalse(); // 구독 없음
        assertThat(KisWebSocketClient.stale(tue(11, 0, 0), null, null, true)).isFalse();          // 끊긴 상태 (다시 접속은 따로)
    }
}

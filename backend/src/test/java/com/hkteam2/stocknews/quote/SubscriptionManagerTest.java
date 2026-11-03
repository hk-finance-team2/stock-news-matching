package com.hkteam2.stocknews.quote;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;

/**
 * 생중계 자리 규칙 (KIS에 실제로 접속하지 않음: 웹소켓이 연결 전이라 등록 메시지는 보내지 않고 자리 계산만 확인)
 * 자리 3개 = 고정(삼성전자) 1 + 돌려쓰기 2
 */
class SubscriptionManagerTest {

    private SubscriptionManager manager() {
        KisProperties props = new KisProperties("real", "test-key", "test-secret", "build/tmp/kis", "005930", 3);
        KisWebSocketClient ws = new KisWebSocketClient(props, null, null, null);
        return new SubscriptionManager(ws, props);
    }

    @Test
    void 보는_종목에_자리를_주고_다_차면_대기() {
        SubscriptionManager m = manager();
        assertThat(m.activeCodes()).containsExactly("005930");   // 고정 자리

        m.watch("000660");
        m.watch("035420");
        assertThat(m.activeCodes()).containsExactly("005930", "000660", "035420");

        m.watch("005380");   // 자리 3개 다 참, 쉬는 자리 없음 → REST로 대신
        assertThat(m.activeCodes()).doesNotContain("005380");
        assertThat(m.waitingCodes()).containsExactly("005380");
    }

    @Test
    void 아무도_안_보는_자리는_새로_보는_종목에_넘겨준다() {
        SubscriptionManager m = manager();
        m.watch("000660");
        m.watch("035420");
        m.unwatch("000660");   // SK하이닉스를 아무도 안 봄 (자리는 60초 동안 유지)
        assertThat(m.activeCodes()).contains("000660");

        m.watch("005380");     // 새 종목 → 쉬고 있던 SK하이닉스 자리를 넘겨받음
        assertThat(m.activeCodes()).containsExactly("005930", "035420", "005380");
        assertThat(m.waitingCodes()).isEmpty();
    }

    @Test
    void 고정_자리는_아무도_안_봐도_유지() {
        SubscriptionManager m = manager();
        m.watch("005930");
        m.unwatch("005930");
        m.watch("000660");
        m.watch("035420");
        m.watch("005380");     // 고정(삼성전자)은 넘겨주지 않음
        assertThat(m.activeCodes()).contains("005930");
        assertThat(m.waitingCodes()).containsExactly("005380");
    }

    @Test
    void 같은_종목을_여러_명이_보면_다_떠나야_쉬는_자리() {
        SubscriptionManager m = manager();
        m.watch("000660");
        m.watch("000660");
        m.watch("035420");
        m.unwatch("000660");   // 아직 1명 남음
        m.watch("005380");     // 넘겨줄 쉬는 자리 없음
        assertThat(m.viewers()).containsEntry("000660", 1);
        assertThat(m.waitingCodes()).containsExactly("005380");
    }
}

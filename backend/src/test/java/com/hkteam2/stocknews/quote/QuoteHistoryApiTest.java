package com.hkteam2.stocknews.quote;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

import com.hkteam2.stocknews.support.ApiTestSupport;

/**
 * 녹화본 API (다시 볼 날·수집 점검). DB만 읽으므로 KIS 스위치가 꺼진 테스트에서도 동작해야 함
 * 다시 보기 재생 자체(SSE)는 브라우저에서 확인 (자동 테스트는 잘못된 값 거절만)
 */
class QuoteHistoryApiTest extends ApiTestSupport {

    private static final LocalDate DAY = LocalDate.of(2026, 1, 5);   // 실제 녹화와 겹치지 않는 날

    @Autowired
    QuoteMapper mapper;

    private static RealtimeTick tick(int second, long volume, long accVolume) {
        LocalDateTime at = DAY.atTime(9, 0, second);
        return new RealtimeTick("000660", DAY, at, 1_400_000, "5", -50_000, new BigDecimal("-3.45"),
                1_420_000, 1_430_000, 1_390_000, volume, accVolume, 0, "1", at.plusNanos(300_000_000));
    }

    @Test
    void 녹화된_날과_수집_점검() throws Exception {
        // 누적 거래량 1000 → 1030: 실제 거래량 = 1030 − 1000 + 첫 체결량 10 = 40
        // 저장한 체결량 = 10 + 5 + 25 = 40 → 100% (빠진 것 없음)
        mapper.insertTicks(List.of(tick(1, 10, 1000), tick(2, 5, 1005), tick(4, 25, 1030)));

        mvc.perform(get("/api/quotes/000660/recordings"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.items[?(@.date == '2026-01-05')].tickCount").value(3));

        mvc.perform(get("/api/quotes/check").param("date", "2026-01-05"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.items[0].stockCode").value("000660"))
                .andExpect(jsonPath("$.items[0].expectedVolume").value(40))
                .andExpect(jsonPath("$.items[0].savedVolume").value(40))
                .andExpect(jsonPath("$.items[0].coverageRate").value(100.0))
                .andExpect(jsonPath("$.items[0].avgDelayMs").value(300));
    }

    @Test
    void 중간_체결이_빠지면_비율이_줄어든다() throws Exception {
        // 누적 1005 체결(5주)을 놓침 → 실제 40 중 35만 저장 → 87.5%
        mapper.insertTicks(List.of(tick(1, 10, 1000), tick(4, 25, 1030)));
        mvc.perform(get("/api/quotes/check").param("date", "2026-01-05"))
                .andExpect(jsonPath("$.items[0].missingVolume").value(5))
                .andExpect(jsonPath("$.items[0].coverageRate").value(87.5));
    }

    @Test
    void 다시_보기는_정해진_배속만() throws Exception {
        mvc.perform(get("/api/quotes/005930/replay").param("date", "2026-01-05").param("speed", "7"))
                .andExpect(status().isBadRequest());
        mvc.perform(get("/api/quotes/999999/recordings"))
                .andExpect(status().isNotFound());
    }
}

package com.hkteam2.stocknews.quote;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import org.junit.jupiter.api.Test;

import com.hkteam2.stocknews.support.ApiTestSupport;

/**
 * 시세 API (스위치 꺼짐). 테스트·CI·키 없는 팀원 PC는 항상 이 상태
 * 실제 KIS 호출은 자동 테스트에서 하지 않음 (키 없음, 장 시간·호출 한도에 따라 결과가 달라짐)
 */
class QuoteApiTest extends ApiTestSupport {

    @Test
    void 시세가_꺼져_있으면_503_QUOTE_DISABLED() throws Exception {
        for (String url : new String[] {"/api/quotes/status", "/api/quotes/stream?codes=005930","/api/quotes/005930", "/api/quotes?codes=005930,000660",
                "/api/quotes/005930/chart?unit=minute", "/api/quotes/005930/chart?unit=5m&date=2026-10-30",
                "/api/quotes/005930/chart?unit=week", "/api/quotes/005930/chart?unit=day&to=2025-10-31", "/api/quotes/005930/ticks",
                "/api/quotes/005930/big-moves"}) {
            mvc.perform(get(url))
                    .andExpect(status().isServiceUnavailable())
                    .andExpect(jsonPath("$.code").value("QUOTE_DISABLED"));
        }
    }

    @Test
    void 요청_값이_틀리면_400_없는_종목은_404() throws Exception {
        for (String url : new String[] {"/api/quotes/005930/big-moves?period=2y", "/api/quotes/005930/big-moves?threshold=2",
                "/api/quotes/005930/big-moves?threshold=31"}) {
            mvc.perform(get(url)).andExpect(status().isBadRequest()).andExpect(jsonPath("$.code").value("INVALID_REQUEST"));
        }
        // 차트: 모르는 단위, 일·주·월·년봉에 date, 분봉·년봉에 to를 붙이면 400 (시세가 꺼져 있어도 먼저 검사)
        for (String url : new String[] {"/api/quotes/005930/chart?unit=2m", "/api/quotes/005930/chart?unit=day&date=2026-10-30",
                "/api/quotes/005930/chart?unit=5m&to=2026-10-30", "/api/quotes/005930/chart?unit=year&to=2026-10-30"}) {
            mvc.perform(get(url)).andExpect(status().isBadRequest()).andExpect(jsonPath("$.code").value("INVALID_REQUEST"));
        }
        mvc.perform(get("/api/quotes/999999/big-moves"))
                .andExpect(status().isNotFound()).andExpect(jsonPath("$.code").value("STOCK_NOT_FOUND"));
    }
}

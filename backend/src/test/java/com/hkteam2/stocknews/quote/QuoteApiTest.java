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
        for (String url : new String[] {"/api/quotes/status", "/api/quotes/005930", "/api/quotes?codes=005930,000660",
                "/api/quotes/005930/chart?unit=minute", "/api/quotes/005930/ticks"}) {
            mvc.perform(get(url))
                    .andExpect(status().isServiceUnavailable())
                    .andExpect(jsonPath("$.code").value("QUOTE_DISABLED"));
        }
    }
}

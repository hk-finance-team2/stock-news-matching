package com.hkteam2.stocknews.stock;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import org.junit.jupiter.api.Test;
import org.springframework.test.context.TestPropertySource;

import com.hkteam2.stocknews.support.ApiTestSupport;

/**
 * 종합 요약 다시 생성: 내부 토큰(AI_INTERNAL_TOKEN)이 없는 PC·CI. AI 서버를 부르지 않고 503 AI_NOT_CONFIGURED
 * (팀원 PC에 AI 서버가 없어도 다른 화면은 그대로, 이 버튼만 "설정 안 됨")
 */
@TestPropertySource(properties = {"AI_INTERNAL_TOKEN=", "AI_SERVER_URL=http://127.0.0.1:1"})
class SummaryRegenerateOffApiTest extends ApiTestSupport {

    @Test
    void 내부_토큰이_없으면_503_AI_NOT_CONFIGURED() throws Exception {
        String token = tokenOf("regen09");
        mvc.perform(post("/api/stocks/{code}/summary", KIA).header("Authorization", bearer(token)))
                .andExpect(status().isServiceUnavailable())
                .andExpect(jsonPath("$.code").value("AI_NOT_CONFIGURED"));
    }
}

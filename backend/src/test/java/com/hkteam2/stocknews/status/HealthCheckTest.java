package com.hkteam2.stocknews.status;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import org.junit.jupiter.api.Test;

import com.hkteam2.stocknews.support.ApiTestSupport;

/**
 * 헬스체크 (11/12): Docker 가 30초마다 부르는 /actuator/health.
 * - 로그인 없이 UP 이 나와야 함 (DB 연결까지 확인한 결과)
 * - 자세한 내용(DB 종류·디스크 등)은 숨김, health 말고 다른 actuator 주소는 열리지 않아야 함 (env 에는 비밀값이 있음)
 */
class HealthCheckTest extends ApiTestSupport {

    @Test
    void 헬스체크는_로그인_없이_UP_만_알려_준다() throws Exception {
        mvc.perform(get("/actuator/health"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("UP"))
                .andExpect(jsonPath("$.components").doesNotExist());
    }

    @Test
    void health_말고_다른_actuator_주소는_열리지_않는다() throws Exception {
        for (String path : new String[] {"/actuator/env", "/actuator/beans", "/actuator/configprops"}) {
            mvc.perform(get(path)).andExpect(status().isNotFound());
        }
    }
}

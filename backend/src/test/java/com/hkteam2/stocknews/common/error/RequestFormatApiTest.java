package com.hkteam2.stocknews.common.error;

import static org.hamcrest.Matchers.hasSize;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;

import com.hkteam2.stocknews.support.ApiTestSupport;

/** 요청 방식·형식이 틀리면 500 이 아니라 405·415·406 + {code, message}, 아주 큰 page 는 빈 결과 (2026-11-10 QA) */
class RequestFormatApiTest extends ApiTestSupport {

    @Test
    void 없는_요청_방식은_405() throws Exception {
        mvc.perform(put("/api/articles"))
                .andExpect(status().isMethodNotAllowed())
                .andExpect(jsonPath("$.code").value("METHOD_NOT_ALLOWED"));
    }

    @Test
    void JSON_이_아닌_본문은_415() throws Exception {
        mvc.perform(post("/api/auth/login").contentType(MediaType.APPLICATION_FORM_URLENCODED).content("loginId=a&password=b"))
                .andExpect(status().isUnsupportedMediaType())
                .andExpect(jsonPath("$.code").value("UNSUPPORTED_MEDIA_TYPE"));
    }

    @Test
    void JSON_이_아닌_응답을_달라면_406() throws Exception {
        mvc.perform(get("/api/articles").accept(MediaType.APPLICATION_XML))
                .andExpect(status().isNotAcceptable());
    }

    @Test
    void 아주_큰_page_는_빈_결과() throws Exception {
        mvc.perform(get("/api/articles").param("page", "2147483647").param("size", "100"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.items", hasSize(0)));
    }
}

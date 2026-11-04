package com.hkteam2.stocknews.stock;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.io.IOException;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.concurrent.CopyOnWriteArrayList;

import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;

import com.sun.net.httpserver.HttpServer;

import com.hkteam2.stocknews.support.ApiTestSupport;

/**
 * 종합 요약 다시 생성 (F-08): 진짜 AI 서버(LLM 비용) 대신 테스트 안에 띄운 가짜 AI 서버로 확인
 * 가짜 서버는 종목마다 다르게 답함: 기아 = 새로 만듦, 네이버 = 요청 많음(429), 셀트리온 = AI 서버 고장(500)
 */
class SummaryRegenerateApiTest extends ApiTestSupport {

    private static final String TOKEN = "test-internal-token";
    private static final List<String> calls = new CopyOnWriteArrayList<>();
    private static final HttpServer fakeAi = startFakeAi();

    private static HttpServer startFakeAi() {
        try {
            HttpServer server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);   // 0 = 빈 포트 아무거나
            server.createContext("/summaries/", exchange -> {
                String code = exchange.getRequestURI().getPath().replace("/summaries/", "");
                calls.add(code);
                int status;
                String body;
                if (!TOKEN.equals(exchange.getRequestHeaders().getFirst("X-Internal-Token"))) {
                    status = 401;
                    body = "{\"detail\":\"내부 토큰이 맞지 않음\"}";
                } else if (code.equals(NAVER)) {
                    status = 429;
                    body = "{\"detail\":\"요약 서버를 지금 쓸 수 없음\"}";
                } else if (code.equals(CELLTRION)) {
                    status = 500;
                    body = "{\"detail\":\"error\"}";
                } else {
                    status = 200;
                    body = "{\"stockCode\":\"" + code + "\",\"regenerated\":true}";
                }
                byte[] bytes = body.getBytes(StandardCharsets.UTF_8);
                exchange.getResponseHeaders().add("Content-Type", "application/json");
                exchange.sendResponseHeaders(status, bytes.length);
                exchange.getResponseBody().write(bytes);
                exchange.close();
            });
            server.start();
            return server;
        } catch (IOException e) {
            throw new IllegalStateException(e);
        }
    }

    @DynamicPropertySource
    static void aiServer(DynamicPropertyRegistry registry) {
        registry.add("AI_SERVER_URL", () -> "http://127.0.0.1:" + fakeAi.getAddress().getPort());
        registry.add("AI_INTERNAL_TOKEN", () -> TOKEN);
    }

    @AfterAll
    static void stopFakeAi() {
        fakeAi.stop(0);
    }

    @BeforeEach
    void clearCalls() {
        calls.clear();
    }

    @Test
    void 로그인하지_않으면_401() throws Exception {
        mvc.perform(post("/api/stocks/{code}/summary", KIA))
                .andExpect(status().isUnauthorized());
        assertThat(calls).isEmpty();
    }

    @Test
    void 다시_만들고_새로_읽은_요약을_돌려준다() throws Exception {
        String token = tokenOf("regen01");
        mvc.perform(post("/api/stocks/{code}/summary", KIA).header("Authorization", bearer(token)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.regenerated").value(true))
                .andExpect(jsonPath("$.summary.stockCode").value(KIA))
                .andExpect(jsonPath("$.summary.sentiment").exists());
        assertThat(calls).containsExactly(KIA);   // 비밀값을 붙여 한 번 부름
    }

    @Test
    void 없는_종목은_AI_서버를_부르지_않고_404() throws Exception {
        String token = tokenOf("regen02");
        mvc.perform(post("/api/stocks/{code}/summary", "999999").header("Authorization", bearer(token)))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("STOCK_NOT_FOUND"));
        assertThat(calls).isEmpty();
    }

    @Test
    void AI_서버가_바쁘면_429_고장이면_503() throws Exception {
        String token = tokenOf("regen03");
        mvc.perform(post("/api/stocks/{code}/summary", NAVER).header("Authorization", bearer(token)))
                .andExpect(status().isTooManyRequests())
                .andExpect(jsonPath("$.code").value("AI_BUSY"));
        mvc.perform(post("/api/stocks/{code}/summary", CELLTRION).header("Authorization", bearer(token)))
                .andExpect(status().isServiceUnavailable())
                .andExpect(jsonPath("$.code").value("AI_UNAVAILABLE"));
    }
}

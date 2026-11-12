package com.hkteam2.stocknews.stock;

import java.net.http.HttpClient;
import java.time.Duration;
import java.util.Map;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.client.JdkClientHttpRequestFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.client.ResourceAccessException;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientResponseException;

import com.hkteam2.stocknews.common.error.BusinessException;
import com.hkteam2.stocknews.common.error.ErrorCode;

/**
 * AI 서버의 "종목 종합 요약 다시 생성" 부르기 (F-08, B-06). 백엔드와 AI 서버가 직접 주고받는 유일한 API
 *
 * AI 서버(FastAPI, ai/hk_llm/api.py): POST {AI_SERVER_URL}/summaries/{stockCode}, 헤더 X-Internal-Token
 * - 브라우저는 AI 서버를 직접 부르지 않음 (비밀값이 화면에 드러나면 누구나 LLM 비용을 쓸 수 있어서)
 * - LLM 이 느릴 수 있어 최대 30초 기다림. 그보다 길거나 AI 서버가 꺼져 있으면 503 (기존 요약은 그대로)
 * - 같은 종목은 AI 서버가 10분에 한 번만 새로 만듦 → 그 안에 또 부르면 regenerated=false
 */
@Component
public class AiSummaryClient {

    private static final Logger log = LoggerFactory.getLogger(AiSummaryClient.class);

    private final RestClient restClient;
    private final String baseUrl;
    private final String token;

    public AiSummaryClient(@Value("${AI_SERVER_URL:http://localhost:8000}") String baseUrl,
                           @Value("${AI_INTERNAL_TOKEN:}") String token) {
        // HTTP/1.1 고정: 기본(HTTP/2 시도)은 평문 연결에 'Upgrade: h2c' 를 붙여 AI 서버(uvicorn)가 요청마다
        // "Unsupported upgrade request" 경고를 남김 (11/12 QA). 같은 Docker 망 안의 짧은 요청이라 HTTP/2 이득도 없음
        HttpClient http = HttpClient.newBuilder().version(HttpClient.Version.HTTP_1_1)
                .connectTimeout(Duration.ofSeconds(3)).build();
        JdkClientHttpRequestFactory factory = new JdkClientHttpRequestFactory(http);
        factory.setReadTimeout(Duration.ofSeconds(30));
        this.restClient = RestClient.builder().requestFactory(factory).build();
        this.baseUrl = baseUrl.replaceAll("/+$", "");
        this.token = token;
    }

    /** 오늘 요약을 새로 만들라고 요청. 돌려주는 값 = 정말 새로 만들었나 (10분 안 재요청·오늘 기사 없음이면 false) */
    public boolean regenerate(String stockCode) {
        if (token == null || token.isBlank()) {
            throw new BusinessException(ErrorCode.AI_NOT_CONFIGURED);
        }
        try {
            Map<?, ?> body = restClient.post()
                    .uri(baseUrl + "/summaries/{code}", stockCode)
                    .header("X-Internal-Token", token)
                    .retrieve()
                    .body(Map.class);
            return body != null && Boolean.TRUE.equals(body.get("regenerated"));
        } catch (RestClientResponseException e) {
            int status = e.getStatusCode().value();
            if (status == 429) {
                throw new BusinessException(ErrorCode.AI_BUSY);
            }
            if (status == 401 || status == 403) {
                log.error("AI 서버가 내부 토큰을 거절함: 백엔드와 AI 서버의 AI_INTERNAL_TOKEN 이 같은지 확인");
                throw new BusinessException(ErrorCode.AI_NOT_CONFIGURED);
            }
            log.warn("AI 서버 오류 {} ({})", status, stockCode);
            throw new BusinessException(ErrorCode.AI_UNAVAILABLE);
        } catch (ResourceAccessException e) {   // 연결 안 됨·30초 넘음
            log.warn("AI 서버에 연결하지 못함 ({}): {}", baseUrl, e.getMessage());
            throw new BusinessException(ErrorCode.AI_UNAVAILABLE);
        }
    }
}

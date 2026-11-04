package com.hkteam2.stocknews.quote;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.client.ExpectedCount.once;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.requestTo;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withException;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withSuccess;

import java.net.ConnectException;
import java.net.http.HttpConnectTimeoutException;
import java.net.http.HttpTimeoutException;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.test.web.client.MockRestServiceServer;
import org.springframework.web.client.ResourceAccessException;
import org.springframework.web.client.RestClient;

/**
 * KIS 호출 다시 시도 규칙 (실제 KIS 대신 가짜 서버, 네트워크 없음)
 * 연결 실패는 1번만 다시, 응답이 느리면 다시 안 함: 모든 호출이 한 줄로 서서 느린 KIS를 또 기다리면 다른 종목도 밀림
 */
class KisRestClientRetryTest {

    private static final String BASE = "http://kis.test";
    private static final String PRICE_URL = BASE + "/uapi/domestic-stock/v1/quotations/inquire-price"
            + "?FID_COND_MRKT_DIV_CODE=J&FID_INPUT_ISCD=005930";
    private static final String PRICE_OK = """
            {"rt_cd":"0","msg_cd":"MCA00000","msg1":"정상처리",
             "output":{"stck_prpr":"216750","prdy_vrss":"-2750","prdy_vrss_sign":"5","prdy_ctrt":"-1.25",
                       "acml_vol":"15000000","stck_oprc":"219000","stck_hgpr":"220000","stck_lwpr":"215500"}}
            """;

    MockRestServiceServer server;
    KisRestClient client;

    @BeforeEach
    void setUp() {
        RestClient.Builder builder = RestClient.builder();
        server = MockRestServiceServer.bindTo(builder).build();
        KisHttp http = mock(KisHttp.class);
        when(http.restClient()).thenReturn(builder.build());
        KisProperties props = mock(KisProperties.class);
        when(props.baseUrl()).thenReturn(BASE);
        KisTokenManager tokens = mock(KisTokenManager.class);
        when(tokens.accessToken()).thenReturn("test-token");
        client = new KisRestClient(props, tokens, new KisRateLimiter(0), http);
    }

    @Test
    void 연결이_한_번_끊기면_한_번만_다시_해서_받는다() {
        server.expect(once(), requestTo(PRICE_URL)).andRespond(withException(new ConnectException("Connection refused")));
        server.expect(once(), requestTo(PRICE_URL)).andRespond(withSuccess(PRICE_OK, MediaType.APPLICATION_JSON));

        assertThat(client.inquirePrice("005930").price()).isEqualTo(216750);
        server.verify();
    }

    @Test
    void 연결이_두_번_연속_안_되면_더_기다리지_않고_실패() {
        server.expect(once(), requestTo(PRICE_URL)).andRespond(withException(new HttpConnectTimeoutException("connect timed out")));
        server.expect(once(), requestTo(PRICE_URL)).andRespond(withException(new ConnectException("Connection refused")));

        assertThatThrownBy(() -> client.inquirePrice("005930")).isInstanceOf(ResourceAccessException.class);
        server.verify();   // 정확히 2번만 물어봄 (예전에는 3번)
    }

    @Test
    void 응답이_느리면_다시_하지_않는다() {
        server.expect(once(), requestTo(PRICE_URL)).andRespond(withException(new HttpTimeoutException("request timed out")));

        assertThatThrownBy(() -> client.inquirePrice("005930")).isInstanceOf(ResourceAccessException.class);
        server.verify();   // 1번만 물어봄 → 줄 서 있는 다른 종목이 오래 밀리지 않음
    }

    @Test
    void 느린_응답과_연결_실패를_구분한다() {
        assertThat(KisRestClient.isSlowResponse(new ResourceAccessException("x", new HttpTimeoutException("request timed out")))).isTrue();
        assertThat(KisRestClient.isSlowResponse(new ResourceAccessException("x", new HttpConnectTimeoutException("connect timed out")))).isFalse();
        assertThat(KisRestClient.isSlowResponse(new ResourceAccessException("x", new ConnectException("refused")))).isFalse();
    }
}

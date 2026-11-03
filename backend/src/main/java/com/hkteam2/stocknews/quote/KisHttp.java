package com.hkteam2.stocknews.quote;

import java.net.http.HttpClient;
import java.time.Duration;

import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.http.client.JdkClientHttpRequestFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;

/**
 * KIS에 HTTP로 묻는 도구 하나 (Spring 기본 RestClient, 라이브러리 추가 없음)
 * KIS가 느리거나 응답이 없을 때 서버가 오래 붙잡히지 않게 시간 제한을 둠
 */
@Component
@ConditionalOnProperty(name = "KIS_ENABLED", havingValue = "true")
public class KisHttp {

    private final RestClient restClient;

    public KisHttp() {
        HttpClient http = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(5)).build();
        JdkClientHttpRequestFactory factory = new JdkClientHttpRequestFactory(http);
        factory.setReadTimeout(Duration.ofSeconds(10));
        this.restClient = RestClient.builder().requestFactory(factory).build();
    }

    RestClient restClient() {
        return restClient;
    }
}

package com.hkteam2.stocknews.quote;

import java.math.BigDecimal;

import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.http.HttpHeaders;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;

import com.fasterxml.jackson.annotation.JsonProperty;

/**
 * KIS 시세 조회 (REST). 조회 API만 둠 — 주문·계좌 API는 이 프로젝트에 넣지 않음
 * 주소·tr_id는 KIS 공식 예제 domestic_stock_functions.py 기준
 *   주식현재가 시세: GET /uapi/domestic-stock/v1/quotations/inquire-price, tr_id FHKST01010100 (실전·모의 같음)
 * 응답의 rt_cd 가 "0"이 아니면 실패 (msg_cd, msg1 에 이유)
 */
@Component
@ConditionalOnProperty(name = "KIS_ENABLED", havingValue = "true")
public class KisRestClient {

    private final KisProperties props;
    private final KisTokenManager tokens;
    private final RestClient restClient;

    /** inquire-price 응답 (필요한 칸만, 숫자도 문자열로 옴) */
    record PriceResponse(@JsonProperty("rt_cd") String rtCd,
                         @JsonProperty("msg_cd") String msgCd,
                         @JsonProperty("msg1") String msg1,
                         @JsonProperty("output") PriceOutput output) {
    }

    record PriceOutput(@JsonProperty("stck_prpr") String price,
                       @JsonProperty("prdy_vrss") String changeAmount,
                       @JsonProperty("prdy_vrss_sign") String changeSign,
                       @JsonProperty("prdy_ctrt") String changeRate,
                       @JsonProperty("acml_vol") String accVolume,
                       @JsonProperty("stck_oprc") String open,
                       @JsonProperty("stck_hgpr") String high,
                       @JsonProperty("stck_lwpr") String low) {
    }

    public KisRestClient(KisProperties props, KisTokenManager tokens, KisHttp http) {
        this.props = props;
        this.tokens = tokens;
        this.restClient = http.restClient();
    }

    /** 종목 현재가. stockCode는 6자리 (예: 005930) */
    public KisPrice inquirePrice(String stockCode) {
        PriceResponse res = restClient.get()
                .uri(props.baseUrl() + "/uapi/domestic-stock/v1/quotations/inquire-price"
                        + "?FID_COND_MRKT_DIV_CODE={market}&FID_INPUT_ISCD={code}", "J", stockCode)   // J = 주식
                .headers(h -> commonHeaders(h, "FHKST01010100"))
                .retrieve()
                .body(PriceResponse.class);
        if (res == null || !"0".equals(res.rtCd()) || res.output() == null) {
            throw new KisApiException(res == null ? "EMPTY" : res.msgCd(), res == null ? "응답 없음" : res.msg1());
        }
        PriceOutput o = res.output();
        return new KisPrice(stockCode, toLong(o.price()), toLong(o.changeAmount()), o.changeSign(),
                new BigDecimal(o.changeRate().strip()), toLong(o.accVolume()),
                toLong(o.open()), toLong(o.high()), toLong(o.low()));
    }

    /** 모든 시세 조회에 붙는 머리말. custtype P = 개인 */
    private void commonHeaders(HttpHeaders h, String trId) {
        h.setBearerAuth(tokens.accessToken());
        h.set("appkey", props.appKey());
        h.set("appsecret", props.appSecret());
        h.set("tr_id", trId);
        h.set("custtype", "P");
    }

    private static long toLong(String s) {
        return s == null || s.isBlank() ? 0 : Long.parseLong(s.strip());
    }
}

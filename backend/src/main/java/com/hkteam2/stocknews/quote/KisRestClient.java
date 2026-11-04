package com.hkteam2.stocknews.quote;

import java.math.BigDecimal;
import java.net.SocketTimeoutException;
import java.net.http.HttpConnectTimeoutException;
import java.net.http.HttpTimeoutException;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.http.HttpHeaders;
import org.springframework.stereotype.Component;
import org.springframework.web.client.ResourceAccessException;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientResponseException;
import org.springframework.web.util.UriComponentsBuilder;

import com.fasterxml.jackson.annotation.JsonProperty;

/**
 * KIS 시세 조회 (REST). 조회 API만 둠 — 주문·계좌 API는 이 프로젝트에 넣지 않음
 *
 * 주소·tr_id·입력 칸: KIS 공식 예제 domestic_stock_functions.py, 응답 칸 이름: 2026-11-03 실제 응답으로 확인
 * | 조회 | 주소 | tr_id | 한 번에 |
 * | 현재가 | /quotations/inquire-price | FHKST01010100 | 1 |
 * | 일별 분봉 | /quotations/inquire-time-dailychartprice | FHKST03010230 | 120분 (실전 전용, 지난 날도 됨, 최대 1년 보관) |
 * | 일·주·월·년봉 | /quotations/inquire-daily-itemchartprice | FHKST03010100 | 100개 |
 * | 최근 체결 | /quotations/inquire-ccnl | FHKST01010300 | 30건 |
 * 모든 응답: rt_cd "0"이면 성공, 아니면 msg_cd·msg1 에 이유. 숫자도 문자열로 옴
 * 모든 호출은 KisRateLimiter 줄을 서고, EGW00201(초당 초과)이면 1초 쉬고 2번까지, 연결 실패면 1번 다시 시도 (get 참고)
 */
@Component
@ConditionalOnProperty(name = "KIS_ENABLED", havingValue = "true")
public class KisRestClient {

    private static final String BASE_PATH = "/uapi/domestic-stock/v1/quotations";
    private static final String RATE_LIMIT = "EGW00201";
    private static final int MAX_ATTEMPTS = 3;
    /** 연결 실패는 1번만 다시 (일시 끊김 대비). 응답이 느린 경우는 다시 안 함 → get() 설명 */
    private static final int MAX_NETWORK_RETRIES = 1;
    private static final DateTimeFormatter YMD = DateTimeFormatter.BASIC_ISO_DATE;
    private static final DateTimeFormatter HMS = DateTimeFormatter.ofPattern("HHmmss");

    private final KisProperties props;
    private final KisTokenManager tokens;
    private final KisRateLimiter limiter;
    private final RestClient restClient;

    // ----- KIS 응답 모양 (필요한 칸만) -----

    record KisError(@JsonProperty("rt_cd") String rtCd, @JsonProperty("msg_cd") String msgCd,
                    @JsonProperty("msg1") String msg1) {
    }

    record PriceResponse(@JsonProperty("rt_cd") String rtCd, @JsonProperty("msg_cd") String msgCd,
                         @JsonProperty("msg1") String msg1, @JsonProperty("output") PriceOutput output) {
    }

    record PriceOutput(@JsonProperty("stck_prpr") String price, @JsonProperty("prdy_vrss") String changeAmount,
                       @JsonProperty("prdy_vrss_sign") String changeSign, @JsonProperty("prdy_ctrt") String changeRate,
                       @JsonProperty("acml_vol") String accVolume, @JsonProperty("stck_oprc") String open,
                       @JsonProperty("stck_hgpr") String high, @JsonProperty("stck_lwpr") String low) {
    }

    record MinuteResponse(@JsonProperty("rt_cd") String rtCd, @JsonProperty("msg_cd") String msgCd,
                          @JsonProperty("msg1") String msg1, @JsonProperty("output2") List<MinuteRow> rows) {
    }

    record MinuteRow(@JsonProperty("stck_bsop_date") String date, @JsonProperty("stck_cntg_hour") String hour,
                     @JsonProperty("stck_oprc") String open, @JsonProperty("stck_hgpr") String high,
                     @JsonProperty("stck_lwpr") String low, @JsonProperty("stck_prpr") String close,
                     @JsonProperty("cntg_vol") String volume) {
    }

    record DailyResponse(@JsonProperty("rt_cd") String rtCd, @JsonProperty("msg_cd") String msgCd,
                         @JsonProperty("msg1") String msg1, @JsonProperty("output2") List<DailyRow> rows) {
    }

    record DailyRow(@JsonProperty("stck_bsop_date") String date, @JsonProperty("stck_oprc") String open,
                    @JsonProperty("stck_hgpr") String high, @JsonProperty("stck_lwpr") String low,
                    @JsonProperty("stck_clpr") String close, @JsonProperty("acml_vol") String volume) {
    }

    record CcnlResponse(@JsonProperty("rt_cd") String rtCd, @JsonProperty("msg_cd") String msgCd,
                        @JsonProperty("msg1") String msg1, @JsonProperty("output") List<CcnlRow> rows) {
    }

    record CcnlRow(@JsonProperty("stck_cntg_hour") String hour, @JsonProperty("stck_prpr") String price,
                   @JsonProperty("prdy_vrss") String changeAmount, @JsonProperty("prdy_vrss_sign") String changeSign,
                   @JsonProperty("prdy_ctrt") String changeRate, @JsonProperty("cntg_vol") String volume,
                   @JsonProperty("tday_rltv") String strength) {
    }

    public KisRestClient(KisProperties props, KisTokenManager tokens, KisRateLimiter limiter, KisHttp http) {
        this.props = props;
        this.tokens = tokens;
        this.limiter = limiter;
        this.restClient = http.restClient();
    }

    // ----- 조회 -----

    /** 종목 현재가. stockCode는 6자리 (예: 005930) */
    public KisPrice inquirePrice(String stockCode) {
        PriceResponse res = get("/inquire-price", "FHKST01010100", stockParams(stockCode), PriceResponse.class);
        check(res == null ? null : res.rtCd(), res == null ? null : res.msgCd(), res == null ? null : res.msg1());
        PriceOutput o = res.output();
        return new KisPrice(stockCode, toLong(o.price()), toLong(o.changeAmount()), o.changeSign(),
                toDecimal(o.changeRate()), toLong(o.accVolume()), toLong(o.open()), toLong(o.high()), toLong(o.low()));
    }

    /**
     * 그날 분봉 한 쪽 (date의 until 시각부터 거꾸로 최대 120분). 최신이 앞에 옴
     * 응답 칸은 당일 분봉(FHKST03010200)과 같음 (2026-11-03 실제 응답으로 확인)
     * 주의: 장 시작 앞으로 넘어가면 전날 시간외 봉(예: 18:10)까지 섞여 옴 → 부르는 쪽에서 날짜·장 시간으로 거름
     */
    public List<KisCandle> inquireMinuteCandles(String stockCode, LocalDate date, LocalTime until) {
        Map<String, String> params = stockParams(stockCode);
        params.put("FID_INPUT_HOUR_1", until.format(HMS));
        params.put("FID_INPUT_DATE_1", date.format(YMD));
        params.put("FID_PW_DATA_INCU_YN", "Y");   // 과거 데이터 포함
        params.put("FID_FAKE_TICK_INCU_YN", "");   // 허봉(거래 없는 분) 포함 여부: 기본값
        MinuteResponse res = get("/inquire-time-dailychartprice", "FHKST03010230", params, MinuteResponse.class);
        check(res == null ? null : res.rtCd(), res == null ? null : res.msgCd(), res == null ? null : res.msg1());
        List<KisCandle> out = new ArrayList<>();
        for (MinuteRow r : nullToEmpty(res.rows())) {
            if (r.date() == null || r.hour() == null || r.date().isBlank()) {
                continue;
            }
            out.add(new KisCandle(LocalDate.parse(r.date(), YMD).atTime(LocalTime.parse(r.hour(), HMS)),
                    toLong(r.open()), toLong(r.high()), toLong(r.low()), toLong(r.close()), toLong(r.volume())));
        }
        return out;
    }

    /** 일봉 (from~to, 최대 100개). 수정주가(액면분할 등을 반영한 가격). 최신이 앞에 옴 */
    public List<KisCandle> inquireDailyCandles(String stockCode, LocalDate from, LocalDate to) {
        return inquirePeriodCandles(stockCode, from, to, "D");
    }

    /** 기간별 봉 (from~to, 최대 100개). periodCode D 일봉, W 주봉, M 월봉, Y 년봉. 수정주가. 최신이 앞에 옴 */
    public List<KisCandle> inquirePeriodCandles(String stockCode, LocalDate from, LocalDate to, String periodCode) {
        Map<String, String> params = stockParams(stockCode);
        params.put("FID_INPUT_DATE_1", from.format(YMD));
        params.put("FID_INPUT_DATE_2", to.format(YMD));
        params.put("FID_PERIOD_DIV_CODE", periodCode);
        params.put("FID_ORG_ADJ_PRC", "0");   // 0 수정주가, 1 원주가
        DailyResponse res = get("/inquire-daily-itemchartprice", "FHKST03010100", params, DailyResponse.class);
        check(res == null ? null : res.rtCd(), res == null ? null : res.msgCd(), res == null ? null : res.msg1());
        List<KisCandle> out = new ArrayList<>();
        for (DailyRow r : nullToEmpty(res.rows())) {
            if (r.date() == null || r.date().isBlank()) {
                continue;
            }
            out.add(new KisCandle(LocalDate.parse(r.date(), YMD).atStartOfDay(),
                    toLong(r.open()), toLong(r.high()), toLong(r.low()), toLong(r.close()), toLong(r.volume())));
        }
        return out;
    }

    /** 최근 체결 (최대 30건, 최신이 앞에) */
    public List<KisTick> inquireRecentTicks(String stockCode) {
        CcnlResponse res = get("/inquire-ccnl", "FHKST01010300", stockParams(stockCode), CcnlResponse.class);
        check(res == null ? null : res.rtCd(), res == null ? null : res.msgCd(), res == null ? null : res.msg1());
        List<KisTick> out = new ArrayList<>();
        for (CcnlRow r : nullToEmpty(res.rows())) {
            if (r.hour() == null || r.hour().isBlank()) {
                continue;
            }
            out.add(new KisTick(LocalTime.parse(r.hour(), HMS), toLong(r.price()), toLong(r.changeAmount()),
                    r.changeSign(), toDecimal(r.changeRate()), toLong(r.volume()), toDecimal(r.strength())));
        }
        return out;
    }

    // ----- 공통 -----

    /**
     * 줄 서기 → 요청 → 실패하면 경우에 따라 다시
     * - 초당 초과(EGW00201): 1초 쉬고 최대 MAX_ATTEMPTS번
     * - 연결 실패(연결 거부·주소 못 찾음·연결 시간 초과처럼 금방 끝나는 것): 1초 쉬고 1번만 다시 (일시 끊김 대비)
     * - 응답이 느림(연결은 됐는데 읽기 시간 초과): 다시 안 함. 모든 호출이 한 줄로 서므로 느린 KIS를 또 기다리면
     *   뒤에 선 다른 종목 요청까지 밀림 (전에는 최악 약 32초 → 지금 약 16초 이하)
     */
    private <T> T get(String path, String trId, Map<String, String> params, Class<T> type) {
        UriComponentsBuilder uri = UriComponentsBuilder.fromUriString(props.baseUrl() + BASE_PATH + path);
        params.forEach(uri::queryParam);
        int networkRetries = 0;
        for (int attempt = 1; ; attempt++) {
            limiter.acquire();
            try {
                return restClient.get()
                        .uri(uri.build().toUri())
                        .headers(h -> commonHeaders(h, trId))
                        .retrieve()
                        .body(type);
            } catch (RestClientResponseException e) {
                KisError err = e.getResponseBodyAs(KisError.class);
                String code = err != null && err.msgCd() != null ? err.msgCd() : "HTTP_" + e.getStatusCode().value();
                if (RATE_LIMIT.equals(code) && attempt < MAX_ATTEMPTS) {
                    pause(1000);
                    continue;
                }
                throw new KisApiException(code, err != null && err.msg1() != null ? err.msg1() : "KIS 응답 오류");
            } catch (ResourceAccessException e) {
                if (networkRetries < MAX_NETWORK_RETRIES && !isSlowResponse(e)) {
                    networkRetries++;
                    pause(1000);
                    continue;
                }
                throw e;   // QuoteExceptionHandler가 502 QUOTE_UNREACHABLE로
            }
        }
    }

    /** 연결은 됐는데 응답이 시간 안에 안 온 경우 (연결 시간 초과는 금방 끝나서 여기에 넣지 않음) */
    static boolean isSlowResponse(Throwable e) {
        for (Throwable t = e; t != null; t = t.getCause()) {
            if (t instanceof HttpConnectTimeoutException) {
                return false;
            }
            if (t instanceof HttpTimeoutException || t instanceof SocketTimeoutException) {
                return true;
            }
        }
        return false;
    }

    private static void check(String rtCd, String msgCd, String msg1) {
        if (!"0".equals(rtCd)) {
            throw new KisApiException(msgCd == null ? "EMPTY" : msgCd, msg1 == null ? "응답 없음" : msg1);
        }
    }

    /** 모든 시세 조회에 붙는 머리말. custtype P = 개인 */
    private void commonHeaders(HttpHeaders h, String trId) {
        h.setBearerAuth(tokens.accessToken());
        h.set("appkey", props.appKey());
        h.set("appsecret", props.appSecret());
        h.set("tr_id", trId);
        h.set("custtype", "P");
    }

    /** J = 주식(KRX) */
    private static Map<String, String> stockParams(String stockCode) {
        Map<String, String> p = new LinkedHashMap<>();
        p.put("FID_COND_MRKT_DIV_CODE", "J");
        p.put("FID_INPUT_ISCD", stockCode);
        return p;
    }

    private static <T> List<T> nullToEmpty(List<T> list) {
        return list == null ? List.of() : list;
    }

    private static long toLong(String s) {
        return s == null || s.isBlank() ? 0 : Long.parseLong(s.strip());
    }

    private static BigDecimal toDecimal(String s) {
        return s == null || s.isBlank() ? BigDecimal.ZERO : new BigDecimal(s.strip());
    }

    private static void pause(long ms) {
        try {
            Thread.sleep(ms);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
        }
    }
}

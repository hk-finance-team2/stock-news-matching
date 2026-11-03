package com.hkteam2.stocknews.quote;

import java.time.LocalDate;
import java.time.LocalTime;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.Set;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import com.hkteam2.stocknews.common.ListResponse;
import com.hkteam2.stocknews.common.TimeUtils;
import com.hkteam2.stocknews.common.error.BusinessException;
import com.hkteam2.stocknews.common.error.ErrorCode;
import com.hkteam2.stocknews.stock.StockMapper;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;

/**
 * 시세 조회 API (주제 ①②, 1차 범위 밖 확장). 로그인 없이
 * 이 Controller는 시세 스위치가 꺼져 있어도 항상 있음 → 꺼져 있으면 503 QUOTE_DISABLED (화면은 "시세 준비 중")
 * 켜져 있으면(KIS_ENABLED=true) QuoteService가 KIS에 묻고 짧게 캐시
 */
@Tag(name = "시세 (확장)", description = "KIS 현재가·차트·체결. 서버에 KIS_ENABLED=true 일 때만 동작, 아니면 503")
@RestController
@RequestMapping("/api/quotes")
public class QuoteController {

    private static final Logger log = LoggerFactory.getLogger(QuoteController.class);
    private static final int MAX_CODES = 10;
    private static final int MAX_STREAM_CODES = 5;

    private static final Set<Integer> SPEEDS = Set.of(1, 5, 10, 30, 60);

    private final ObjectProvider<QuoteService> quoteService;
    private final ObjectProvider<QuoteStreamHub> streamHub;
    private final QuoteHistoryService history;
    private final StockMapper stockMapper;

    public QuoteController(ObjectProvider<QuoteService> quoteService, ObjectProvider<QuoteStreamHub> streamHub,
                           QuoteHistoryService history, StockMapper stockMapper) {
        this.quoteService = quoteService;
        this.streamHub = streamHub;
        this.history = history;
        this.stockMapper = stockMapper;
    }

    // ----- 녹화본 (DB만 읽음 → KIS 스위치가 꺼져 있어도 동작) -----

    @Operation(summary = "다시 볼 수 있는 날", description = "이 종목을 생중계로 받아 녹화한 날짜·체결 수 (최근 날짜부터)")
    @GetMapping("/{stockCode}/recordings")
    public ListResponse<RecordingResponse> getRecordings(@PathVariable String stockCode) {
        return ListResponse.of(history.recordings(checkStock(stockCode)));
    }

    @Operation(summary = "다시 보기 (SSE)",
            description = "녹화된 체결을 date의 from 시각부터 speed배속(1·5·10·30·60)으로 재생. 이벤트 start → replay(체결마다) → end."
                    + " 긴 공백은 최대 5초로 줄임. 동시에 5개까지(넘으면 429 REPLAY_BUSY)")
    @GetMapping("/{stockCode}/replay")
    public SseEmitter replay(@PathVariable String stockCode,
                             @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date,
                             @RequestParam(defaultValue = "09:00") @DateTimeFormat(pattern = "HH:mm") LocalTime from,
                             @RequestParam(defaultValue = "10") int speed) {
        if (!SPEEDS.contains(speed)) {
            throw new BusinessException(ErrorCode.INVALID_REQUEST);
        }
        return history.replay(checkStock(stockCode), date, from, speed);
    }

    @Operation(summary = "수집 점검 (빠진 체결 비율·지연)",
            description = "date(없으면 오늘)에 저장한 체결량을 KIS 누적 거래량과 비교. coverageRate 100%면 빠진 것 없음."
                    + " 서버가 꺼져 있던 시간도 빠진 것으로 셈")
    @GetMapping("/check")
    public CollectCheckResponse check(@RequestParam(required = false)
                                      @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date) {
        return history.check(date != null ? date : LocalDate.now(TimeUtils.KST));
    }

    @Operation(summary = "실시간 방송 (SSE)",
            description = "codes=005930,000660 (최대 5개). 연결을 열어 두면 서버가 이벤트를 밀어 줌."
                    + " quote: 현재가 (QuoteResponse, 연결하자마자 한 번 + 바뀔 때마다), tick: 새 체결 (생중계 종목만)."
                    + " 브라우저 EventSource로 듣기. Swagger에서는 끝나지 않는 요청으로 보임")
    @GetMapping("/stream")
    public SseEmitter stream(@RequestParam String codes) {
        QuoteStreamHub hub = streamHub.getIfAvailable();
        if (hub == null) {
            throw new QuoteDisabledException();
        }
        List<String> list = Arrays.stream(codes.split(",")).map(String::strip).filter(s -> !s.isEmpty())
                .distinct().limit(MAX_STREAM_CODES).filter(stockMapper::existsByCode).toList();
        if (list.isEmpty()) {
            throw new BusinessException(ErrorCode.STOCK_NOT_FOUND);
        }
        return hub.subscribe(list);
    }

    @Operation(summary = "실시간 수집 상태", description = "웹소켓 연결, 구독 종목, 받은·저장한·버린 체결 수, 오늘 저장된 체결 수")
    @GetMapping("/status")
    public QuoteStatusResponse getStatus() {
        return service().status();
    }

    @Operation(summary = "현재가 한 종목", description = "실시간으로 받는 종목이면 live=true(DB 현재가), 아니면 KIS 조회 5초 캐시. direction UP/DOWN/FLAT, 하락이면 changeAmount·changeRate 음수")
    @GetMapping("/{stockCode}")
    public QuoteResponse getQuote(@PathVariable String stockCode) {
        return service().price(checkStock(stockCode));
    }

    @Operation(summary = "현재가 여러 종목", description = "codes=005930,000660 (최대 10개). 없는 종목·실패한 종목은 빠짐")
    @GetMapping
    public ListResponse<QuoteResponse> getQuotes(@RequestParam String codes) {
        QuoteService service = service();
        List<String> list = Arrays.stream(codes.split(",")).map(String::strip).filter(s -> !s.isEmpty())
                .distinct().limit(MAX_CODES).toList();
        List<QuoteResponse> out = new ArrayList<>();
        for (String code : list) {
            if (!stockMapper.existsByCode(code)) {
                continue;
            }
            try {
                out.add(service.price(code));
            } catch (KisApiException e) {
                log.warn("시세 조회 실패 {}: {}", code, e.getMessage());   // 한 종목이 실패해도 나머지는 보여 줌
            }
        }
        return ListResponse.of(out);
    }

    @Operation(summary = "차트", description = "unit=minute: 오늘 1분봉 최근 약 2시간 (60초 캐시), unit=day: 일봉 최근 약 100거래일 (10분 캐시). items는 오래된 것부터")
    @GetMapping("/{stockCode}/chart")
    public ChartResponse getChart(@PathVariable String stockCode, @RequestParam(defaultValue = "minute") String unit) {
        QuoteService service = service();
        String code = checkStock(stockCode);
        return switch (unit) {
            case "minute" -> service.minuteChart(code);
            case "day" -> service.dayChart(code);
            default -> throw new BusinessException(ErrorCode.INVALID_REQUEST);
        };
    }

    @Operation(summary = "최근 체결 30건", description = "최신이 앞. 5초 캐시. strength: 체결 강도")
    @GetMapping("/{stockCode}/ticks")
    public ListResponse<TickResponse> getTicks(@PathVariable String stockCode) {
        return ListResponse.of(service().ticks(checkStock(stockCode)));
    }

    private QuoteService service() {
        QuoteService service = quoteService.getIfAvailable();
        if (service == null) {
            throw new QuoteDisabledException();
        }
        return service;
    }

    private String checkStock(String stockCode) {
        if (!stockMapper.existsByCode(stockCode)) {
            throw new BusinessException(ErrorCode.STOCK_NOT_FOUND);
        }
        return stockCode;
    }
}

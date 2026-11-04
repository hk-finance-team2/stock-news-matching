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
    private final BigMoveService bigMoveService;
    private final StockMapper stockMapper;

    public QuoteController(ObjectProvider<QuoteService> quoteService, ObjectProvider<QuoteStreamHub> streamHub,
                           QuoteHistoryService history, BigMoveService bigMoveService, StockMapper stockMapper) {
        this.quoteService = quoteService;
        this.streamHub = streamHub;
        this.history = history;
        this.bigMoveService = bigMoveService;
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

    @Operation(summary = "차트 (봉)",
            description = "unit=1m·5m·10m·30m: date 하루(없으면 오늘)의 09:00~15:30 분봉. KIS 1분봉을 서버가 n분씩 묶음, 최대 1년 전까지"
                    + " (오늘 60초·지난 날 1시간 캐시). unit=day: 최근 1년, week·month: 최근 100개, year: 상장 이후 (10분 캐시)."
                    + " to(day·week·month만): 그 날짜(포함)까지 거꾸로 100개 이내 = 왼쪽으로 끌 때 이어 받기 (1시간 캐시)."
                    + " 옛 값 minute = 1m. items는 오래된 것부터, 수정주가")
    @GetMapping("/{stockCode}/chart")
    public ChartResponse getChart(@PathVariable String stockCode, @RequestParam(defaultValue = "1m") String unit,
                                  @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date,
                                  @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to) {
        ChartUnit u = ChartUnit.of(unit).orElseThrow(() -> new BusinessException(ErrorCode.INVALID_REQUEST));
        if (date != null && !u.isMinute()) {
            throw new BusinessException(ErrorCode.INVALID_REQUEST);   // 날짜는 분봉에서만
        }
        if (to != null && (u.isMinute() || u == ChartUnit.YEAR)) {
            throw new BusinessException(ErrorCode.INVALID_REQUEST);   // 분봉은 date로 하루씩, 년봉은 이미 상장 이후 전체
        }
        QuoteService service = service();
        String code = checkStock(stockCode);
        if (!u.isMinute()) {
            if (to != null && to.isAfter(service.today())) {
                throw new BusinessException(ErrorCode.INVALID_REQUEST);   // 미래
            }
            return service.periodChart(code, u, to);
        }
        LocalDate today = service.today();
        LocalDate day = date != null ? date : today;
        if (day.isAfter(today) || day.isBefore(today.minusDays(QuoteService.MINUTE_HISTORY_DAYS))) {
            throw new BusinessException(ErrorCode.INVALID_REQUEST);   // 미래, 또는 KIS가 보관하지 않는 1년 전
        }
        return service.minuteChart(code, u, day);
    }

    @Operation(summary = "과거 급등·급락 이력 (F-17)",
            description = "일봉으로 하루 등락률이 ±threshold% 이상인 날(최신부터)과 그날 이 종목에 연결된 글(관련도 높은 순 3개, 전체 수)."
                    + " period 3m·6m·1y(기본), threshold 3~30(기본 5). 일봉은 KIS에서 받아 10분 캐시. 글은 작성일 기준, DONE만")
    @GetMapping("/{stockCode}/big-moves")
    public BigMoveResponse getBigMoves(@PathVariable String stockCode,
                                       @RequestParam(defaultValue = "1y") String period,
                                       @RequestParam(defaultValue = "5") int threshold) {
        BigMovePeriod p = BigMovePeriod.of(period).orElseThrow(() -> new BusinessException(ErrorCode.INVALID_REQUEST));
        if (threshold < 3 || threshold > 30) {
            throw new BusinessException(ErrorCode.INVALID_REQUEST);
        }
        return bigMoveService.bigMoves(checkStock(stockCode), p, threshold);
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

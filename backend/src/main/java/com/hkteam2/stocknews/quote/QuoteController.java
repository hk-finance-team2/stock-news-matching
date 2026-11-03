package com.hkteam2.stocknews.quote;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.hkteam2.stocknews.common.ListResponse;
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

    private final ObjectProvider<QuoteService> quoteService;
    private final StockMapper stockMapper;

    public QuoteController(ObjectProvider<QuoteService> quoteService, StockMapper stockMapper) {
        this.quoteService = quoteService;
        this.stockMapper = stockMapper;
    }

    @Operation(summary = "현재가 한 종목", description = "5초 캐시. direction UP/DOWN/FLAT, 하락이면 changeAmount·changeRate 음수")
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

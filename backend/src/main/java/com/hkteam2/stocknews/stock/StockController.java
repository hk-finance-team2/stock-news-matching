package com.hkteam2.stocknews.stock;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.hkteam2.stocknews.common.ListResponse;
import com.hkteam2.stocknews.common.PageQuery;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.tags.Tag;

@Tag(name = "종목", description = "종목 사전 조회")
@RestController
@RequestMapping("/api/stocks")
public class StockController {

    private final StockService stockService;

    public StockController(StockService stockService) {
        this.stockService = stockService;
    }

    @Operation(summary = "종목 검색·목록",
            description = "q가 있으면 종목명(포함)·종목코드(시작)·별칭(포함)으로 검색. 이름이 딱 맞는 것 → 이름이 q로 시작 → 코드 → 나머지 순."
                    + " q가 없으면 전체를 이름순으로. page는 1부터, size 1~100 (기본 20)")
    @GetMapping
    public ListResponse<StockResponse> getStocks(
            @Parameter(description = "검색어 (50자 이하)", example = "삼성") @RequestParam(required = false) String q,
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "" + PageQuery.DEFAULT_SIZE) int size) {
        return stockService.getStocks(q, new PageQuery(page, size));
    }

    @Operation(summary = "오늘의 이슈 종목 순위",
            description = "오늘(한국 시간 0시~지금) 작성된 글에 많이 나온 종목 순. 글 수가 같으면 평균 관련도 높은 순."
                    + " avgRelevance는 %(관련도가 아직 없으면 null). 페이지 없이 위에서 limit개 (1~50, 기본 10)")
    @GetMapping("/issues")
    public ListResponse<StockIssueResponse> getIssues(
            @Parameter(description = "출처: NEWS 또는 SNS (없으면 둘 다)", example = "NEWS")
            @RequestParam(required = false) String source,
            @Parameter(description = "몇 개까지 (1~50)", example = "10")
            @RequestParam(defaultValue = "10") int limit) {
        return stockService.getIssues(source, limit);
    }

    @Operation(summary = "종목의 오늘 종합 요약·감성 비율",
            description = "newsSummary·snsSummary는 AI가 1시간마다 만든 오늘 요약 (아직 없으면 null)."
                    + " sentiment는 오늘(한국 시간 0시~지금) 이 종목이 나온 글을 지금 센 것. %는 합이 100."
                    + " source가 없으면 뉴스·SNS 합계, NEWS/SNS면 그 출처만. 없는 종목이면 404 STOCK_NOT_FOUND")
    @GetMapping("/{stockCode}/summary")
    public StockSummaryResponse getSummary(
            @Parameter(description = "종목코드 6자리", example = "005930") @PathVariable String stockCode,
            @Parameter(description = "감성 비율을 셀 출처: NEWS 또는 SNS (없으면 둘 다)", example = "NEWS")
            @RequestParam(required = false) String source) {
        return stockService.getSummary(stockCode, source);
    }

    @Operation(summary = "종목 상세 조회", description = "종목코드로 종목 한 개를 조회합니다. 없으면 404 STOCK_NOT_FOUND.")
    @GetMapping("/{stockCode}")
    public StockResponse getStock(
            @Parameter(description = "종목코드 6자리", example = "005930") @PathVariable String stockCode) {
        return stockService.getStock(stockCode);
    }
}

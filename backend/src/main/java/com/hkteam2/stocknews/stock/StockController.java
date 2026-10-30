package com.hkteam2.stocknews.stock;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.hkteam2.stocknews.common.ListResponse;

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

    @Operation(summary = "종목 목록 조회", description = "종목 사전에 등록된 전체 종목을 종목코드 순으로 반환합니다.")
    @GetMapping
    public ListResponse<StockResponse> getStocks() {
        return stockService.getStocks();
    }

    @Operation(summary = "종목 상세 조회", description = "종목코드로 종목 한 개를 조회합니다. 없으면 404 STOCK_NOT_FOUND.")
    @GetMapping("/{stockCode}")
    public StockResponse getStock(
            @Parameter(description = "종목코드 6자리", example = "005930") @PathVariable String stockCode) {
        return stockService.getStock(stockCode);
    }
}

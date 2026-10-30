package com.hkteam2.stocknews.stock;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.hkteam2.stocknews.common.ListResponse;

@RestController
@RequestMapping("/api/stocks")
public class StockController {

    private final StockService stockService;

    public StockController(StockService stockService) {
        this.stockService = stockService;
    }

    /** 종목 목록 */
    @GetMapping
    public ListResponse<StockResponse> getStocks() {
        return stockService.getStocks();
    }
}

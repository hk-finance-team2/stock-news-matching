package com.hkteam2.stocknews.stock;

import org.springframework.stereotype.Service;

import com.hkteam2.stocknews.common.ListResponse;

@Service
public class StockService {

    private final StockMapper stockMapper;

    public StockService(StockMapper stockMapper) {
        this.stockMapper = stockMapper;
    }

    public ListResponse<StockResponse> getStocks() {
        return ListResponse.of(stockMapper.findAll());
    }
}

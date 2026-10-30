package com.hkteam2.stocknews.stock;

import org.springframework.stereotype.Service;

import com.hkteam2.stocknews.common.ListResponse;
import com.hkteam2.stocknews.common.error.BusinessException;
import com.hkteam2.stocknews.common.error.ErrorCode;

@Service
public class StockService {

    private final StockMapper stockMapper;

    public StockService(StockMapper stockMapper) {
        this.stockMapper = stockMapper;
    }

    public ListResponse<StockResponse> getStocks() {
        return ListResponse.of(stockMapper.findAll());
    }

    public StockResponse getStock(String stockCode) {
        return stockMapper.findByCode(stockCode)
                .orElseThrow(() -> new BusinessException(ErrorCode.STOCK_NOT_FOUND));
    }
}

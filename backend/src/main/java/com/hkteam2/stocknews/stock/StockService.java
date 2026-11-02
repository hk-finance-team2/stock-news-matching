package com.hkteam2.stocknews.stock;

import org.springframework.stereotype.Service;

import com.hkteam2.stocknews.common.ListResponse;
import com.hkteam2.stocknews.common.PageQuery;
import com.hkteam2.stocknews.common.error.BusinessException;
import com.hkteam2.stocknews.common.error.ErrorCode;

@Service
public class StockService {

    private static final int MAX_KEYWORD_LENGTH = 50;

    private final StockMapper stockMapper;

    public StockService(StockMapper stockMapper) {
        this.stockMapper = stockMapper;
    }

    /** 종목 검색. q가 비어 있으면 전체를 이름순으로 */
    public ListResponse<StockResponse> getStocks(String q, PageQuery pageQuery) {
        String keyword = (q == null || q.isBlank()) ? null : q.strip();
        if (keyword != null && keyword.length() > MAX_KEYWORD_LENGTH) {
            throw new BusinessException(ErrorCode.INVALID_REQUEST);
        }
        String likeKeyword = keyword == null ? null : escapeLike(keyword);

        long totalCount = stockMapper.countSearch(keyword, likeKeyword);
        return new ListResponse<>(
                stockMapper.search(keyword, likeKeyword, pageQuery.limit(), pageQuery.offset()),
                totalCount);
    }

    public StockResponse getStock(String stockCode) {
        return stockMapper.findByCode(stockCode)
                .orElseThrow(() -> new BusinessException(ErrorCode.STOCK_NOT_FOUND));
    }

    /** LIKE의 특수 문자(\, %, _)를 글자 그대로 찾도록 앞에 \를 붙임. 예: "10%" -> "10\%" */
    private static String escapeLike(String keyword) {
        return keyword.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_");
    }
}

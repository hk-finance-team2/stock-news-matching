package com.hkteam2.stocknews.watchlist;

import org.springframework.dao.DuplicateKeyException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.hkteam2.stocknews.common.ListResponse;
import com.hkteam2.stocknews.common.error.BusinessException;
import com.hkteam2.stocknews.common.error.ErrorCode;
import com.hkteam2.stocknews.stock.StockMapper;

@Service
public class WatchlistService {

    private final WatchlistMapper watchlistMapper;
    private final StockMapper stockMapper;

    public WatchlistService(WatchlistMapper watchlistMapper, StockMapper stockMapper) {
        this.watchlistMapper = watchlistMapper;
        this.stockMapper = stockMapper;
    }

    @Transactional(readOnly = true)
    public ListResponse<WatchlistResponse> getMyWatchlist(Long userId) {
        return ListResponse.of(watchlistMapper.findAllByUserId(userId).stream()
                .map(WatchlistResponse::from)
                .toList());
    }

    @Transactional
    public WatchlistResponse add(Long userId, String stockCode) {
        if (!stockMapper.existsByCode(stockCode)) {
            throw new BusinessException(ErrorCode.STOCK_NOT_FOUND);
        }
        if (watchlistMapper.exists(userId, stockCode)) {
            throw new BusinessException(ErrorCode.ALREADY_IN_WATCHLIST);
        }
        try {
            watchlistMapper.insert(userId, stockCode);
        } catch (DuplicateKeyException e) {
            // 같은 요청이 동시에 두 번 오면 위 확인을 둘 다 통과할 수 있음 -> DB 기본키가 최종으로 막음
            throw new BusinessException(ErrorCode.ALREADY_IN_WATCHLIST);
        }
        return watchlistMapper.findOne(userId, stockCode)
                .map(WatchlistResponse::from)
                .orElseThrow();
    }

    @Transactional
    public void remove(Long userId, String stockCode) {
        if (watchlistMapper.delete(userId, stockCode) == 0) {
            throw new BusinessException(ErrorCode.WATCHLIST_NOT_FOUND);
        }
    }
}

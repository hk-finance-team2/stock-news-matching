package com.hkteam2.stocknews.watchlist;

import java.time.LocalDateTime;

/** DB 조회 결과 한 줄 (watchlist + stock_info + 기사 숫자). 응답으로 바꾸기 전 단계 */
public record WatchlistRow(
        String stockCode,
        String stockName,
        String market,
        LocalDateTime addedAt,
        long todayArticleCount,
        LocalDateTime lastMatchedAt
) {
}

package com.hkteam2.stocknews.watchlist;

import java.time.OffsetDateTime;

import com.hkteam2.stocknews.common.TimeUtils;

/**
 * 관심 종목 한 건 (F-19).
 * todayArticleCount: 오늘(한국 시간 0시~) 이 종목이 나온 글 수,
 * lastMatchedAt: 이 종목이 나온 가장 최근 글의 작성 시각 (오늘이 아니어도, 한 번도 없으면 null)
 */
public record WatchlistResponse(
        String stockCode,
        String stockName,
        String market,
        OffsetDateTime addedAt,
        long todayArticleCount,
        OffsetDateTime lastMatchedAt
) {

    public static WatchlistResponse from(WatchlistRow row) {
        return new WatchlistResponse(row.stockCode(), row.stockName(), row.market(), TimeUtils.toKst(row.addedAt()),
                row.todayArticleCount(), TimeUtils.toKst(row.lastMatchedAt()));
    }
}

package com.hkteam2.stocknews.watchlist;

import java.time.OffsetDateTime;

import com.hkteam2.stocknews.common.TimeUtils;

/**
 * 관심 종목 한 건.
 * 오늘 매칭 글 수·최근 매칭 시각(F-19)은 AI 기사 테이블이 생기면 추가
 */
public record WatchlistResponse(
        String stockCode,
        String stockName,
        String market,
        OffsetDateTime addedAt
) {

    public static WatchlistResponse from(WatchlistRow row) {
        return new WatchlistResponse(row.stockCode(), row.stockName(), row.market(), TimeUtils.toKst(row.addedAt()));
    }
}

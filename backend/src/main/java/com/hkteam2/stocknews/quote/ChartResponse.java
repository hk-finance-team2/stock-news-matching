package com.hkteam2.stocknews.quote;

import java.time.OffsetDateTime;
import java.util.List;

/**
 * 차트 (GET /api/quotes/{stockCode}/chart?unit=minute|day)
 * unit: MINUTE(오늘 1분봉, 최근 약 2시간) / DAY(일봉, 최근 약 100거래일)
 * items: 오래된 것부터 시각 순 → 그대로 왼쪽부터 그리면 됨
 */
public record ChartResponse(String stockCode, String unit, List<Candle> items) {

    /** 봉 하나. time은 분봉이면 그 분(예: 09:31), 일봉이면 그날 0시 */
    public record Candle(OffsetDateTime time, long open, long high, long low, long close, long volume) {
    }
}

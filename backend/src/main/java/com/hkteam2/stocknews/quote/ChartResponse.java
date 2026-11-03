package com.hkteam2.stocknews.quote;

import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.List;

/**
 * 차트 (GET /api/quotes/{stockCode}/chart?unit=)
 * unit: 1m·5m·10m·30m (date 하루의 09:00~15:30 분봉) / day·week·month·year (최근 100개, 년봉은 상장 이후)
 * date: 분봉이면 그 날짜, 아니면 null
 * items: 오래된 것부터 시각 순 → 그대로 왼쪽부터 그리면 됨
 */
public record ChartResponse(String stockCode, String unit, LocalDate date, List<Candle> items) {

    /** 봉 하나. time은 분봉이면 구간 시작 시각(예: 5분봉 09:05), 일·주·월·년봉이면 KIS가 준 날짜의 0시 */
    public record Candle(OffsetDateTime time, long open, long high, long low, long close, long volume) {
    }
}

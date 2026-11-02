package com.hkteam2.stocknews.stock;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.function.Function;
import java.util.stream.Collectors;

import com.hkteam2.stocknews.common.TimeUtils;

/**
 * 종목 언급량 그래프. items는 기간의 모든 칸이 시각 순으로 빠짐없이 (글이 없는 칸은 0).
 * unit(HOUR/DAY)으로 프론트가 아래 글자를 "08시"로 쓸지 "11/02"로 쓸지 정함.
 * 페이지가 없는 그래프 데이터라 목록 공통 모양 {items, totalCount}는 쓰지 않음
 */
public record StockMentionsResponse(
        String stockCode,
        String period,
        String unit,
        List<MentionPointResponse> items
) {

    public static StockMentionsResponse of(String stockCode, MentionPeriod period, List<LocalDateTime> buckets,
                                           List<MentionCountRow> rows) {
        return new StockMentionsResponse(stockCode, period.value(), period.unitName(), fill(buckets, rows));
    }

    /**
     * 빈 칸 채우기 (출석부): ① 모든 칸(buckets)을 펼쳐 놓고 ② SQL 결과(rows, 글이 있는 칸만)에
     * 같은 시각이 있으면 그 숫자, 없으면 0
     */
    static List<MentionPointResponse> fill(List<LocalDateTime> buckets, List<MentionCountRow> rows) {
        Map<LocalDateTime, MentionCountRow> byBucket = rows.stream()
                .collect(Collectors.toMap(MentionCountRow::bucket, Function.identity()));
        return buckets.stream()
                .map(bucket -> {
                    MentionCountRow row = byBucket.get(bucket);
                    long news = row == null ? 0 : row.newsCount();
                    long sns = row == null ? 0 : row.snsCount();
                    return new MentionPointResponse(TimeUtils.toKst(bucket), news, sns, news + sns);
                })
                .toList();
    }
}

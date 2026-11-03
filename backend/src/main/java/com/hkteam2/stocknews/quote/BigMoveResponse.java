package com.hkteam2.stocknews.quote;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.List;

/**
 * 과거 급등·급락 이력 (GET /api/quotes/{code}/big-moves, F-17)
 * items: 기준(threshold %)을 넘게 움직인 날, 최신 날짜부터. 날짜마다 그날 연결된 글(관련도 높은 순 3개)과 전체 글 수
 */
public record BigMoveResponse(
        String stockCode,
        String period,
        int threshold,
        LocalDate from,
        LocalDate to,
        List<Day> items
) {

    /** 하루. direction UP/DOWN, 하락이면 changeAmount·changeRate 음수 */
    public record Day(
            LocalDate date,
            long close,
            long changeAmount,
            BigDecimal changeRate,
            String direction,
            long volume,
            int articleCount,
            List<Article> articles
    ) {
    }

    /** 그날 글. relevance는 화면용 % (0~100), AI가 아직 안 채웠으면 null */
    public record Article(
            long articleId,
            String title,
            String sourceType,
            String press,
            OffsetDateTime publishedAt,
            Integer relevance
    ) {
    }
}

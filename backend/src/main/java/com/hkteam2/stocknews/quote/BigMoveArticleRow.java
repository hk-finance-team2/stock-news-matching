package com.hkteam2.stocknews.quote;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;

/** 급등·급락한 날에 이 종목과 연결된 글 한 줄 (day = 글 작성일) */
public record BigMoveArticleRow(
        LocalDate day,
        long articleId,
        String title,
        String sourceType,
        String press,
        LocalDateTime publishedAt,
        BigDecimal relevance
) {
}

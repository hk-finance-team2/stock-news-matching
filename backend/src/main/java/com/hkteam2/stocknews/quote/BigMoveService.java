package com.hkteam2.stocknews.quote;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import org.springframework.beans.factory.ObjectProvider;
import org.springframework.stereotype.Service;

import com.hkteam2.stocknews.common.TimeUtils;

/**
 * 과거 급등·급락 이력 (F-17): 일봉(KIS)으로 크게 움직인 날을 찾고, 그날 이 종목에 연결된 글을 붙임
 *
 * 1. 일봉 1년 치 (QuoteService, KIS 3번 + 10분 캐시) → 시세가 꺼져 있으면 503 QUOTE_DISABLED
 * 2. 등락률 계산·기준 넘은 날 고르기 (BigMoveFinder)
 * 3. 그날들의 글을 SQL 한 번으로 (날짜마다 따로 묻지 않음 = N+1 피하기). 화면과 같이 DONE인 글만
 * "그날" = 한국 시간 0시~24시에 작성된 글 (장 마감 뒤 기사가 다음 날 주가에 영향을 주는 경우는 아직 안 셈)
 */
@Service
public class BigMoveService {

    static final int ARTICLES_PER_DAY = 3;

    private final ObjectProvider<QuoteService> quoteService;
    private final QuoteMapper mapper;

    public BigMoveService(ObjectProvider<QuoteService> quoteService, QuoteMapper mapper) {
        this.quoteService = quoteService;
        this.mapper = mapper;
    }

    public BigMoveResponse bigMoves(String stockCode, BigMovePeriod period, int threshold) {
        QuoteService service = quoteService.getIfAvailable();
        if (service == null) {
            throw new QuoteDisabledException();
        }
        LocalDate today = LocalDate.now(TimeUtils.KST);
        return build(stockCode, service.yearDailyCandles(stockCode), period, threshold, today);
    }

    /** 일봉 → 응답 (KIS 없이 테스트할 수 있게 일봉을 받아서 계산) */
    BigMoveResponse build(String stockCode, List<KisCandle> candles, BigMovePeriod period, int threshold, LocalDate today) {
        LocalDate from = period.from(today);
        List<BigMoveFinder.BigMove> moves = BigMoveFinder.find(candles, BigDecimal.valueOf(threshold)).stream()
                .filter(m -> !m.date().isBefore(from))
                .sorted(Comparator.comparing(BigMoveFinder.BigMove::date).reversed())
                .toList();

        Map<LocalDate, List<BigMoveArticleRow>> byDay = new LinkedHashMap<>();
        if (!moves.isEmpty()) {
            List<LocalDate> days = moves.stream().map(BigMoveFinder.BigMove::date).toList();
            for (BigMoveArticleRow row : mapper.findArticlesOnDays(stockCode, days)) {
                byDay.computeIfAbsent(row.day(), d -> new ArrayList<>()).add(row);
            }
        }

        List<BigMoveResponse.Day> items = moves.stream().map(m -> {
            List<BigMoveArticleRow> rows = byDay.getOrDefault(m.date(), List.of());
            List<BigMoveResponse.Article> top = rows.stream().limit(ARTICLES_PER_DAY)
                    .map(r -> new BigMoveResponse.Article(r.articleId(), r.title(), r.sourceType(), r.press(),
                            TimeUtils.toKst(r.publishedAt()),
                            r.relevance() == null ? null : r.relevance().movePointRight(2).intValue()))
                    .toList();
            return new BigMoveResponse.Day(m.date(), m.close(), m.changeAmount(), m.changeRate(),
                    m.changeAmount() > 0 ? "UP" : "DOWN", m.volume(), rows.size(), top);
        }).toList();
        return new BigMoveResponse(stockCode, period.code(), threshold, from, today, items);
    }
}

package com.hkteam2.stocknews.stock;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;
import java.util.stream.IntStream;

import org.springframework.stereotype.Service;

import com.hkteam2.stocknews.common.ListResponse;
import com.hkteam2.stocknews.common.PageQuery;
import com.hkteam2.stocknews.common.TimeUtils;
import com.hkteam2.stocknews.common.error.BusinessException;
import com.hkteam2.stocknews.common.error.ErrorCode;

@Service
public class StockService {

    private static final int MAX_KEYWORD_LENGTH = 50;
    private static final Set<String> SOURCE_TYPES = Set.of("NEWS", "SNS");
    private static final int MAX_ISSUE_LIMIT = 50;

    private final StockMapper stockMapper;

    public StockService(StockMapper stockMapper) {
        this.stockMapper = stockMapper;
    }

    /** 종목 검색. q가 비어 있으면 전체를 이름순으로 */
    public ListResponse<StockResponse> getStocks(String q, PageQuery pageQuery) {
        String keyword = (q == null || q.isBlank()) ? null : q.strip();
        if (keyword != null && keyword.length() > MAX_KEYWORD_LENGTH) {
            throw new BusinessException(ErrorCode.INVALID_REQUEST);
        }
        String likeKeyword = keyword == null ? null : escapeLike(keyword);

        long totalCount = stockMapper.countSearch(keyword, likeKeyword);
        return new ListResponse<>(
                stockMapper.search(keyword, likeKeyword, pageQuery.limit(), pageQuery.offset()),
                totalCount);
    }

    public StockResponse getStock(String stockCode) {
        return stockMapper.findByCode(stockCode)
                .orElseThrow(() -> new BusinessException(ErrorCode.STOCK_NOT_FOUND));
    }

    /**
     * 오늘의 이슈 종목 순위. 오늘 = 한국 시간 0시부터 지금까지 작성된 글.
     * 세고 정렬하는 일은 SQL(GROUP BY·COUNT)이 하고, 여기서는 오늘 0시 계산·조건 검사·순위 번호만
     */
    public ListResponse<StockIssueResponse> getIssues(String source, int limit) {
        String sourceType = source == null ? null : source.toUpperCase();
        if (sourceType != null && !SOURCE_TYPES.contains(sourceType)) {
            throw new BusinessException(ErrorCode.INVALID_REQUEST);
        }
        if (limit < 1 || limit > MAX_ISSUE_LIMIT) {
            throw new BusinessException(ErrorCode.INVALID_REQUEST);
        }
        // DB의 CURDATE()는 DB 시간대 설정에 따라 달라질 수 있어서 앱에서 한국 시간으로 계산해 넘김
        LocalDateTime todayStart = LocalDate.now(TimeUtils.KST).atStartOfDay();

        List<StockIssueRow> rows = stockMapper.findIssues(todayStart, sourceType, limit);
        // 순위는 1부터 차례로 (글 수가 같아도 SQL 정렬 순서대로 1, 2, 3)
        List<StockIssueResponse> items = IntStream.range(0, rows.size())
                .mapToObj(i -> StockIssueResponse.of(i + 1, rows.get(i)))
                .toList();
        return ListResponse.of(items);
    }

    /**
     * 종목의 오늘 종합 요약. 두 곳에서 가져와 합침
     * - 요약 문장: AI가 저장한 stock_daily_summary (없으면 null → 화면은 "요약 준비 중")
     * - 감성 비율: 오늘 이 종목이 나온 글을 지금 직접 셈 (AI 요약이 없어도, 1시간을 기다리지 않아도 최신)
     */
    public StockSummaryResponse getSummary(String stockCode) {
        StockResponse stock = getStock(stockCode);   // 없는 종목이면 404
        LocalDate today = LocalDate.now(TimeUtils.KST);

        StockDailySummaryRow summary = stockMapper.findDailySummary(stockCode, today).orElse(null);
        Map<String, Long> counts = stockMapper.countSentiments(stockCode, today.atStartOfDay()).stream()
                .collect(Collectors.toMap(SentimentCountRow::sentiment, SentimentCountRow::articleCount));

        return StockSummaryResponse.of(stock, today, summary, SentimentRatioResponse.from(counts));
    }

    /** LIKE의 특수 문자(\, %, _)를 글자 그대로 찾도록 앞에 \를 붙임. 예: "10%" -> "10\%" */
    private static String escapeLike(String keyword) {
        return keyword.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_");
    }
}

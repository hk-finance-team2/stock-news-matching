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
import com.hkteam2.stocknews.common.SearchKeyword;
import com.hkteam2.stocknews.common.TimeUtils;
import com.hkteam2.stocknews.common.error.BusinessException;
import com.hkteam2.stocknews.common.error.ErrorCode;

@Service
public class StockService {

    private static final Set<String> SOURCE_TYPES = Set.of("NEWS", "SNS");
    private static final int MAX_ISSUE_LIMIT = 50;
    /** 종목 검색에서 "최근 많이 언급된 종목 먼저"를 셀 기간 */
    private static final int SEARCH_MENTION_DAYS = 7;

    private final StockMapper stockMapper;
    private final AiSummaryClient aiSummaryClient;

    public StockService(StockMapper stockMapper, AiSummaryClient aiSummaryClient) {
        this.stockMapper = stockMapper;
        this.aiSummaryClient = aiSummaryClient;
    }

    /** 종목 검색. q가 비어 있으면 전체를 이름순으로. 같은 순위끼리는 최근 7일 많이 언급된 종목 먼저 */
    public ListResponse<StockSearchResponse> getStocks(String q, PageQuery pageQuery) {
        String keyword = SearchKeyword.normalize(q);
        String likeKeyword = SearchKeyword.escapeLike(keyword);
        // DB 시간대 설정에 기대지 않게 앱에서 한국 시간으로 계산해 넘김 (이슈 순위와 같은 방식)
        LocalDateTime mentionFrom = LocalDateTime.now(TimeUtils.KST).minusDays(SEARCH_MENTION_DAYS);

        long totalCount = stockMapper.countSearch(keyword, likeKeyword);
        return new ListResponse<>(
                stockMapper.search(keyword, likeKeyword, mentionFrom, pageQuery.limit(), pageQuery.offset()),
                totalCount);
    }

    public StockResponse getStock(String stockCode) {
        return stockMapper.findByCode(stockCode)
                .orElseThrow(() -> new BusinessException(ErrorCode.STOCK_NOT_FOUND));
    }

    /**
     * 오늘의 이슈 종목 순위. 오늘 = 한국 시간 0시부터 지금까지 작성된 글.
     * 세고 정렬하는 일은 SQL(GROUP BY·COUNT)이 하고, 여기서는 오늘 0시 계산·조건 검사·순위 번호만
     * 출처가 없으면 뉴스만 셈: AI가 SNS를 "뉴스 많은 종목"만 골라 모으므로 섞으면 같은 종목을 두 번 세게 됨
     */
    public ListResponse<StockIssueResponse> getIssues(String source, int limit) {
        String sourceType = source == null ? "NEWS" : toSourceType(source);
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
     *   source가 없으면 뉴스·SNS 합계 (요구사항 기본), NEWS/SNS면 그 출처만
     */
    public StockSummaryResponse getSummary(String stockCode, String source) {
        String sourceType = toSourceType(source);
        StockResponse stock = getStock(stockCode);   // 없는 종목이면 404
        LocalDate today = LocalDate.now(TimeUtils.KST);

        StockDailySummaryRow summary = stockMapper.findDailySummary(stockCode, today).orElse(null);
        Map<String, Long> counts = stockMapper.countSentiments(stockCode, today.atStartOfDay(), sourceType).stream()
                .collect(Collectors.toMap(SentimentCountRow::sentiment, SentimentCountRow::articleCount));

        return StockSummaryResponse.of(stock, today, summary, SentimentRatioResponse.from(counts));
    }

    /**
     * 종합 요약 다시 생성 (F-08): AI 서버에 오늘 요약을 새로 만들게 하고, 저장된 요약을 다시 읽어 돌려줌
     * 없는 종목은 AI 서버를 부르기 전에 404 (LLM 비용을 쓰지 않게)
     */
    public SummaryRegenerateResponse regenerateSummary(String stockCode) {
        getStock(stockCode);   // 없는 종목이면 404
        boolean regenerated = aiSummaryClient.regenerate(stockCode);
        return new SummaryRegenerateResponse(regenerated, getSummary(stockCode, null));
    }

    /**
     * 종목 언급량 그래프. SQL은 글이 있는 칸만 세고, 빈 칸(0건)은 응답 만들 때 채움
     */
    public StockMentionsResponse getMentions(String stockCode, String period) {
        MentionPeriod mentionPeriod = MentionPeriod.from(period);   // today/7d/30d가 아니면 400
        if (!stockMapper.existsByCode(stockCode)) {
            throw new BusinessException(ErrorCode.STOCK_NOT_FOUND);
        }
        LocalDateTime now = LocalDateTime.now(TimeUtils.KST);

        List<MentionCountRow> rows = stockMapper.countMentions(stockCode, mentionPeriod.start(now),
                mentionPeriod.end(now), mentionPeriod.unitName());
        return StockMentionsResponse.of(stockCode, mentionPeriod, mentionPeriod.buckets(now), rows);
    }

    /** 출처 조건: 없으면 null(전체), 대소문자 상관없이(sns → SNS) NEWS/SNS만. 그 밖은 400 */
    private static String toSourceType(String source) {
        String sourceType = source == null ? null : source.toUpperCase();
        if (sourceType != null && !SOURCE_TYPES.contains(sourceType)) {
            throw new BusinessException(ErrorCode.INVALID_REQUEST);
        }
        return sourceType;
    }
}

package com.hkteam2.stocknews.article;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.hkteam2.stocknews.common.ListResponse;
import com.hkteam2.stocknews.common.PageQuery;
import com.hkteam2.stocknews.common.SearchKeyword;
import com.hkteam2.stocknews.common.TimeUtils;
import com.hkteam2.stocknews.common.error.BusinessException;
import com.hkteam2.stocknews.common.error.ErrorCode;
import com.hkteam2.stocknews.stock.MentionPeriod;
import com.hkteam2.stocknews.stock.StockMapper;

@Service
public class ArticleService {

    private static final Set<String> SOURCE_TYPES = Set.of("NEWS", "SNS");
    private static final Set<String> SORTS = Set.of("latest", "relevance");
    private static final Set<String> SENTIMENTS = Set.of("POSITIVE", "NEGATIVE", "NEUTRAL");
    /** 뉴스 상세에 붙일 SNS: 작성 시각 앞뒤 24시간 안에서 최대 5개 (F-11) */
    private static final int NEARBY_SNS_HOURS = 24;
    private static final int NEARBY_SNS_LIMIT = 5;

    private final ArticleMapper articleMapper;
    private final StockMapper stockMapper;

    public ArticleService(ArticleMapper articleMapper, StockMapper stockMapper) {
        this.articleMapper = articleMapper;
        this.stockMapper = stockMapper;
    }

    /** 기사 목록 거르기 조건 묶음. 모두 선택 (null이면 안 거름). SQL listCondition과 한 칸씩 짝 */
    private record Filter(String sourceType, String stockCode, BigDecimal minRelevance, Long watchUserId,
                          String likeKeyword, LocalDateTime from, String sentiment) {
    }

    /**
     * 기사 목록. 홈(조건 없음)·종목 화면(stockCode)·필터(source, minRelevance)·검색(q, period)이 모두 이 하나를 씀.
     * SQL은 2번: ① 기사 한 페이지 ② 그 기사들의 관련 종목 (기사마다 따로 부르면 N+1)
     */
    @Transactional(readOnly = true)
    public ListResponse<ArticleResponse> getArticles(String source, String sort, Integer minRelevance,
                                                     String stockCode, String q, String period,
                                                     String sentiment, PageQuery pageQuery) {
        String sourceType = toSourceType(source);
        checkSort(sort);
        BigDecimal minRelevanceDecimal = toMinRelevance(minRelevance);
        if (stockCode != null && !stockMapper.existsByCode(stockCode)) {
            throw new BusinessException(ErrorCode.STOCK_NOT_FOUND);
        }
        String likeKeyword = SearchKeyword.escapeLike(SearchKeyword.normalize(q));
        return findPage(new Filter(sourceType, stockCode, minRelevanceDecimal, null, likeKeyword, toFrom(period),
                        toSentiment(sentiment)),
                sort, pageQuery);
    }

    /**
     * 관심 종목 글 모아 보기 (F-19). 내 관심 종목 중 하나라도 연결된 글.
     * 목록과 같은 SQL에 "이 회원의 관심 종목" 조건만 더함. userId는 토큰에서 꺼낸 값만 받음
     */
    @Transactional(readOnly = true)
    public ListResponse<ArticleResponse> getWatchlistArticles(Long userId, String source, String sort,
                                                              Integer minRelevance, String sentiment,
                                                              PageQuery pageQuery) {
        String sourceType = toSourceType(source);
        checkSort(sort);
        return findPage(new Filter(sourceType, null, toMinRelevance(minRelevance), userId, null, null,
                        toSentiment(sentiment)),
                sort, pageQuery);
    }

    /** 조건에 맞는 기사 한 페이지 + 관련 종목 칩 (목록·관심 종목 글·검색이 같이 씀) */
    private ListResponse<ArticleResponse> findPage(Filter f, String sort, PageQuery pageQuery) {
        long totalCount = articleMapper.countArticles(f.sourceType(), f.stockCode(), f.minRelevance(),
                f.watchUserId(), f.likeKeyword(), f.from(), f.sentiment());
        List<ArticleRow> rows = articleMapper.findArticles(f.sourceType(), f.stockCode(), f.minRelevance(),
                f.watchUserId(), f.likeKeyword(), f.from(), f.sentiment(), sort, pageQuery.limit(), pageQuery.offset());
        if (rows.isEmpty()) {
            return new ListResponse<>(List.of(), totalCount);
        }

        // 관련 종목을 기사 번호별로 묶음 (SQL에서 정한 순서 유지)
        List<Long> articleIds = rows.stream().map(ArticleRow::articleId).toList();
        Map<Long, List<ArticleStockResponse>> stocksByArticle = articleMapper.findStocksByArticleIds(articleIds)
                .stream()
                .collect(Collectors.groupingBy(ArticleStockRow::articleId,
                        Collectors.mapping(ArticleStockResponse::from, Collectors.toList())));

        List<ArticleResponse> items = rows.stream()
                .map(row -> ArticleResponse.from(row, stocksByArticle.getOrDefault(row.articleId(), List.of())))
                .toList();
        return new ListResponse<>(items, totalCount);
    }

    private static String toSourceType(String source) {
        String sourceType = source == null ? null : source.toUpperCase();
        if (sourceType != null && !SOURCE_TYPES.contains(sourceType)) {
            throw new BusinessException(ErrorCode.INVALID_REQUEST);
        }
        return sourceType;
    }

    /**
     * 기간 → 시작 시각. 없으면 null(전체). today/7d/30d는 언급량 그래프(MentionPeriod)와 같은 뜻
     * (7d = 오늘 포함 7일 = 6일 전 0시부터). 그 밖은 400
     */
    private static LocalDateTime toFrom(String period) {
        if (period == null || period.isBlank()) {
            return null;
        }
        return MentionPeriod.from(period).start(LocalDateTime.now(TimeUtils.KST));
    }

    /** 감성 조건: 없으면 null(전체), 대소문자 상관없이 POSITIVE/NEGATIVE/NEUTRAL만. 그 밖은 400 */
    private static String toSentiment(String sentiment) {
        String value = sentiment == null || sentiment.isBlank() ? null : sentiment.toUpperCase();
        if (value != null && !SENTIMENTS.contains(value)) {
            throw new BusinessException(ErrorCode.INVALID_REQUEST);
        }
        return value;
    }

    private static void checkSort(String sort) {
        if (!SORTS.contains(sort)) {
            throw new BusinessException(ErrorCode.INVALID_REQUEST);
        }
    }

    /** 화면은 %(80), DB는 소수(0.80). 0~100이 아니면 400 */
    private static BigDecimal toMinRelevance(Integer minRelevance) {
        if (minRelevance == null) {
            return null;
        }
        if (minRelevance < 0 || minRelevance > 100) {
            throw new BusinessException(ErrorCode.INVALID_REQUEST);
        }
        return BigDecimal.valueOf(minRelevance, 2);
    }

    /**
     * 기사 상세. SQL 3번: ① 글 ② 관련 종목(목록과 같은 SQL에 글 1개만) ③ 가까운 SNS(뉴스일 때만)
     * 없는 글이거나 아직 분석 중인 글은 404
     */
    @Transactional(readOnly = true)
    public ArticleDetailResponse getArticle(Long articleId) {
        ArticleDetailRow row = articleMapper.findDetail(articleId)
                .orElseThrow(() -> new BusinessException(ErrorCode.ARTICLE_NOT_FOUND));

        List<ArticleStockDetailResponse> stocks = articleMapper.findStocksByArticleIds(List.of(articleId)).stream()
                .map(ArticleStockDetailResponse::from)
                .toList();

        List<RelatedSnsResponse> relatedSns = "NEWS".equals(row.sourceType())
                ? articleMapper.findNearbySns(articleId, NEARBY_SNS_HOURS, NEARBY_SNS_LIMIT).stream()
                        .map(RelatedSnsResponse::from)
                        .toList()
                : List.of();

        return ArticleDetailResponse.from(row, stocks, relatedSns);
    }
}

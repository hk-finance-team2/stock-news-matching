package com.hkteam2.stocknews.article;

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.hkteam2.stocknews.common.ListResponse;
import com.hkteam2.stocknews.common.PageQuery;
import com.hkteam2.stocknews.common.error.BusinessException;
import com.hkteam2.stocknews.common.error.ErrorCode;
import com.hkteam2.stocknews.stock.StockMapper;

@Service
public class ArticleService {

    private static final Set<String> SOURCE_TYPES = Set.of("NEWS", "SNS");
    private static final Set<String> SORTS = Set.of("latest", "relevance");

    private final ArticleMapper articleMapper;
    private final StockMapper stockMapper;

    public ArticleService(ArticleMapper articleMapper, StockMapper stockMapper) {
        this.articleMapper = articleMapper;
        this.stockMapper = stockMapper;
    }

    /**
     * 기사 목록. 홈(조건 없음)·종목 화면(stockCode)·필터(source, minRelevance)가 모두 이 하나를 씀.
     * SQL은 2번: ① 기사 한 페이지 ② 그 기사들의 관련 종목 (기사마다 따로 부르면 N+1)
     */
    @Transactional(readOnly = true)
    public ListResponse<ArticleResponse> getArticles(String source, String sort, Integer minRelevance,
                                                     String stockCode, PageQuery pageQuery) {
        String sourceType = source == null ? null : source.toUpperCase();
        if (sourceType != null && !SOURCE_TYPES.contains(sourceType)) {
            throw new BusinessException(ErrorCode.INVALID_REQUEST);
        }
        if (!SORTS.contains(sort)) {
            throw new BusinessException(ErrorCode.INVALID_REQUEST);
        }
        if (minRelevance != null && (minRelevance < 0 || minRelevance > 100)) {
            throw new BusinessException(ErrorCode.INVALID_REQUEST);
        }
        if (stockCode != null && !stockMapper.existsByCode(stockCode)) {
            throw new BusinessException(ErrorCode.STOCK_NOT_FOUND);
        }
        // 화면은 %(80), DB는 소수(0.80)
        BigDecimal minRelevanceDecimal = minRelevance == null ? null : BigDecimal.valueOf(minRelevance, 2);

        long totalCount = articleMapper.countArticles(sourceType, stockCode, minRelevanceDecimal);
        List<ArticleRow> rows = articleMapper.findArticles(sourceType, stockCode, minRelevanceDecimal, sort,
                pageQuery.limit(), pageQuery.offset());
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
}

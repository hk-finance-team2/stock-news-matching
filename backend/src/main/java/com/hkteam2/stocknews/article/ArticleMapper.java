package com.hkteam2.stocknews.article;

import java.math.BigDecimal;
import java.util.List;

import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;

/** article·article_stock 조회 (AI가 쓰고 백엔드는 읽기만). SQL은 resources/mapper/article/ArticleMapper.xml */
@Mapper
public interface ArticleMapper {

    long countArticles(@Param("sourceType") String sourceType,
                       @Param("stockCode") String stockCode,
                       @Param("minRelevance") BigDecimal minRelevance);

    /** sort: latest(최신순) 또는 relevance(관련도순) */
    List<ArticleRow> findArticles(@Param("sourceType") String sourceType,
                                  @Param("stockCode") String stockCode,
                                  @Param("minRelevance") BigDecimal minRelevance,
                                  @Param("sort") String sort,
                                  @Param("limit") int limit,
                                  @Param("offset") int offset);

    /** 여러 기사의 관련 종목을 한 번에 (N+1 방지) */
    List<ArticleStockRow> findStocksByArticleIds(@Param("articleIds") List<Long> articleIds);
}

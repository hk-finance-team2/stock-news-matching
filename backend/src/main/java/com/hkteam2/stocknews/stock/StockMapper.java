package com.hkteam2.stocknews.stock;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;

/** stock_info 테이블 조회 (이슈 순위는 article·article_stock 집계). SQL은 resources/mapper/stock/StockMapper.xml */
@Mapper
public interface StockMapper {

    /** keyword가 null이면 전체 개수 */
    long countSearch(@Param("keyword") String keyword, @Param("likeKeyword") String likeKeyword);

    /** keyword가 null이면 전체를 이름순으로 한 페이지 */
    List<StockResponse> search(@Param("keyword") String keyword,
                               @Param("likeKeyword") String likeKeyword,
                               @Param("limit") int limit,
                               @Param("offset") int offset);

    /** 없으면 Optional.empty() */
    Optional<StockResponse> findByCode(String stockCode);

    boolean existsByCode(String stockCode);

    /** from 이후 글에 많이 나온 종목 순 limit개. sourceType이 null이면 뉴스·SNS 모두 */
    List<StockIssueRow> findIssues(@Param("from") LocalDateTime from,
                                   @Param("sourceType") String sourceType,
                                   @Param("limit") int limit);
}

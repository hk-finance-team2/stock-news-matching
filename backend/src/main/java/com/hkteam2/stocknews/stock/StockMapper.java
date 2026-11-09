package com.hkteam2.stocknews.stock;

import java.time.LocalDate;
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

    /** keyword가 null이면 전체를 이름순으로 한 페이지. mentionFrom 이후 글에 많이 나온 종목을 같은 순위 안에서 먼저 */
    List<StockSearchResponse> search(@Param("keyword") String keyword,
                               @Param("likeKeyword") String likeKeyword,
                               @Param("mentionFrom") LocalDateTime mentionFrom,
                               @Param("limit") int limit,
                               @Param("offset") int offset);

    /** 없으면 Optional.empty() */
    Optional<StockResponse> findByCode(String stockCode);

    boolean existsByCode(String stockCode);

    /** from 이후 글에 많이 나온 종목 순 limit개. sourceType이 null이면 뉴스·SNS 모두 (API 기본은 서비스가 NEWS로 넘김) */
    List<StockIssueRow> findIssues(@Param("from") LocalDateTime from,
                                   @Param("sourceType") String sourceType,
                                   @Param("limit") int limit);

    /** 그날 AI 종합 요약. 아직 안 만들었으면 Optional.empty() */
    Optional<StockDailySummaryRow> findDailySummary(@Param("stockCode") String stockCode,
                                                    @Param("date") LocalDate date);

    /** from 이후 이 종목이 나온 글의 감성별 개수. sourceType이 null이면 뉴스·SNS 모두. 0건인 감성은 결과에 없음 */
    List<SentimentCountRow> countSentiments(@Param("stockCode") String stockCode,
                                            @Param("from") LocalDateTime from,
                                            @Param("sourceType") String sourceType);

    /** from 이상 to 미만, 시간 칸(unit: HOUR/DAY)별 뉴스·SNS 글 수. 글이 있는 칸만, 시각 순 */
    List<MentionCountRow> countMentions(@Param("stockCode") String stockCode,
                                        @Param("from") LocalDateTime from,
                                        @Param("to") LocalDateTime to,
                                        @Param("unit") String unit);
}

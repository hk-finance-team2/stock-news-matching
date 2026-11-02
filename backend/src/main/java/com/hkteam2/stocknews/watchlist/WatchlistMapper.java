package com.hkteam2.stocknews.watchlist;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;

/** watchlist 테이블. SQL은 resources/mapper/watchlist/WatchlistMapper.xml */
@Mapper
public interface WatchlistMapper {

    /** 최근에 추가한 순서. from(오늘 0시) 이후 글 수를 같이 셈 */
    List<WatchlistRow> findAllByUserId(@Param("userId") Long userId, @Param("from") LocalDateTime from);

    Optional<WatchlistRow> findOne(@Param("userId") Long userId, @Param("stockCode") String stockCode,
                                   @Param("from") LocalDateTime from);

    boolean exists(@Param("userId") Long userId, @Param("stockCode") String stockCode);

    void insert(@Param("userId") Long userId, @Param("stockCode") String stockCode);

    /** 지운 줄 수 (없으면 0) */
    int delete(@Param("userId") Long userId, @Param("stockCode") String stockCode);
}

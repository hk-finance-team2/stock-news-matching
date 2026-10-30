package com.hkteam2.stocknews.watchlist;

import java.util.List;
import java.util.Optional;

import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;

/** watchlist 테이블. SQL은 resources/mapper/watchlist/WatchlistMapper.xml */
@Mapper
public interface WatchlistMapper {

    /** 최근에 추가한 순서 */
    List<WatchlistRow> findAllByUserId(@Param("userId") Long userId);

    Optional<WatchlistRow> findOne(@Param("userId") Long userId, @Param("stockCode") String stockCode);

    boolean exists(@Param("userId") Long userId, @Param("stockCode") String stockCode);

    void insert(@Param("userId") Long userId, @Param("stockCode") String stockCode);

    /** 지운 줄 수 (없으면 0) */
    int delete(@Param("userId") Long userId, @Param("stockCode") String stockCode);
}

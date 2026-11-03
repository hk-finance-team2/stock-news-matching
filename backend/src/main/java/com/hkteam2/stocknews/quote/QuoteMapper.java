package com.hkteam2.stocknews.quote;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;

/** 실시간 시세 저장·조회 (V10 표). SQL은 resources/mapper/quote/QuoteMapper.xml */
@Mapper
public interface QuoteMapper {

    /** 체결 여러 건을 한 번에. 이미 있는 체결(같은 종목·날짜·누적 거래량)은 건너뜀. 돌려주는 값 = 실제로 넣은 줄 수 */
    int insertTicks(@Param("ticks") List<RealtimeTick> ticks);

    /** 종목마다 최신 체결로 현재가 줄을 넣거나 덮어씀. 누적 거래량이 더 큰(= 더 나중) 체결일 때만 덮어씀 */
    int upsertSnapshots(@Param("ticks") List<RealtimeTick> ticks, @Param("now") LocalDateTime now);

    void insertQuarantine(@Param("raw") String raw, @Param("reason") String reason,
                          @Param("receivedAt") LocalDateTime receivedAt);

    QuoteSnapshotRow findSnapshot(@Param("stockCode") String stockCode);

    /** 그날 저장된 체결 수 */
    long countTicks(@Param("tradeDate") LocalDate tradeDate);

    long countQuarantine();
}

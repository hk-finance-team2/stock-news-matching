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

    /** 여러 종목의 현재가 줄 (방송국이 1초마다 "바뀐 것"을 고를 때) */
    List<QuoteSnapshotRow> findSnapshots(@Param("codes") java.util.Collection<String> codes);

    /** afterId 보다 나중에 저장된 체결 (방송국이 새 체결만 보낼 때). tick_id 순 */
    List<TickRow> findTicksAfter(@Param("codes") java.util.Collection<String> codes,
                                 @Param("afterId") long afterId, @Param("limit") int limit);

    /** 지금까지 저장된 가장 큰 체결 ID (없으면 0) */
    long maxTickId();

    /** 그날 저장된 체결 수 */
    long countTicks(@Param("tradeDate") LocalDate tradeDate);

    long countQuarantine();
}

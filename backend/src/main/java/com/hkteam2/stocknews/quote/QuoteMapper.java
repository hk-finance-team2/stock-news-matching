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

    // ----- 다시 보기 (녹화본) -----

    /** 이 종목을 녹화한 날짜들 (최근 날짜부터): 날짜, 체결 수, 첫·마지막 체결 시각 */
    List<RecordingRow> findRecordings(@Param("stockCode") String stockCode);

    /** 다시 보기용 체결: 그날 from 시각 이후, afterId 다음부터 limit건 (저장 순서 = 받은 순서) */
    List<TickRow> findReplayTicks(@Param("stockCode") String stockCode, @Param("tradeDate") LocalDate tradeDate,
                                  @Param("from") LocalDateTime from, @Param("afterId") long afterId,
                                  @Param("limit") int limit);

    long countReplayTicks(@Param("stockCode") String stockCode, @Param("tradeDate") LocalDate tradeDate,
                          @Param("from") LocalDateTime from);

    // ----- 수집 점검 (정합성) -----

    /** 그날 종목별 저장 체결 수·거래량 합·누적 거래량 처음/끝·지연 (점검 계산 재료) */
    List<CollectCheckRow> checkCollection(@Param("tradeDate") LocalDate tradeDate);

    /** 그날 저장된 체결 수 */
    long countTicks(@Param("tradeDate") LocalDate tradeDate);

    long countQuarantine();
}

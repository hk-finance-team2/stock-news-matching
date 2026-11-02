package com.hkteam2.stocknews.status;

import java.util.Optional;

import org.apache.ibatis.annotations.Mapper;

/** AI가 쓰는 article·stock_daily_summary·collect_run에서 갱신 시각만 읽음. SQL은 resources/mapper/status/StatusMapper.xml */
@Mapper
public interface StatusMapper {

    /** 값이 모두 NULL이면 MyBatis는 줄 대신 null을 돌려줌 → Service에서 EMPTY로 바꿈 */
    DataStatusRow findDataStatus();

    Optional<CollectRunRow> findLatestRun();
}

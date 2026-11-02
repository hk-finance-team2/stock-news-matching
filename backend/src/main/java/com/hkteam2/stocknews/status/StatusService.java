package com.hkteam2.stocknews.status;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class StatusService {

    private final StatusMapper statusMapper;

    public StatusService(StatusMapper statusMapper) {
        this.statusMapper = statusMapper;
    }

    /** 데이터 상태. SQL 2번: ① 마지막 갱신 시각 4개 ② 가장 최근 수집 실행 */
    @Transactional(readOnly = true)
    public DataStatusResponse getStatus() {
        DataStatusRow row = statusMapper.findDataStatus();
        CollectRunResponse lastRun = statusMapper.findLatestRun().map(CollectRunResponse::from).orElse(null);
        return DataStatusResponse.of(row == null ? DataStatusRow.EMPTY : row, lastRun);
    }
}

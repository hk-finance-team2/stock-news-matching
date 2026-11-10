package com.hkteam2.stocknews.common;

import com.hkteam2.stocknews.common.error.BusinessException;
import com.hkteam2.stocknews.common.error.ErrorCode;

/**
 * 목록 페이지 요청. page는 1부터, size는 1~100.
 * 예: page=2, size=20 -> 21번째부터 20개 (SQL LIMIT 20 OFFSET 20)
 */
public record PageQuery(int page, int size) {

    public static final int DEFAULT_SIZE = 20;
    public static final int MAX_SIZE = 100;

    public PageQuery {
        if (page < 1 || size < 1 || size > MAX_SIZE) {
            throw new BusinessException(ErrorCode.INVALID_PAGE);
        }
    }

    /** SQL LIMIT */
    public int limit() {
        return size;
    }

    /** SQL OFFSET: 앞에서 건너뛸 개수 */
    public int offset() {
        // 아주 큰 page 는 int 를 넘어 음수 OFFSET 이 되어 SQL 오류(500)였음 → 끝까지 건너뛴 빈 결과로 (2026-11-10 QA)
        return (int) Math.min(Integer.MAX_VALUE, (long) (page - 1) * size);
    }
}

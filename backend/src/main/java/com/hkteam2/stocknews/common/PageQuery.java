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
        return (page - 1) * size;
    }
}

package com.hkteam2.stocknews.common;

import com.hkteam2.stocknews.common.error.BusinessException;
import com.hkteam2.stocknews.common.error.ErrorCode;

/**
 * 검색어 공통 처리. 종목 검색·글 검색·통합 검색이 같이 씀
 * - normalize: 앞뒤 공백 제거, 비었으면 null, 50자 넘으면 400
 * - escapeLike: LIKE의 특수 문자를 글자로 찾게 바꿈
 */
public final class SearchKeyword {

    public static final int MAX_LENGTH = 50;

    private SearchKeyword() {
    }

    /** "  삼성 " → "삼성", "" 또는 null → null, 50자 초과 → 400 */
    public static String normalize(String q) {
        String keyword = (q == null || q.isBlank()) ? null : q.strip();
        if (keyword != null && keyword.length() > MAX_LENGTH) {
            throw new BusinessException(ErrorCode.INVALID_REQUEST);
        }
        return keyword;
    }

    /** LIKE의 특수 문자(\, %, _)를 글자 그대로 찾도록 앞에 \를 붙임. 예: "10%" -> "10\%" */
    public static String escapeLike(String keyword) {
        return keyword == null ? null
                : keyword.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_");
    }
}

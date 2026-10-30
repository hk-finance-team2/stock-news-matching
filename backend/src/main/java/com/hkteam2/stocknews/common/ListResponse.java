package com.hkteam2.stocknews.common;

import java.util.List;

/**
 * 목록 응답 공통 형식: { "items": [...], "totalCount": 123 }
 * totalCount는 페이지와 상관없는 전체 건수입니다.
 */
public record ListResponse<T>(List<T> items, long totalCount) {

    /** 페이지 없이 전부 내려줄 때 사용 (전체 건수 = 목록 크기) */
    public static <T> ListResponse<T> of(List<T> items) {
        return new ListResponse<>(items, items.size());
    }
}

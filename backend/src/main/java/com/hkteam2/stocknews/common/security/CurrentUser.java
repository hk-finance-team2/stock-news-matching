package com.hkteam2.stocknews.common.security;

import org.springframework.security.oauth2.jwt.Jwt;

/**
 * 검사를 통과한 토큰에서 회원 정보를 꺼냄.
 * 회원 ID는 요청 값으로 받지 않고 항상 토큰에서 꺼냄 (남의 ID를 넣어 남의 데이터를 다루지 못하게)
 */
public final class CurrentUser {

    private CurrentUser() {
    }

    public static Long id(Jwt jwt) {
        return Long.valueOf(jwt.getSubject());
    }
}

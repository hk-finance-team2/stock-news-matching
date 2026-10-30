package com.hkteam2.stocknews.user;

/**
 * 로그인 결과. 프론트는 이후 요청 헤더에 "Authorization: Bearer {accessToken}"을 붙임
 *
 * @param expiresIn 토큰 유효 시간(초)
 */
public record LoginResponse(String accessToken, String tokenType, long expiresIn) {

    public static LoginResponse bearer(String accessToken, long expiresIn) {
        return new LoginResponse(accessToken, "Bearer", expiresIn);
    }
}

package com.hkteam2.stocknews.user;

/** 회원가입 결과. 비밀번호는 절대 응답에 넣지 않음 */
public record SignupResponse(Long userId, String loginId) {
}

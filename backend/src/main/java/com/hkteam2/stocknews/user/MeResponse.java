package com.hkteam2.stocknews.user;

/** 현재 로그인한 회원 정보 (토큰에서 꺼냄) */
public record MeResponse(Long userId, String loginId, String role) {
}

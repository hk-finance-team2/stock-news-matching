package com.hkteam2.stocknews.user;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;

/** 로그인 요청. 형식 검사는 가입 때 했으므로 여기서는 비어 있는지만 봄 */
public record LoginRequest(
        @Schema(description = "아이디", example = "tester01")
        @NotBlank(message = "아이디를 입력해 주세요.")
        String loginId,

        @Schema(description = "비밀번호", example = "password123")
        @NotBlank(message = "비밀번호를 입력해 주세요.")
        String password
) {
}

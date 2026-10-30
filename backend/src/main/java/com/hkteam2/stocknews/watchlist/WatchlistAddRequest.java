package com.hkteam2.stocknews.watchlist;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;

/** 관심 종목 추가 요청. 회원 ID는 받지 않음 (토큰에서 꺼냄) */
public record WatchlistAddRequest(
        @Schema(description = "종목코드 6자리", example = "005930")
        @NotBlank(message = "종목코드를 입력해 주세요.")
        @Pattern(regexp = "^[0-9]{6}$", message = "종목코드는 숫자 6자리입니다.")
        String stockCode
) {
}

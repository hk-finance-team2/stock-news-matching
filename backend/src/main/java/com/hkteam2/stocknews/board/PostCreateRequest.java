package com.hkteam2.stocknews.board;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/** 게시글 작성 요청. 작성자는 받지 않음 (토큰에서 꺼냄) */
public record PostCreateRequest(
        @Schema(description = "제목 (200자 이하)", example = "HBM 실적 기대되네요")
        @NotBlank(message = "제목을 입력해 주세요.")
        @Size(max = 200, message = "제목은 200자 이하입니다.")
        String title,

        @Schema(description = "내용 (5000자 이하)", example = "다음 분기 실적 발표가 기대됩니다.")
        @NotBlank(message = "내용을 입력해 주세요.")
        @Size(max = 5000, message = "내용은 5000자 이하입니다.")
        String content
) {
}

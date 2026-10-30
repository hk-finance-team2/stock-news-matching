package com.hkteam2.stocknews.board;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/** 댓글 작성 요청. 작성자는 받지 않음 (토큰에서 꺼냄) */
public record CommentCreateRequest(
        @Schema(description = "내용 (1000자 이하)", example = "저도 그렇게 봐요")
        @NotBlank(message = "댓글 내용을 입력해 주세요.")
        @Size(max = 1000, message = "댓글은 1000자 이하입니다.")
        String content
) {
}

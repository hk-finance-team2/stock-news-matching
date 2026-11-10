package com.hkteam2.stocknews.common.error;

import static org.assertj.core.api.Assertions.assertThat;

import java.io.IOException;

import org.junit.jupiter.api.Test;
import org.springframework.http.converter.HttpMessageNotWritableException;
import org.springframework.web.context.request.async.AsyncRequestNotUsableException;

/** 브라우저가 먼저 끊은 연결(Broken pipe)은 오류로 남기지 않음 (2026-11-10, 실시간 방송 화면을 닫을 때마다 ERROR 가 쌓였음) */
class GlobalExceptionHandlerTest {

    private final GlobalExceptionHandler handler = new GlobalExceptionHandler();

    @Test
    void 브라우저가_먼저_끊은_연결은_응답도_오류_기록도_없다() {
        // 11/10 로그와 같은 모양: JSON 쓰기 실패 ← 응답을 더 쓸 수 없음 ← Broken pipe
        Exception gone = new HttpMessageNotWritableException("Could not write JSON",
                new AsyncRequestNotUsableException("ServletOutputStream failed to write", new IOException("Broken pipe")));
        assertThat(GlobalExceptionHandler.clientGone(gone)).isTrue();
        assertThat(handler.handleUnexpected(gone)).isNull();
    }

    @Test
    void 진짜_예상_못한_오류는_그대로_500() {
        Exception bug = new IllegalStateException("버그", new IOException("디스크 오류"));
        assertThat(GlobalExceptionHandler.clientGone(bug)).isFalse();
        assertThat(handler.handleUnexpected(bug).getStatusCode().value()).isEqualTo(500);
    }
}

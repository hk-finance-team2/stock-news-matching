package com.hkteam2.stocknews.common.error;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.validation.FieldError;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.MissingServletRequestParameterException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;
import org.springframework.web.servlet.resource.NoResourceFoundException;

/** 모든 Controller에서 난 예외를 잡아 { code, message } 형식으로 바꿔 응답 */
@RestControllerAdvice
public class GlobalExceptionHandler {

    private static final Logger log = LoggerFactory.getLogger(GlobalExceptionHandler.class);

    /** 서비스에서 일부러 던진 오류 (종목 없음 등) */
    @ExceptionHandler(BusinessException.class)
    public ResponseEntity<ErrorResponse> handleBusiness(BusinessException e) {
        return toResponse(e.getErrorCode());
    }

    /** 필수 값 누락, 타입이 다른 값 (숫자 자리에 글자 등), 깨진 JSON */
    @ExceptionHandler({MissingServletRequestParameterException.class, MethodArgumentTypeMismatchException.class,
            HttpMessageNotReadableException.class})
    public ResponseEntity<ErrorResponse> handleBadRequest(Exception e) {
        return toResponse(ErrorCode.INVALID_REQUEST);
    }

    /** @Valid 검사 실패. 어떤 규칙을 어겼는지 첫 번째 메시지를 그대로 알려 줌 */
    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<ErrorResponse> handleValidation(MethodArgumentNotValidException e) {
        FieldError fieldError = e.getBindingResult().getFieldError();
        String message = fieldError != null ? fieldError.getDefaultMessage() : ErrorCode.INVALID_REQUEST.getMessage();
        return ResponseEntity.status(ErrorCode.INVALID_REQUEST.getStatus())
                .contentType(MediaType.APPLICATION_JSON)
                .body(new ErrorResponse(ErrorCode.INVALID_REQUEST.name(), message));
    }

    /** 없는 주소 */
    @ExceptionHandler(NoResourceFoundException.class)
    public ResponseEntity<ErrorResponse> handleNotFound(NoResourceFoundException e) {
        return toResponse(ErrorCode.NOT_FOUND);
    }

    /** 예상하지 못한 오류. 원인은 로그에만 남기고 사용자에게는 일반 메시지 */
    @ExceptionHandler(Exception.class)
    public ResponseEntity<ErrorResponse> handleUnexpected(Exception e) {
        if (clientGone(e)) {
            // 브라우저가 먼저 연결을 끊음 (실시간 방송 화면을 닫음, 응답 중 새로 고침 등). 오류가 아니고 응답도 보낼 곳이 없음
            // (2026-11-10: 화면을 닫을 때마다 "처리하지 못한 예외 … Broken pipe" ERROR 가 쌓여 진짜 오류를 가렸음)
            log.debug("브라우저가 먼저 연결을 끊음: {}", e.getMessage());
            return null;
        }
        log.error("처리하지 못한 예외", e);
        return toResponse(ErrorCode.INTERNAL_ERROR);
    }

    /** 원인을 따라가 보면 "응답을 더 쓸 수 없음"(Spring AsyncRequestNotUsableException)이나 연결 끊김(ClientAbortException)인가 */
    static boolean clientGone(Throwable e) {
        for (Throwable t = e; t != null; t = t.getCause()) {
            if (t instanceof org.springframework.web.context.request.async.AsyncRequestNotUsableException
                    || "ClientAbortException".equals(t.getClass().getSimpleName())) {
                return true;
            }
        }
        return false;
    }

    /**
     * 오류 응답은 항상 JSON 이라고 못 박음: 실시간 방송(SSE)을 브라우저가 Accept: text/event-stream 으로 부르면
     * 형식을 고르는 단계에서 JSON 을 못 내보내 오류 처리 자체가 실패했음 (2026-11-10). 형식을 정해 두면 그 단계를 건너뜀
     */
    private ResponseEntity<ErrorResponse> toResponse(ErrorCode errorCode) {
        return ResponseEntity.status(errorCode.getStatus()).contentType(MediaType.APPLICATION_JSON).body(ErrorResponse.of(errorCode));
    }
}

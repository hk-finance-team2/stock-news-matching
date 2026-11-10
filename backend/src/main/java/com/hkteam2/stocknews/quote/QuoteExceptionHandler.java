package com.hkteam2.stocknews.quote;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.client.RestClientException;
import org.springframework.web.context.request.async.AsyncRequestNotUsableException;

import com.hkteam2.stocknews.common.error.ErrorResponse;

/**
 * 시세 API 전용 오류 응답 (공통 ErrorCode를 고치지 않고 이 패키지 안에서 처리)
 * 모양은 팀 공통 { code, message } 그대로
 *
 * | 상황 | 상태 | code |
 * | 스위치 꺼짐 | 503 | QUOTE_DISABLED |
 * | KIS 초당 호출 초과 (다시 시도해도 안 됨) | 429 | QUOTE_BUSY |
 * | KIS가 오류로 답함 | 502 | QUOTE_UPSTREAM_ERROR |
 * | KIS에 닿지 못함 (시간 초과 등) | 502 | QUOTE_UNREACHABLE |
 * 종목이 없으면 공통 처리의 404 STOCK_NOT_FOUND
 */
@RestControllerAdvice(assignableTypes = QuoteController.class)
@Order(Ordered.HIGHEST_PRECEDENCE)
public class QuoteExceptionHandler {

    private static final Logger log = LoggerFactory.getLogger(QuoteExceptionHandler.class);

    @ExceptionHandler(QuoteDisabledException.class)
    public ResponseEntity<ErrorResponse> disabled(QuoteDisabledException e) {
        return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE)
                .contentType(MediaType.APPLICATION_JSON)
                .body(new ErrorResponse("QUOTE_DISABLED", "이 서버에서는 시세 기능이 꺼져 있습니다. (KIS_ENABLED)"));
    }

    @ExceptionHandler(ReplayBusyException.class)
    public ResponseEntity<ErrorResponse> replayBusy(ReplayBusyException e) {
        return ResponseEntity.status(HttpStatus.TOO_MANY_REQUESTS)
                .contentType(MediaType.APPLICATION_JSON)
                .body(new ErrorResponse("REPLAY_BUSY", "다시 보기가 많이 돌고 있습니다. 잠시 후 다시 시도해 주세요."));
    }

    @ExceptionHandler(KisApiException.class)
    public ResponseEntity<ErrorResponse> kisError(KisApiException e) {
        log.warn("KIS 오류: {}", e.getMessage());
        if ("EGW00201".equals(e.code())) {
            return ResponseEntity.status(HttpStatus.TOO_MANY_REQUESTS)
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(new ErrorResponse("QUOTE_BUSY", "시세 요청이 몰렸습니다. 잠시 후 다시 시도해 주세요."));
        }
        return ResponseEntity.status(HttpStatus.BAD_GATEWAY)
                .contentType(MediaType.APPLICATION_JSON)
                .body(new ErrorResponse("QUOTE_UPSTREAM_ERROR", "시세를 받아 오지 못했습니다. (KIS " + e.code() + ")"));
    }

    /**
     * 방송(SSE) 중 브라우저가 떠나 응답을 더 쓸 수 없음 → 정상적인 끊김이라 아무것도 하지 않음
     * (공통 처리로 가면 text/event-stream 응답에 JSON 오류를 쓰려다 경고가 한 번 더 남)
     */
    @ExceptionHandler(AsyncRequestNotUsableException.class)
    public void streamClosed(AsyncRequestNotUsableException e) {
        log.debug("방송 연결 끊김: {}", e.getMessage());
    }

    @ExceptionHandler(RestClientException.class)
    public ResponseEntity<ErrorResponse> unreachable(RestClientException e) {
        // 근본 원인까지 남김: 11/10 15:18 에 7초 동안 9건이 실패했는데 예외 이름만 있어 원인(끊김·거부·이름 찾기 등)을 알 수 없었음
        Throwable root = e;
        while (root.getCause() != null && root.getCause() != root) {
            root = root.getCause();
        }
        log.warn("KIS 연결 실패: {} ← {}: {}", e.getClass().getSimpleName(), root.getClass().getSimpleName(), root.getMessage());
        return ResponseEntity.status(HttpStatus.BAD_GATEWAY)
                .contentType(MediaType.APPLICATION_JSON)
                .body(new ErrorResponse("QUOTE_UNREACHABLE", "시세 서버(KIS)에 연결하지 못했습니다."));
    }
}

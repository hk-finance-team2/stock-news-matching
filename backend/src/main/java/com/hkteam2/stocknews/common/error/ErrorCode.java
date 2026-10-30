package com.hkteam2.stocknews.common.error;

import org.springframework.http.HttpStatus;

/**
 * 오류 종류 목록. 응답의 code 값은 이 이름 그대로 나갑니다.
 * 새 오류가 필요하면 여기에 한 줄 추가합니다.
 */
public enum ErrorCode {

    // 공통
    INVALID_REQUEST(HttpStatus.BAD_REQUEST, "요청 값이 올바르지 않습니다."),
    INVALID_PAGE(HttpStatus.BAD_REQUEST, "page는 1 이상, size는 1~100이어야 합니다."),
    NOT_FOUND(HttpStatus.NOT_FOUND, "요청한 주소를 찾을 수 없습니다."),
    UNAUTHORIZED(HttpStatus.UNAUTHORIZED, "로그인이 필요합니다. 토큰이 없거나 만료되었습니다."),
    FORBIDDEN(HttpStatus.FORBIDDEN, "권한이 없습니다."),
    INTERNAL_ERROR(HttpStatus.INTERNAL_SERVER_ERROR, "서버 오류가 발생했습니다."),

    // 종목
    STOCK_NOT_FOUND(HttpStatus.NOT_FOUND, "종목을 찾을 수 없습니다."),

    // 회원
    DUPLICATE_LOGIN_ID(HttpStatus.CONFLICT, "이미 사용 중인 아이디입니다."),
    // 아이디가 틀렸는지 비밀번호가 틀렸는지 알려 주지 않음 (아이디 존재 여부를 숨김)
    INVALID_CREDENTIALS(HttpStatus.UNAUTHORIZED, "아이디 또는 비밀번호가 올바르지 않습니다."),

    // 관심 종목
    ALREADY_IN_WATCHLIST(HttpStatus.CONFLICT, "이미 관심 종목에 있습니다."),
    WATCHLIST_NOT_FOUND(HttpStatus.NOT_FOUND, "관심 종목에 없는 종목입니다."),

    // 게시판
    POST_NOT_FOUND(HttpStatus.NOT_FOUND, "게시글을 찾을 수 없습니다."),
    NOT_POST_OWNER(HttpStatus.FORBIDDEN, "본인 글만 삭제할 수 있습니다."),
    COMMENT_NOT_FOUND(HttpStatus.NOT_FOUND, "댓글을 찾을 수 없습니다."),
    NOT_COMMENT_OWNER(HttpStatus.FORBIDDEN, "본인 댓글만 삭제할 수 있습니다.");

    private final HttpStatus status;
    private final String message;

    ErrorCode(HttpStatus status, String message) {
        this.status = status;
        this.message = message;
    }

    public HttpStatus getStatus() {
        return status;
    }

    public String getMessage() {
        return message;
    }
}

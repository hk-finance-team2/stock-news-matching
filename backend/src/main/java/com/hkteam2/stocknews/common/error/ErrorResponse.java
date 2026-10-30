package com.hkteam2.stocknews.common.error;

/** 실패 응답 공통 형식: { "code": "STOCK_NOT_FOUND", "message": "종목을 찾을 수 없습니다." } */
public record ErrorResponse(String code, String message) {

    public static ErrorResponse of(ErrorCode errorCode) {
        return new ErrorResponse(errorCode.name(), errorCode.getMessage());
    }
}

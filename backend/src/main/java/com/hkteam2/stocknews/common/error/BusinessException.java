package com.hkteam2.stocknews.common.error;

/**
 * 서비스 코드에서 "정해진 오류"를 알릴 때 던지는 예외.
 * 예: throw new BusinessException(ErrorCode.STOCK_NOT_FOUND);
 */
public class BusinessException extends RuntimeException {

    private final ErrorCode errorCode;

    public BusinessException(ErrorCode errorCode) {
        super(errorCode.getMessage());
        this.errorCode = errorCode;
    }

    public ErrorCode getErrorCode() {
        return errorCode;
    }
}

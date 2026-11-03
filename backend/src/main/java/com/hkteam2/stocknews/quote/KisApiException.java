package com.hkteam2.stocknews.quote;

/**
 * KIS가 오류로 답했을 때. code 예: EGW00201(초당 호출 초과), EGW00133(토큰 발급 1분 제한)
 * 메시지에는 KIS가 돌려준 오류 코드·설명만 담음 (요청 헤더의 키·토큰은 담지 않음)
 */
public class KisApiException extends RuntimeException {

    private final String code;

    public KisApiException(String code, String message) {
        super("[" + code + "] " + message);
        this.code = code;
    }

    public String code() {
        return code;
    }
}

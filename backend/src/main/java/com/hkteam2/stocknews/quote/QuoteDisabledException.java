package com.hkteam2.stocknews.quote;

/** 이 서버에서 시세 기능이 꺼져 있음 (KIS_ENABLED 가 true 가 아님) */
public class QuoteDisabledException extends RuntimeException {

    public QuoteDisabledException() {
        super("시세 기능이 꺼져 있습니다");
    }
}

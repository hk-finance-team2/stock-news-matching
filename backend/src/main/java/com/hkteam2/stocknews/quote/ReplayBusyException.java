package com.hkteam2.stocknews.quote;

/** 동시에 돌 수 있는 다시 보기 수를 넘음 */
public class ReplayBusyException extends RuntimeException {

    public ReplayBusyException() {
        super("다시 보기가 너무 많이 돌고 있습니다");
    }
}

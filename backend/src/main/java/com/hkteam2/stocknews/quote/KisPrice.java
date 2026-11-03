package com.hkteam2.stocknews.quote;

import java.math.BigDecimal;

/**
 * 종목 현재가 한 번 조회한 결과 (KIS 주식현재가 시세 inquire-price 의 필요한 칸)
 * changeSign: KIS 전일 대비 부호 코드 그대로 (1 상한, 2 상승, 3 보합, 4 하한, 5 하락). 화면용 변환은 나중에
 */
public record KisPrice(
        String stockCode,
        long price,
        long changeAmount,
        String changeSign,
        BigDecimal changeRate,
        long accVolume,
        long open,
        long high,
        long low
) {
}

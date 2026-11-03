package com.hkteam2.stocknews.quote;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;

/**
 * 급등·급락한 날 고르기 (F-17). KIS·DB 없이 계산만 → 단위 테스트로 바로 확인
 *
 * 등락률 = (그날 종가 - 전날 종가) / 전날 종가 × 100, 소수 둘째 자리 반올림
 * 일봉은 수정주가(액면분할 등을 반영해 옛 가격을 고친 값)라 분할한 날이 폭락으로 잡히지 않음
 */
final class BigMoveFinder {

    /** 큰 움직임 하루. changeAmount·changeRate는 하락이면 음수 */
    record BigMove(LocalDate date, long close, long changeAmount, BigDecimal changeRate, long volume) {
    }

    private BigMoveFinder() {
    }

    /**
     * @param candles   일봉, 오래된 것부터 (맨 앞 봉은 "전날 종가"로만 쓰임)
     * @param threshold 기준 % (예: 5 → +5% 이상 또는 -5% 이하)
     * @return 기준을 넘은 날, 오래된 것부터
     */
    static List<BigMove> find(List<KisCandle> candles, BigDecimal threshold) {
        List<BigMove> out = new ArrayList<>();
        for (int i = 1; i < candles.size(); i++) {
            long prevClose = candles.get(i - 1).close();
            KisCandle today = candles.get(i);
            if (prevClose <= 0) {
                continue;   // 거래 정지 등으로 값이 없으면 계산하지 않음
            }
            long change = today.close() - prevClose;
            BigDecimal rate = BigDecimal.valueOf(change * 100).divide(BigDecimal.valueOf(prevClose), 2, RoundingMode.HALF_UP);
            if (rate.abs().compareTo(threshold) >= 0) {
                out.add(new BigMove(today.time().toLocalDate(), today.close(), change, rate, today.volume()));
            }
        }
        return out;
    }
}

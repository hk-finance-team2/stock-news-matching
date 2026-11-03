package com.hkteam2.stocknews.quote;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.List;

/**
 * KIS 실시간 체결 메시지 읽기
 *
 * 모양: "0|H0STCNT0|002|칸^칸^…"
 *   ① 0 = 암호화 안 됨 (1이면 암호화, 체결가 데이터는 0)
 *   ② tr_id (H0STCNT0 = 국내주식 실시간 체결가)
 *   ③ 이 메시지에 든 체결 건수 (여러 건이 한 줄로 묶여 올 수 있음)
 *   ④ 데이터: 체결 한 건당 47칸을 ^로 이은 것 × 건수
 * 칸 순서: KIS 공식 예제 domestic_stock_functions_ws.py 의 ccnl_krx columns
 *
 * 읽지 못하면 Result.error 에 이유를 담아 돌려줌 → 받는 쪽이 격리함(quote_quarantine)에 원문 보관
 */
public final class TickParser {

    static final String TR_ID = "H0STCNT0";
    static final int FIELDS_PER_TICK = 47;

    // 47칸 중 쓰는 칸의 위치 (0부터)
    private static final int CODE = 0;          // MKSC_SHRN_ISCD 종목코드
    private static final int TIME = 1;          // STCK_CNTG_HOUR 체결 시각 HHMMSS
    private static final int PRICE = 2;         // STCK_PRPR 현재가
    private static final int SIGN = 3;          // PRDY_VRSS_SIGN 전일 대비 부호
    private static final int CHANGE = 4;        // PRDY_VRSS 전일 대비
    private static final int RATE = 5;          // PRDY_CTRT 전일 대비율
    private static final int OPEN = 7;          // STCK_OPRC 시가
    private static final int HIGH = 8;          // STCK_HGPR 고가
    private static final int LOW = 9;           // STCK_LWPR 저가
    private static final int VOLUME = 12;       // CNTG_VOL 체결 거래량
    private static final int ACC_VOLUME = 13;   // ACML_VOL 누적 거래량
    private static final int ACC_AMOUNT = 14;   // ACML_TR_PBMN 누적 거래대금
    private static final int SIDE = 21;         // CCLD_DVSN 체결 구분
    private static final int DATE = 33;         // BSOP_DATE 영업일자 YYYYMMDD

    private static final DateTimeFormatter YMD = DateTimeFormatter.BASIC_ISO_DATE;
    private static final DateTimeFormatter HMS = DateTimeFormatter.ofPattern("HHmmss");

    /** ticks 또는 error 중 하나만 있음 */
    public record Result(List<RealtimeTick> ticks, String error) {
        static Result ok(List<RealtimeTick> ticks) {
            return new Result(ticks, null);
        }

        static Result fail(String reason) {
            return new Result(List.of(), reason);
        }
    }

    private TickParser() {
    }

    /** 실시간 데이터 줄인지 (첫 글자가 0 또는 1이고 | 가 있음). 아니면 JSON 제어 메시지 */
    public static boolean isData(String raw) {
        return raw != null && raw.length() > 2 && (raw.charAt(0) == '0' || raw.charAt(0) == '1') && raw.charAt(1) == '|';
    }

    public static Result parse(String raw, LocalDateTime receivedAt) {
        String[] parts = raw.split("\\|", 4);
        if (parts.length != 4) {
            return Result.fail("| 로 나눈 덩어리가 4개가 아님");
        }
        if (!"0".equals(parts[0])) {
            return Result.fail("암호화된 메시지 (체결가는 암호화되지 않아야 함)");
        }
        if (!TR_ID.equals(parts[1])) {
            return Result.fail("모르는 tr_id: " + parts[1]);
        }
        int count;
        try {
            count = Integer.parseInt(parts[2]);
        } catch (NumberFormatException e) {
            return Result.fail("건수가 숫자가 아님: " + parts[2]);
        }
        String[] f = parts[3].split("\\^", -1);
        if (count <= 0 || f.length != count * FIELDS_PER_TICK) {
            return Result.fail("칸 개수가 맞지 않음: 건수 " + count + ", 칸 " + f.length + " (한 건 " + FIELDS_PER_TICK + "칸)");
        }
        List<RealtimeTick> ticks = new ArrayList<>(count);
        try {
            for (int i = 0; i < count; i++) {
                int b = i * FIELDS_PER_TICK;
                LocalDate date = LocalDate.parse(f[b + DATE], YMD);
                ticks.add(new RealtimeTick(
                        f[b + CODE],
                        date,
                        date.atTime(LocalTime.parse(f[b + TIME], HMS)),
                        toLong(f[b + PRICE]),
                        f[b + SIGN],
                        toLong(f[b + CHANGE]),
                        new BigDecimal(f[b + RATE].strip()),
                        toLong(f[b + OPEN]),
                        toLong(f[b + HIGH]),
                        toLong(f[b + LOW]),
                        toLong(f[b + VOLUME]),
                        toLong(f[b + ACC_VOLUME]),
                        toLong(f[b + ACC_AMOUNT]),
                        f[b + SIDE],
                        receivedAt));
            }
        } catch (RuntimeException e) {
            return Result.fail("값을 읽지 못함: " + e.getClass().getSimpleName());
        }
        return Result.ok(ticks);
    }

    private static long toLong(String s) {
        return Long.parseLong(s.strip());
    }
}

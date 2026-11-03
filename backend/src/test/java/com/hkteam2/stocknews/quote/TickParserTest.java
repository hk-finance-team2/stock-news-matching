package com.hkteam2.stocknews.quote;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.LocalDateTime;
import java.util.Arrays;
import java.util.List;

import org.junit.jupiter.api.Test;

/** KIS 실시간 체결 메시지 읽기. 칸 순서는 공식 예제(ccnl_krx) 기준 47칸 */
class TickParserTest {

    private static final LocalDateTime RECEIVED = LocalDateTime.of(2026, 11, 3, 11, 50, 0, 123_000_000);

    /** 체결 한 건 47칸 (쓰는 칸만 값을 넣고 나머지는 0) */
    static String tick(String code, String time, long price, long volume, long accVolume) {
        String[] f = new String[TickParser.FIELDS_PER_TICK];
        Arrays.fill(f, "0");
        f[0] = code;
        f[1] = time;
        f[2] = String.valueOf(price);
        f[3] = "5";
        f[4] = "-7000";
        f[5] = "-3.06";
        f[7] = "220500";
        f[8] = "223000";
        f[9] = "217000";
        f[12] = String.valueOf(volume);
        f[13] = String.valueOf(accVolume);
        f[14] = "1322333498750";
        f[21] = "1";
        f[33] = "20261103";
        return String.join("^", f);
    }

    @Test
    void 체결_한_건을_읽는다() {
        TickParser.Result r = TickParser.parse("0|H0STCNT0|001|" + tick("005930", "115001", 222000, 10, 6200000), RECEIVED);
        assertThat(r.error()).isNull();
        RealtimeTick t = r.ticks().get(0);
        assertThat(t.stockCode()).isEqualTo("005930");
        assertThat(t.tradedAt()).isEqualTo(LocalDateTime.of(2026, 11, 3, 11, 50, 1));
        assertThat(t.price()).isEqualTo(222000);
        assertThat(t.changeAmount()).isEqualTo(-7000);
        assertThat(t.changeRate()).isEqualByComparingTo("-3.06");
        assertThat(t.volume()).isEqualTo(10);
        assertThat(t.accVolume()).isEqualTo(6200000);
        assertThat(t.receivedAt()).isEqualTo(RECEIVED);
    }

    @Test
    void 한_줄에_여러_건이_묶여_와도_다_읽는다() {
        String two = tick("005930", "115001", 222000, 10, 6200000) + "^" + tick("005930", "115001", 221750, 3, 6200003);
        TickParser.Result r = TickParser.parse("0|H0STCNT0|002|" + two, RECEIVED);
        assertThat(r.error()).isNull();
        assertThat(r.ticks()).extracting(RealtimeTick::accVolume).containsExactly(6200000L, 6200003L);
    }

    @Test
    void 이상한_줄은_이유와_함께_실패() {
        assertThat(TickParser.parse("0|H0STCNT0|002|" + tick("005930", "115001", 1, 1, 1), RECEIVED).error())
                .contains("칸 개수");   // 2건이라더니 1건뿐
        assertThat(TickParser.parse("0|H0STASP0|001|" + tick("005930", "115001", 1, 1, 1), RECEIVED).error())
                .contains("tr_id");
        assertThat(TickParser.parse("1|H0STCNT0|001|암호문", RECEIVED).error()).contains("암호화");
        assertThat(TickParser.parse("0|H0STCNT0|001|" + tick("005930", "99xx99", 1, 1, 1), RECEIVED).error())
                .contains("값을 읽지 못함");
    }

    @Test
    void 데이터_줄과_JSON_제어_메시지를_구분() {
        assertThat(TickParser.isData("0|H0STCNT0|001|...")).isTrue();
        assertThat(TickParser.isData("{\"header\":{\"tr_id\":\"PINGPONG\"}}")).isFalse();
        assertThat(List.of("", "0", "0x")).noneMatch(TickParser::isData);
    }
}

package com.hkteam2.stocknews.quote;

import static org.assertj.core.api.Assertions.assertThat;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

import com.hkteam2.stocknews.support.ApiTestSupport;

/**
 * 실시간 시세 저장 SQL (V10). 테스트 트랜잭션이라 끝나면 되돌려짐
 * 핵심: 같은 체결은 한 번만(Idempotent), 늦게 온 옛 체결은 현재가를 덮지 않음
 */
class QuoteMapperTest extends ApiTestSupport {

    private static final LocalDate DAY = LocalDate.of(2026, 11, 3);

    @Autowired
    QuoteMapper mapper;

    static RealtimeTick tick(long price, long accVolume, int second) {
        LocalDateTime at = DAY.atTime(11, 50, second);
        return new RealtimeTick("005930", DAY, at, price, "5", price - 229000, new BigDecimal("-3.06"),
                220500, 223000, 217000, 1, accVolume, 1_000_000L, "1", at.plusNanos(50_000_000));
    }

    @Test
    void 같은_체결이_다시_와도_한_번만_저장() {
        jdbc.update("DELETE FROM quote_tick WHERE trade_date = ?", DAY);
        assertThat(mapper.insertTicks(List.of(tick(222000, 100, 1), tick(221500, 101, 2)))).isEqualTo(2);
        // 재접속 후 같은 체결(누적 거래량 101)이 또 옴 + 새 체결 1건
        assertThat(mapper.insertTicks(List.of(tick(221500, 101, 2), tick(221750, 105, 3)))).isEqualTo(1);
        assertThat(mapper.countTicks(DAY)).isEqualTo(3);
    }

    @Test
    void 현재가는_더_나중_체결로만_바뀐다() {
        jdbc.update("DELETE FROM quote_snapshot WHERE stock_code = '005930'");
        LocalDateTime now = LocalDateTime.of(2026, 11, 3, 11, 50, 5);
        mapper.upsertSnapshots(List.of(tick(222000, 200, 10)), now);
        mapper.upsertSnapshots(List.of(tick(210000, 150, 4)), now);   // 늦게 도착한 옛 체결
        assertThat(mapper.findSnapshot("005930").price()).isEqualTo(222000);
        mapper.upsertSnapshots(List.of(tick(223000, 250, 20)), now);  // 새 체결
        QuoteSnapshotRow s = mapper.findSnapshot("005930");
        assertThat(s.price()).isEqualTo(223000);
        assertThat(s.accVolume()).isEqualTo(250);
    }

    @Test
    void 날이_바뀌면_어제_누적_거래량이_커도_오늘_체결로_바뀐다() {
        // 11/04 리허설에서 발견: 어제 마지막 현재가(누적 1,300만)가 남은 채 오늘 첫 체결(누적 520만)이 오면
        // 날짜만 바뀌고 누적 거래량은 어제 값으로 남아, 그날 내내 현재가가 안 바뀌던 문제
        jdbc.update("DELETE FROM quote_snapshot WHERE stock_code = '005930'");
        LocalDateTime now = LocalDateTime.of(2026, 11, 3, 15, 30);
        mapper.upsertSnapshots(List.of(tick(216000, 13_066_765, 0)), now);   // 어제(DAY) 장 마감 값

        LocalDate today = DAY.plusDays(1);
        RealtimeTick first = todayTick(today, 216250, 5_200_000);
        RealtimeTick second = todayTick(today, 216750, 5_300_000);
        mapper.upsertSnapshots(List.of(first), now.plusHours(19));
        mapper.upsertSnapshots(List.of(second), now.plusHours(19).plusSeconds(1));

        QuoteSnapshotRow s = mapper.findSnapshot("005930");
        assertThat(s.tradedAt().toLocalDate()).isEqualTo(today);
        assertThat(s.price()).isEqualTo(216750);   // 두 번째 체결까지 반영
        assertThat(s.accVolume()).isEqualTo(5_300_000);
    }

    static RealtimeTick todayTick(LocalDate day, long price, long accVolume) {
        LocalDateTime at = day.atTime(10, 33);
        return new RealtimeTick("005930", day, at, price, "5", price - 219500, new BigDecimal("-1.25"),
                226500, 228000, 215500, 1, accVolume, 1_000_000L, "1", at.plusNanos(50_000_000));
    }

    @Test
    void 읽지_못한_메시지는_격리함에() {
        long before = mapper.countQuarantine();
        mapper.insertQuarantine("0|H0STCNT0|002|깨진 줄", "칸 개수가 맞지 않음", LocalDateTime.of(2026, 11, 3, 11, 50));
        assertThat(mapper.countQuarantine()).isEqualTo(before + 1);
    }
}

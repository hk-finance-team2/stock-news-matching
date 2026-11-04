package com.hkteam2.stocknews.quote;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.time.LocalDate;
import java.util.List;

import org.junit.jupiter.api.Test;

/**
 * 시세 캐시 이름표가 서로 겹치지 않는지. KIS 대신 가짜(mock)가 일봉·년봉을 돌려줌 (DB·네트워크 없음)
 * 예전 버그: 급등·급락 이력의 1년 치 일봉과 년봉 차트가 같은 이름표("year:005930")를 써서
 * 급등락을 먼저 본 뒤 "년"을 누르면 일봉 목록을 차트로 꺼내다 500
 */
class QuoteServiceCacheTest {

    @Test
    void 급등락_1년_일봉을_먼저_불러도_년봉_차트는_따로() {
        KisRestClient kis = mock(KisRestClient.class);
        KisCandle day = new KisCandle(LocalDate.of(2026, 11, 3).atStartOfDay(), 100, 110, 90, 105, 5000);
        KisCandle year = new KisCandle(LocalDate.of(2026, 1, 2).atStartOfDay(), 80, 120, 70, 105, 900000);
        when(kis.inquireDailyCandles(eq("005930"), any(), any())).thenReturn(List.of(day));
        when(kis.inquirePeriodCandles(eq("005930"), any(), any(), anyString())).thenReturn(List.of(year));
        QuoteService service = new QuoteService(kis, null, null, null, null, null, null);

        assertThat(service.yearDailyCandles("005930")).containsExactly(day);
        ChartResponse chart = service.periodChart("005930", ChartUnit.YEAR);

        assertThat(chart.unit()).isEqualTo("year");
        assertThat(chart.items()).hasSize(1);
        assertThat(chart.items().get(0).volume()).isEqualTo(900000);
    }

    @Test
    void 일봉_첫_화면은_급등락과_같은_1년_캐시라_KIS를_더_부르지_않는다() {
        KisRestClient kis = mock(KisRestClient.class);
        KisCandle day = new KisCandle(LocalDate.of(2026, 11, 3).atStartOfDay(), 100, 110, 90, 105, 5000);
        when(kis.inquireDailyCandles(eq("005930"), any(), any())).thenReturn(List.of(day));
        QuoteService service = new QuoteService(kis, null, null, null, null, null, null);

        service.yearDailyCandles("005930");                       // 급등·급락 이력이 먼저 채움 (140일씩 3번)
        verify(kis, times(3)).inquireDailyCandles(eq("005930"), any(), any());
        ChartResponse chart = service.periodChart("005930", ChartUnit.DAY);

        assertThat(chart.unit()).isEqualTo("day");
        assertThat(chart.items()).hasSize(1);
        verify(kis, times(3)).inquireDailyCandles(eq("005930"), any(), any());   // 그대로 3번
        verify(kis, never()).inquirePeriodCandles(any(), any(), any(), anyString());
    }

    @Test
    void 이어_받기는_to까지_KIS_1번이고_같은_to는_캐시() {
        KisRestClient kis = mock(KisRestClient.class);
        LocalDate to = LocalDate.of(2025, 10, 31);
        KisCandle newer = new KisCandle(LocalDate.of(2025, 10, 31).atStartOfDay(), 100, 110, 90, 105, 5000);
        KisCandle older = new KisCandle(LocalDate.of(2025, 10, 30).atStartOfDay(), 90, 100, 80, 100, 4000);
        // KIS는 최신이 앞에 옴 → 응답은 오래된 것부터
        when(kis.inquirePeriodCandles("005930", to.minusDays(150), to, "D")).thenReturn(List.of(newer, older));
        QuoteService service = new QuoteService(kis, null, null, null, null, null, null);

        ChartResponse chart = service.periodChart("005930", ChartUnit.DAY, to);
        service.periodChart("005930", ChartUnit.DAY, to);          // 두 번째는 캐시
        service.periodChart("005930", ChartUnit.DAY, to.minusDays(100));   // 다른 to는 따로

        assertThat(chart.items()).extracting(ChartResponse.Candle::close).containsExactly(100L, 105L);
        verify(kis, times(1)).inquirePeriodCandles("005930", to.minusDays(150), to, "D");
        verify(kis, times(2)).inquirePeriodCandles(eq("005930"), any(), any(), eq("D"));
    }
}

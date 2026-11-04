package com.hkteam2.stocknews.quote;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.time.LocalDate;
import java.time.LocalTime;
import java.util.List;

import org.junit.jupiter.api.Test;

/**
 * 분봉 하루치를 구간 4개로 나눠 한꺼번에 묻고 합치는지 (QA #7). KIS 대신 가짜(mock) (DB·네트워크 없음)
 * 날짜는 지난 평일(2026-11-03 화)이라 "지금 몇 시인지"와 상관없이 늘 같은 결과
 */
class QuoteServiceMinuteTest {

    private static final LocalDate TUE = LocalDate.of(2026, 11, 3);

    private static KisCandle at(LocalDate d, int h, int m) {
        return new KisCandle(d.atTime(h, m), 100, 110, 90, 105, 10);
    }

    @Test
    void 지난_평일은_구간_4개를_한_번씩_묻고_겹치는_분은_하나로_합친다() {
        KisRestClient kis = mock(KisRestClient.class);
        // KIS처럼 최신이 앞. 15:21~15:29(단일가)는 줄이 없어서 첫 구간이 13:22까지 내려옴 → 둘째 구간과 겹침
        when(kis.inquireMinuteCandles("005930", TUE, LocalTime.of(15, 30)))
                .thenReturn(List.of(at(TUE, 15, 30), at(TUE, 15, 20), at(TUE, 13, 22)));
        when(kis.inquireMinuteCandles("005930", TUE, LocalTime.of(13, 30)))
                .thenReturn(List.of(at(TUE, 13, 30), at(TUE, 13, 22)));
        when(kis.inquireMinuteCandles("005930", TUE, LocalTime.of(11, 30)))
                .thenReturn(List.of(at(TUE, 11, 30)));
        // 장 시작 앞으로 넘어가면 장 전 봉·전날 시간외 봉이 섞여 옴 → 버려야 함
        when(kis.inquireMinuteCandles("005930", TUE, LocalTime.of(9, 30)))
                .thenReturn(List.of(at(TUE, 9, 30), at(TUE, 9, 0), at(TUE, 8, 50), at(TUE.minusDays(1), 18, 10)));
        QuoteService service = new QuoteService(kis, null, null, null, null, null, null);

        List<KisCandle> day = service.oneMinuteCandles("005930", TUE);
        service.oneMinuteCandles("005930", TUE);   // 두 번째는 캐시

        assertThat(day).extracting(c -> c.time().toLocalTime()).containsExactly(
                LocalTime.of(9, 0), LocalTime.of(9, 30), LocalTime.of(11, 30), LocalTime.of(13, 22),
                LocalTime.of(13, 30), LocalTime.of(15, 20), LocalTime.of(15, 30));
        verify(kis, times(4)).inquireMinuteCandles(eq("005930"), eq(TUE), any());
    }

    @Test
    void 주말은_KIS에_묻지_않고_빈_목록() {
        KisRestClient kis = mock(KisRestClient.class);
        QuoteService service = new QuoteService(kis, null, null, null, null, null, null);

        assertThat(service.oneMinuteCandles("005930", LocalDate.of(2026, 10, 31))).isEmpty();   // 토
        assertThat(service.oneMinuteCandles("005930", LocalDate.of(2026, 11, 1))).isEmpty();    // 일
        verify(kis, never()).inquireMinuteCandles(any(), any(), any());
    }

    @Test
    void 구간_하나가_KIS_오류면_그_오류가_그대로_나온다() {
        KisRestClient kis = mock(KisRestClient.class);
        when(kis.inquireMinuteCandles(eq("005930"), eq(TUE), any())).thenReturn(List.of(at(TUE, 15, 30)));
        when(kis.inquireMinuteCandles("005930", TUE, LocalTime.of(11, 30)))
                .thenThrow(new KisApiException("EGW00201", "초당 거래건수를 초과하였습니다."));
        QuoteService service = new QuoteService(kis, null, null, null, null, null, null);

        // 감싼 오류(ExecutionException)가 아니라 KIS 오류 그대로여야 화면에 429 QUOTE_BUSY로 나감
        assertThatThrownBy(() -> service.oneMinuteCandles("005930", TUE))
                .isInstanceOfSatisfying(KisApiException.class, e -> assertThat(e.code()).isEqualTo("EGW00201"));
    }
}

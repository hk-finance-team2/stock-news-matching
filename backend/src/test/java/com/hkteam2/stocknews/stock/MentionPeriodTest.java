package com.hkteam2.stocknews.stock;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.time.LocalDateTime;
import java.util.List;

import org.junit.jupiter.api.Test;

import com.hkteam2.stocknews.common.error.BusinessException;

/** 언급량 기간·빈 칸 채우기. "지금"을 11/02 10:42로 고정해서 서버·DB 없이 확인 */
class MentionPeriodTest {

    private static final LocalDateTime NOW = LocalDateTime.of(2026, 11, 2, 10, 42);

    @Test
    void 오늘은_0시부터_지금_시각_칸까지_1시간씩() {
        List<LocalDateTime> buckets = MentionPeriod.TODAY.buckets(NOW);
        assertThat(buckets).hasSize(11);   // 0시, 1시, ..., 10시
        assertThat(buckets.getFirst()).isEqualTo(LocalDateTime.of(2026, 11, 2, 0, 0));
        assertThat(buckets.getLast()).isEqualTo(LocalDateTime.of(2026, 11, 2, 10, 0));
        assertThat(MentionPeriod.TODAY.end(NOW)).isEqualTo(LocalDateTime.of(2026, 11, 2, 11, 0));
    }

    @Test
    void 칠일은_오늘_포함_7칸이고_마지막_칸이_오늘() {
        List<LocalDateTime> buckets = MentionPeriod.WEEK.buckets(NOW);
        assertThat(buckets).hasSize(7);
        assertThat(buckets.getFirst()).isEqualTo(LocalDateTime.of(2026, 10, 27, 0, 0));
        assertThat(buckets.getLast()).isEqualTo(LocalDateTime.of(2026, 11, 2, 0, 0));
        assertThat(MentionPeriod.WEEK.end(NOW)).isEqualTo(LocalDateTime.of(2026, 11, 3, 0, 0));
    }

    @Test
    void 삼십일은_30칸() {
        assertThat(MentionPeriod.MONTH.buckets(NOW)).hasSize(30);
    }

    @Test
    void 정해진_기간이_아니면_400() {
        assertThat(MentionPeriod.from("7d")).isEqualTo(MentionPeriod.WEEK);
        assertThatThrownBy(() -> MentionPeriod.from("1y")).isInstanceOf(BusinessException.class);
    }

    @Test
    void 글이_없는_칸은_0으로_채운다() {
        List<MentionCountRow> rows = List.of(   // SQL 결과: 글이 있는 8시·10시만
                new MentionCountRow(LocalDateTime.of(2026, 11, 2, 8, 0), 1, 1),
                new MentionCountRow(LocalDateTime.of(2026, 11, 2, 10, 0), 1, 0));

        List<MentionPointResponse> items = StockMentionsResponse.fill(MentionPeriod.TODAY.buckets(NOW), rows);

        assertThat(items).hasSize(11);
        assertThat(items.get(8).totalCount()).isEqualTo(2);    // 8시: 뉴스 1 + SNS 1
        assertThat(items.get(9).totalCount()).isZero();        // 9시: 채운 0
        assertThat(items.get(10).newsCount()).isEqualTo(1);    // 10시
        assertThat(items.stream().mapToLong(MentionPointResponse::totalCount).sum()).isEqualTo(3);
        assertThat(items.get(0).time().toString()).isEqualTo("2026-11-02T00:00+09:00");
    }
}

package com.hkteam2.stocknews.stock;

import java.util.List;
import java.util.Map;
import java.util.stream.IntStream;

/**
 * 오늘 이 종목이 나온 글의 감성 비율. positive·negative·neutral은 %(정수)로, 셋의 합은 항상 100.
 * 오늘 글이 없으면 articleCount 0, 비율은 모두 0
 */
public record SentimentRatioResponse(
        long articleCount,
        long positiveCount,
        long negativeCount,
        long neutralCount,
        int positive,
        int negative,
        int neutral
) {

    /** counts: 감성 → 글 수 (SQL GROUP BY 결과). 없는 감성은 0 */
    public static SentimentRatioResponse from(Map<String, Long> counts) {
        long pos = counts.getOrDefault("POSITIVE", 0L);
        long neg = counts.getOrDefault("NEGATIVE", 0L);
        long neu = counts.getOrDefault("NEUTRAL", 0L);
        List<Integer> percents = toPercents(List.of(pos, neg, neu));
        return new SentimentRatioResponse(pos + neg + neu, pos, neg, neu,
                percents.get(0), percents.get(1), percents.get(2));
    }

    /**
     * 개수 → %(정수), 합이 100이 되게 (최대 나머지 방식).
     * 그냥 반올림하면 1:1:1이 33+33+33=99가 됨. 그래서 ① 소수점을 버리고 ② 모자란 만큼을
     * 버린 소수점이 컸던 칸부터 1씩 더함. 예: 33.3, 33.3, 33.3 → 33, 33, 33 → 남은 1을 첫 칸에 → 34, 33, 33
     */
    static List<Integer> toPercents(List<Long> counts) {
        long total = counts.stream().mapToLong(Long::longValue).sum();
        if (total == 0) {
            return counts.stream().map(count -> 0).toList();
        }
        int[] percents = new int[counts.size()];
        int sum = 0;
        for (int i = 0; i < counts.size(); i++) {
            percents[i] = (int) (counts.get(i) * 100 / total);   // 소수점 버림
            sum += percents[i];
        }
        // 버린 소수점(나머지)이 큰 칸부터. 나머지가 같으면 앞 칸(긍정 → 부정 → 중립) 먼저
        List<Integer> order = IntStream.range(0, counts.size()).boxed()
                .sorted((a, b) -> Long.compare(counts.get(b) * 100 % total, counts.get(a) * 100 % total))
                .toList();
        for (int i = 0; sum < 100; i++, sum++) {
            percents[order.get(i)]++;
        }
        return IntStream.of(percents).boxed().toList();
    }
}

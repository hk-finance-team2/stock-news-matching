package com.hkteam2.stocknews.status;

import static org.hamcrest.Matchers.nullValue;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.time.LocalDateTime;

import org.junit.jupiter.api.Test;

import com.hkteam2.stocknews.support.ApiTestSupport;

/** 데이터 상태 GET /api/status (F-16) */
class StatusApiTest extends ApiTestSupport {

    private static final LocalDateTime T = LocalDateTime.of(2026, 11, 2, 10, 0);

    /** AI가 기사를 이 시각에 받았다고 치고 넣기 */
    private void collected(String sourceType, LocalDateTime collectedAt) {
        long id = insertArticle(sourceType + " 글", sourceType, "LISTED", collectedAt);
        jdbc.update("UPDATE article SET collected_at = ? WHERE article_id = ?", collectedAt, id);
    }

    private void run(String status, LocalDateTime startedAt, LocalDateTime finishedAt, int collectedCount) {
        jdbc.update("""
                INSERT INTO collect_run (started_at, finished_at, status, collected_count, summarized_count, error)
                VALUES (?, ?, ?, ?, 0, ?)
                """, startedAt, finishedAt, status, collectedCount, "FAILED".equals(status) ? "RSS 응답 없음" : null);
    }

    @Test
    void 아직_아무_데이터가_없으면_모두_null() throws Exception {
        mvc.perform(get("/api/status"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.newsCollectedAt").value(nullValue()))
                .andExpect(jsonPath("$.snsCollectedAt").value(nullValue()))
                .andExpect(jsonPath("$.summaryGeneratedAt").value(nullValue()))
                .andExpect(jsonPath("$.lastSuccessAt").value(nullValue()))
                .andExpect(jsonPath("$.lastRun").value(nullValue()));
    }

    @Test
    void 뉴스와_SNS는_따로_가장_최근_수집_시각() throws Exception {
        collected("NEWS", T.minusHours(2));
        collected("NEWS", T);                    // 뉴스 중 가장 최근
        collected("SNS", T.minusMinutes(30));    // SNS는 SNS끼리

        mvc.perform(get("/api/status"))
                .andExpect(jsonPath("$.newsCollectedAt").value("2026-11-02T10:00:00+09:00"))
                .andExpect(jsonPath("$.snsCollectedAt").value("2026-11-02T09:30:00+09:00"));
    }

    @Test
    void 요약은_뉴스_요약의_가장_최근_생성_시각() throws Exception {
        String sql = "INSERT INTO stock_daily_summary (stock_code, summary_date, news_summary, sns_summary, generated_at) VALUES (?, ?, ?, ?, ?)";
        jdbc.update(sql, KIA, "2026-11-01", "어제 뉴스 요약", null, T.minusDays(1));
        jdbc.update(sql, NAVER, "2026-11-02", "오늘 뉴스 요약", null, T);
        // SNS가 먼저 만든 줄 (뉴스 요약 없음): 더 늦은 시각이어도 "요약 시각"에 안 들어감
        jdbc.update(sql, KIA, "2026-11-02", null, "SNS 반응 요약", T.plusHours(1));

        mvc.perform(get("/api/status"))
                .andExpect(jsonPath("$.summaryGeneratedAt").value("2026-11-02T10:00:00+09:00"));
    }

    @Test
    void 마지막_성공_시각과_가장_최근_실행은_따로() throws Exception {
        run("SUCCESS", T.minusMinutes(65), T.minusMinutes(60), 12);
        run("SUCCESS", T.minusMinutes(35), T.minusMinutes(30), 8);    // 마지막 성공
        run("FAILED", T.minusMinutes(5), T.minusMinutes(4), 0);        // 가장 최근 실행은 실패

        mvc.perform(get("/api/status"))
                .andExpect(jsonPath("$.lastSuccessAt").value("2026-11-02T09:30:00+09:00"))
                .andExpect(jsonPath("$.lastRun.status").value("FAILED"))
                .andExpect(jsonPath("$.lastRun.startedAt").value("2026-11-02T09:55:00+09:00"))
                .andExpect(jsonPath("$.lastRun.collectedCount").value(0))
                .andExpect(jsonPath("$.lastRun.error").doesNotExist());   // 실패 원인은 안 내보냄
    }

    @Test
    void 수집_중이면_끝난_시각이_null() throws Exception {
        run("RUNNING", T, null, 0);

        mvc.perform(get("/api/status"))
                .andExpect(jsonPath("$.lastRun.status").value("RUNNING"))
                .andExpect(jsonPath("$.lastRun.finishedAt").value(nullValue()))
                .andExpect(jsonPath("$.lastSuccessAt").value(nullValue()));
    }
}

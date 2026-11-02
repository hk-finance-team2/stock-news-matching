package com.hkteam2.stocknews.support;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;

import org.junit.jupiter.api.BeforeEach;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.transaction.annotation.Transactional;

import com.jayway.jsonpath.JsonPath;

import com.hkteam2.stocknews.common.TimeUtils;

/**
 * API 테스트 공통 바탕. 프론트가 보내는 요청을 MockMvc로 똑같이 보내고 응답이 약속(docs/api.md)대로인지 확인
 *
 * 테스트 데이터 = "투명 필름" 방식
 * - 테스트 하나가 통째로 트랜잭션 하나 (@Transactional) → 끝나면 전부 되돌림(롤백). DB에 흔적이 안 남음
 * - 시작할 때 기사 표를 비우고(@BeforeEach) 테스트에 필요한 기사만 넣음 → PC마다 DB 내용이 달라도 결과가 같음
 *   (내 PC의 예시 기사·진짜 기사도 비우기까지 되돌려지므로 그대로 남음)
 * - 종목 사전(V6, 2,655개)은 Flyway가 어디서나 똑같이 넣으므로 그대로 씀
 *
 * MockMvc: 서버를 진짜로 켜지 않고 Controller부터 DB까지 같은 길로 요청을 흘려 보내는 도구.
 * 같은 스레드에서 돌아서 테스트의 트랜잭션 안에서 실행됨 (그래서 넣은 데이터가 보이고, 끝나면 같이 되돌려짐)
 */
@SpringBootTest
@AutoConfigureMockMvc
@Transactional
public abstract class ApiTestSupport {

    /** 테스트에서 쓰는 종목. 예시 기사와 겹치지 않는 종목 */
    protected static final String KIA = "000270";
    protected static final String NAVER = "035420";
    protected static final String CELLTRION = "068270";

    @Autowired
    protected MockMvc mvc;

    @Autowired
    protected JdbcTemplate jdbc;

    @BeforeEach
    void clearArticles() {
        // 기사를 지우면 기사-종목 연결(article_stock)은 FK CASCADE로 같이 지워짐
        jdbc.update("DELETE FROM article");
        jdbc.update("DELETE FROM stock_daily_summary");
        jdbc.update("DELETE FROM collect_run");
    }

    /** 오늘 0시 + 초. 0시부터 지금 사이라 항상 "오늘 글" (자정 직후 몇 초만 빼고) */
    protected static LocalDateTime today(int seconds) {
        return LocalDate.now(TimeUtils.KST).atStartOfDay().plusSeconds(seconds);
    }

    /** 어제 23시 (오늘 0시 1시간 전) */
    protected static LocalDateTime yesterday() {
        return LocalDate.now(TimeUtils.KST).atStartOfDay().minusHours(1);
    }

    /** AI가 기사를 저장했다고 치고 넣기. 돌려주는 값은 새 article_id */
    protected long insertArticle(String title, String sourceType, String status, LocalDateTime publishedAt) {
        return insertArticle(title, sourceType, status, publishedAt, title + " 요약", null);
    }

    protected long insertArticle(String title, String sourceType, String status, LocalDateTime publishedAt,
                                 String summary, String keywords) {
        String url = "test://" + System.nanoTime();
        jdbc.update("""
                INSERT INTO article (url_key, url, press, title, published_at, status, summary, model, summarized_at,
                                     source_type, channel, keywords, sentiment)
                VALUES (?, ?, '테스트일보', ?, ?, ?, ?, 'test-model', ?, ?, ?, ?, 'NEUTRAL')
                """, url, url, title, publishedAt, status, summary, publishedAt,
                sourceType, "SNS".equals(sourceType) ? "NAVER_BLOG" : "RSS", keywords);
        // 같은 연결(트랜잭션)에서 방금 넣은 줄의 번호
        return jdbc.queryForObject("SELECT LAST_INSERT_ID()", Long.class);
    }

    /** 기사 × 종목 연결. relevance는 0.00~1.00 (null이면 AI가 아직 안 채운 것) */
    protected void link(long articleId, String stockCode, String sentiment, BigDecimal relevance, boolean main) {
        jdbc.update("""
                INSERT INTO article_stock (article_id, stock_code, is_main, sentiment, reason, match_type, relevance, evidence)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                """, articleId, stockCode, main, sentiment, stockCode + " 연결 이유",
                relevance == null ? null : "DIRECT", relevance, relevance == null ? null : stockCode + " 근거 문장");
    }

    protected void link(long articleId, String stockCode, double relevance) {
        link(articleId, stockCode, "POSITIVE", BigDecimal.valueOf(relevance), false);
    }

    // ----- 로그인 (진짜 사용자와 같은 길: 회원가입 API → 로그인 API → 토큰) -----

    /** 테스트 계정 비밀번호. 트랜잭션 롤백으로 계정은 테스트가 끝나면 사라짐 */
    protected static final String PASSWORD = "password123";

    /** 회원가입 후 로그인해서 받은 토큰. 요청 헤더에는 bearer(token)으로 붙임 */
    protected String tokenOf(String loginId) throws Exception {
        mvc.perform(post("/api/auth/signup").contentType(MediaType.APPLICATION_JSON)
                .content(loginJson(loginId, PASSWORD)));
        MvcResult result = mvc.perform(post("/api/auth/login").contentType(MediaType.APPLICATION_JSON)
                        .content(loginJson(loginId, PASSWORD)))
                .andReturn();
        return JsonPath.read(result.getResponse().getContentAsString(), "$.accessToken");
    }

    protected static String bearer(String token) {
        return "Bearer " + token;
    }

    protected static String loginJson(String loginId, String password) {
        return "{\"loginId\":\"" + loginId + "\",\"password\":\"" + password + "\"}";
    }

    /** 응답 JSON에서 숫자 하나 꺼내기. 예: 방금 만든 글의 postId */
    protected static long readLong(MvcResult result, String path) throws Exception {
        return ((Number) JsonPath.read(result.getResponse().getContentAsString(), path)).longValue();
    }
}

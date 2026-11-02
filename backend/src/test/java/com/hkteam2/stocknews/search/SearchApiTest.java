package com.hkteam2.stocknews.search;

import static org.hamcrest.Matchers.contains;
import static org.hamcrest.Matchers.lessThanOrEqualTo;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import org.junit.jupiter.api.Test;

import com.hkteam2.stocknews.support.ApiTestSupport;

/** 통합 검색 GET /api/search, 글 목록의 q·period */
class SearchApiTest extends ApiTestSupport {

    @Test
    void 검색어로_종목과_글을_한_번에_찾는다() throws Exception {
        insertArticle("기아 신차 공개", "NEWS", "DONE", today(1));
        insertArticle("요약에만 기아", "NEWS", "DONE", today(2), "오늘 기아가 발표했다.", null);
        insertArticle("키워드에만", "SNS", "DONE", today(3), "자동차 이야기", "기아,전기차");
        insertArticle("상관없는 글", "NEWS", "DONE", today(4));

        mvc.perform(get("/api/search").param("q", "기아"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.q").value("기아"))
                .andExpect(jsonPath("$.stocks.items[0].stockName").value("기아"))
                .andExpect(jsonPath("$.stocks.items.length()", lessThanOrEqualTo(5)))
                // 제목·요약·키워드 중 하나에 있으면 찾음
                .andExpect(jsonPath("$.articles.totalCount").value(3))
                .andExpect(jsonPath("$.articles.items[*].title", contains("키워드에만", "요약에만 기아", "기아 신차 공개")));
    }

    @Test
    void 기간을_고르면_그_안의_글만() throws Exception {
        insertArticle("기아 오늘", "NEWS", "DONE", today(1));
        insertArticle("기아 어제", "NEWS", "DONE", yesterday());

        mvc.perform(get("/api/search").param("q", "기아").param("period", "today"))
                .andExpect(jsonPath("$.articles.items[*].title", contains("기아 오늘")));
        mvc.perform(get("/api/search").param("q", "기아").param("period", "7d"))
                .andExpect(jsonPath("$.articles.totalCount").value(2));
    }

    @Test
    void 검색어의_퍼센트는_글자_그대로_찾는다() throws Exception {
        insertArticle("주가 10% 상승", "NEWS", "DONE", today(1));
        insertArticle("주가 100원 상승", "NEWS", "DONE", today(2));

        // %를 "아무 글자"로 보면 둘 다 나옴. 글자 그대로라 하나만
        mvc.perform(get("/api/articles").param("q", "10%"))
                .andExpect(jsonPath("$.items[*].title", contains("주가 10% 상승")));
    }

    @Test
    void 검색어가_없거나_너무_길면_400() throws Exception {
        mvc.perform(get("/api/search"))
                .andExpect(status().isBadRequest());
        mvc.perform(get("/api/search").param("q", "   "))
                .andExpect(status().isBadRequest());
        mvc.perform(get("/api/search").param("q", "가".repeat(51)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("INVALID_REQUEST"));
    }
}

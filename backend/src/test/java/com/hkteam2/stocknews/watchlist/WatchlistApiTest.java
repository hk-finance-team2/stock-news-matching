package com.hkteam2.stocknews.watchlist;

import static org.hamcrest.Matchers.contains;
import static org.hamcrest.Matchers.hasSize;
import static org.hamcrest.Matchers.notNullValue;
import static org.hamcrest.Matchers.nullValue;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.ResultActions;

import com.hkteam2.stocknews.support.ApiTestSupport;

/** 관심 종목 (/api/watchlist/...). 모두 로그인 필요 */
class WatchlistApiTest extends ApiTestSupport {

    private ResultActions add(String token, String stockCode) throws Exception {
        return mvc.perform(post("/api/watchlist").header("Authorization", bearer(token))
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"stockCode\":\"" + stockCode + "\"}"));
    }

    @Test
    void 토큰이_없으면_401() throws Exception {
        mvc.perform(get("/api/watchlist")).andExpect(status().isUnauthorized());
        mvc.perform(get("/api/watchlist/articles")).andExpect(status().isUnauthorized());
    }

    @Test
    void 추가하면_목록에_오늘_글_수와_최근_시각이_같이_나온다() throws Exception {
        String token = tokenOf("zzwatch01");
        link(insertArticle("기아 오늘", "NEWS", "DONE", today(1)), KIA, 0.9);
        link(insertArticle("기아 어제", "NEWS", "DONE", yesterday()), KIA, 0.9);

        add(token, KIA).andExpect(status().isCreated())
                .andExpect(jsonPath("$.stockName").value("기아"));
        add(token, NAVER).andExpect(status().isCreated());

        mvc.perform(get("/api/watchlist").header("Authorization", bearer(token)))
                .andExpect(jsonPath("$.items", hasSize(2)))
                .andExpect(jsonPath("$.items[?(@.stockCode == '000270')].todayArticleCount", contains(1)))
                .andExpect(jsonPath("$.items[?(@.stockCode == '000270')].lastMatchedAt", contains(notNullValue())))
                // 글이 한 번도 없는 종목: 0건, 최근 시각 null
                .andExpect(jsonPath("$.items[?(@.stockCode == '035420')].todayArticleCount", contains(0)))
                .andExpect(jsonPath("$.items[?(@.stockCode == '035420')].lastMatchedAt", contains(nullValue())));
    }

    @Test
    void 같은_종목은_409_없는_종목은_404_형식이_틀리면_400() throws Exception {
        String token = tokenOf("zzwatch02");
        add(token, KIA);

        add(token, KIA).andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("ALREADY_IN_WATCHLIST"));
        add(token, "999999").andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("STOCK_NOT_FOUND"));
        add(token, "12345").andExpect(status().isBadRequest());
    }

    @Test
    void 삭제하면_204_다시_삭제하면_404() throws Exception {
        String token = tokenOf("zzwatch03");
        add(token, KIA);

        mvc.perform(delete("/api/watchlist/{code}", KIA).header("Authorization", bearer(token)))
                .andExpect(status().isNoContent());
        mvc.perform(delete("/api/watchlist/{code}", KIA).header("Authorization", bearer(token)))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("WATCHLIST_NOT_FOUND"));
    }

    @Test
    void 남의_관심_종목과_그_글은_안_보인다() throws Exception {
        String alice = tokenOf("zzwatch04");
        String bob = tokenOf("zzwatch05");
        link(insertArticle("기아 글", "NEWS", "DONE", today(1)), KIA, 0.9);
        add(alice, KIA);

        mvc.perform(get("/api/watchlist/articles").header("Authorization", bearer(alice)))
                .andExpect(jsonPath("$.totalCount").value(1));
        mvc.perform(get("/api/watchlist").header("Authorization", bearer(bob)))
                .andExpect(jsonPath("$.items", hasSize(0)));
        mvc.perform(get("/api/watchlist/articles").header("Authorization", bearer(bob)))
                .andExpect(jsonPath("$.totalCount").value(0));
    }

    @Test
    void 관심_종목_둘에_걸친_글은_한_번만_나온다() throws Exception {
        String token = tokenOf("zzwatch06");
        long both = insertArticle("기아·네이버 함께", "NEWS", "DONE", today(2));
        link(both, KIA, 0.9);
        link(both, NAVER, 0.8);
        link(insertArticle("셀트리온 글", "NEWS", "DONE", today(1)), CELLTRION, 0.9);   // 관심 종목 아님
        add(token, KIA);
        add(token, NAVER);

        mvc.perform(get("/api/watchlist/articles").header("Authorization", bearer(token)))
                .andExpect(jsonPath("$.totalCount").value(1))
                .andExpect(jsonPath("$.items[*].title", contains("기아·네이버 함께")));
    }
}

package com.hkteam2.stocknews.article;

import static org.hamcrest.Matchers.contains;
import static org.hamcrest.Matchers.hasSize;
import static org.hamcrest.Matchers.nullValue;
import static org.hamcrest.Matchers.startsWith;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.math.BigDecimal;

import org.junit.jupiter.api.Test;

import com.hkteam2.stocknews.support.ApiTestSupport;

/** 글 목록 GET /api/articles, 글 상세 GET /api/articles/{id} */
class ArticleApiTest extends ApiTestSupport {

    @Test
    void 목록에는_분석이_끝난_글만_최신순으로_나온다() throws Exception {
        insertArticle("오래된 글", "NEWS", "DONE", today(1));
        insertArticle("새 글", "NEWS", "DONE", today(2));
        insertArticle("종목 없는 글", "NEWS", "NO_STOCK", today(3));
        insertArticle("분석 중인 글", "NEWS", "SUMMARIZED", today(4));

        mvc.perform(get("/api/articles"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalCount").value(2))
                .andExpect(jsonPath("$.items[*].title", contains("새 글", "오래된 글")))
                .andExpect(jsonPath("$.items[0].publishedAt", startsWith(today(2).toLocalDate().toString())));
    }

    @Test
    void 종목을_고르면_그_종목과_연결된_글만() throws Exception {
        long kiaArticle = insertArticle("기아 글", "NEWS", "DONE", today(1));
        long naverArticle = insertArticle("네이버 글", "NEWS", "DONE", today(2));
        link(kiaArticle, KIA, 0.9);
        link(naverArticle, NAVER, 0.9);

        mvc.perform(get("/api/articles").param("stockCode", KIA))
                .andExpect(jsonPath("$.totalCount").value(1))
                .andExpect(jsonPath("$.items[0].title").value("기아 글"));
    }

    @Test
    void 정보_표시_주가_뒤_기사_역할_등급_사실_종류() throws Exception {
        long moved = insertArticle("[특징주] 기아, 신차 기대에 5% 급등", "NEWS", "DONE", today(2));
        long plain = insertArticle("기아, 새 전기차 공개", "NEWS", "DONE", today(1));
        link(moved, KIA, "POSITIVE", new BigDecimal("0.90"), true);
        link(plain, KIA, "POSITIVE", new BigDecimal("0.90"), true);
        link(plain, NAVER, "NEUTRAL", new BigDecimal("0.30"), false);
        jdbc.update("UPDATE article_stock SET fact_type = 'FACT' WHERE article_id = ? AND stock_code = ?", plain, KIA);

        mvc.perform(get("/api/articles"))
                .andExpect(jsonPath("$.items[0].priceMoveTitle").value(true))   // 주가가 움직인 뒤 쓴 제목
                .andExpect(jsonPath("$.items[0].disclosureType").value(nullValue()))   // 뉴스는 공시 유형 없음
                .andExpect(jsonPath("$.items[1].priceMoveTitle").value(false))
                .andExpect(jsonPath("$.items[1].stocks[0].role").value("MAIN"))
                .andExpect(jsonPath("$.items[1].stocks[0].factType").value("FACT"))
                .andExpect(jsonPath("$.items[1].stocks[1].role").value("MENTIONED"))
                .andExpect(jsonPath("$.items[1].stocks[1].factType").value(nullValue()));   // AI 가 아직 안 채우면 null
        mvc.perform(get("/api/articles/{id}", plain))
                .andExpect(jsonPath("$.priceMoveTitle").value(false))
                .andExpect(jsonPath("$.stocks[0].role").value("MAIN"))
                .andExpect(jsonPath("$.stocks[0].factType").value("FACT"));
    }

    @Test
    void 공시는_유형_이름과_해석이_갈리는_유형인지를_준다() throws Exception {
        long buyback = insertArticle("기아 자기주식취득결정", "NEWS", "DONE", today(2));
        long earnings = insertArticle("기아 영업(잠정)실적(공정공시)", "NEWS", "DONE", today(1));
        jdbc.update("UPDATE article SET channel = 'DART' WHERE article_id IN (?, ?)", buyback, earnings);
        link(buyback, KIA, 0.9);
        link(earnings, KIA, 0.9);

        mvc.perform(get("/api/articles"))
                .andExpect(jsonPath("$.items[0].disclosureType").value("자기주식 취득"))
                .andExpect(jsonPath("$.items[0].contextDependent").value(true))   // 목적에 따라 반응이 갈림 (보상 목적이면 −)
                .andExpect(jsonPath("$.items[1].disclosureType").value("잠정실적"))
                .andExpect(jsonPath("$.items[1].contextDependent").value(false));
        mvc.perform(get("/api/articles/{id}", buyback))
                .andExpect(jsonPath("$.disclosureType").value("자기주식 취득"))
                .andExpect(jsonPath("$.contextDependent").value(true));
    }

    @Test
    void 관련_종목_칩은_관련도_높은_순이고_퍼센트로_나온다() throws Exception {
        long id = insertArticle("두 종목 글", "NEWS", "DONE", today(1));
        link(id, NAVER, 0.60);
        link(id, KIA, 0.85);

        mvc.perform(get("/api/articles"))
                .andExpect(jsonPath("$.items[0].stocks[*].stockCode", contains(KIA, NAVER)))
                .andExpect(jsonPath("$.items[0].stocks[0].relevance").value(85))
                .andExpect(jsonPath("$.items[0].stocks[0].stockName").value("기아"));
    }

    @Test
    void 관련도가_빈_글은_null이고_관련도순에서_맨_뒤() throws Exception {
        long empty = insertArticle("관련도 빈 글", "NEWS", "DONE", today(2));
        long full = insertArticle("관련도 있는 글", "NEWS", "DONE", today(1));
        link(empty, KIA, "POSITIVE", null, true);
        link(full, NAVER, 0.5);

        mvc.perform(get("/api/articles").param("sort", "relevance"))
                .andExpect(jsonPath("$.items[*].title", contains("관련도 있는 글", "관련도 빈 글")))
                .andExpect(jsonPath("$.items[1].stocks[0].relevance").value(nullValue()))
                .andExpect(jsonPath("$.items[1].stocks[0].matchType").value(nullValue()));
    }

    @Test
    void 출처와_최소_관련도로_거른다() throws Exception {
        long news = insertArticle("뉴스", "NEWS", "DONE", today(1));
        long sns = insertArticle("SNS 글", "SNS", "DONE", today(2));
        long low = insertArticle("관련도 낮은 뉴스", "NEWS", "DONE", today(3));
        link(news, KIA, 0.9);
        link(sns, KIA, 0.9);
        link(low, KIA, 0.3);

        mvc.perform(get("/api/articles").param("source", "sns"))
                .andExpect(jsonPath("$.items[*].title", contains("SNS 글")));
        mvc.perform(get("/api/articles").param("minRelevance", "80"))
                .andExpect(jsonPath("$.totalCount").value(2));
    }

    @Test
    void 감성으로_거르면_주인공_종목_기준_종목을_고르면_그_종목_기준() throws Exception {
        // 한 글에 기아(주인공, 긍정)와 네이버(조연, 부정)
        long mixed = insertArticle("기아 호재, 네이버 악재", "NEWS", "DONE", today(1));
        link(mixed, KIA, "POSITIVE", new BigDecimal("0.90"), true);
        link(mixed, NAVER, "NEGATIVE", new BigDecimal("0.70"), false);
        long bad = insertArticle("기아 악재", "NEWS", "DONE", today(2));
        link(bad, KIA, "NEGATIVE", new BigDecimal("0.90"), true);

        // 종목을 안 고르면 카드에 보이는 감성 = 주인공 종목의 감성
        mvc.perform(get("/api/articles").param("sentiment", "positive"))
                .andExpect(jsonPath("$.items[*].title", contains("기아 호재, 네이버 악재")));
        mvc.perform(get("/api/articles").param("sentiment", "NEGATIVE"))
                .andExpect(jsonPath("$.items[*].title", contains("기아 악재")));
        // 네이버 화면에서는 네이버에 대한 감성
        mvc.perform(get("/api/articles").param("stockCode", NAVER).param("sentiment", "NEGATIVE"))
                .andExpect(jsonPath("$.items[*].title", contains("기아 호재, 네이버 악재")));
        mvc.perform(get("/api/articles").param("sentiment", "GOOD"))
                .andExpect(status().isBadRequest());
    }

    @Test
    void 페이지는_1부터_size만큼() throws Exception {
        for (int i = 1; i <= 3; i++) {
            insertArticle("글" + i, "NEWS", "DONE", today(i));
        }

        mvc.perform(get("/api/articles").param("page", "2").param("size", "2"))
                .andExpect(jsonPath("$.totalCount").value(3))
                .andExpect(jsonPath("$.items[*].title", contains("글1")));
    }

    @Test
    void 잘못된_조건은_400_없는_종목은_404() throws Exception {
        mvc.perform(get("/api/articles").param("sort", "abc"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("INVALID_REQUEST"));
        mvc.perform(get("/api/articles").param("minRelevance", "101"))
                .andExpect(status().isBadRequest());
        mvc.perform(get("/api/articles").param("size", "0"))
                .andExpect(jsonPath("$.code").value("INVALID_PAGE"));
        mvc.perform(get("/api/articles").param("stockCode", "999999"))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("STOCK_NOT_FOUND"));
    }

    @Test
    void 상세에는_종목별_이유와_근거_그리고_키워드_목록() throws Exception {
        long id = insertArticle("기아 신차 공개", "NEWS", "DONE", today(10), "기아가 신차를 공개했다.", "신차, 전기차,");
        link(id, KIA, "POSITIVE", new BigDecimal("0.92"), true);

        mvc.perform(get("/api/articles/{id}", id))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.title").value("기아 신차 공개"))
                .andExpect(jsonPath("$.keywords", contains("신차", "전기차")))
                .andExpect(jsonPath("$.stocks[0].relevance").value(92))
                .andExpect(jsonPath("$.stocks[0].reason").value(KIA + " 연결 이유"))
                .andExpect(jsonPath("$.stocks[0].evidence").value(KIA + " 근거 문장"))
                .andExpect(jsonPath("$.stocks[0].isMain").value(true));
    }

    @Test
    void 뉴스_상세에는_같은_종목의_가까운_SNS만_붙는다() throws Exception {
        long news = insertArticle("기아 뉴스", "NEWS", "DONE", today(100));
        long sameStock = insertArticle("기아 이야기", "SNS", "DONE", today(200));
        long otherStock = insertArticle("네이버 이야기", "SNS", "DONE", today(150));
        long tooOld = insertArticle("오래된 기아 이야기", "SNS", "DONE", today(100).minusDays(2));
        link(news, KIA, 0.9);
        link(sameStock, KIA, 0.7);
        link(otherStock, NAVER, 0.7);
        link(tooOld, KIA, 0.7);

        mvc.perform(get("/api/articles/{id}", news))
                .andExpect(jsonPath("$.relatedSns[*].title", contains("기아 이야기")));
        // SNS 글 상세에는 SNS를 붙이지 않음
        mvc.perform(get("/api/articles/{id}", sameStock))
                .andExpect(jsonPath("$.relatedSns", hasSize(0)));
    }

    @Test
    void 분석이_덜_끝났거나_없는_글은_404() throws Exception {
        long running = insertArticle("분석 중", "NEWS", "SUMMARIZED", today(1));

        mvc.perform(get("/api/articles/{id}", running))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("ARTICLE_NOT_FOUND"));
        mvc.perform(get("/api/articles/{id}", 999_999_999L))
                .andExpect(status().isNotFound());
    }
}

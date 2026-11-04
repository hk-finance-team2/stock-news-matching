package com.hkteam2.stocknews.stock;

import static org.hamcrest.Matchers.everyItem;
import static org.hamcrest.Matchers.hasItem;
import static org.hamcrest.Matchers.hasSize;
import static org.hamcrest.Matchers.is;
import static org.hamcrest.Matchers.not;
import static org.hamcrest.Matchers.nullValue;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.time.LocalDateTime;

import org.junit.jupiter.api.Test;

import com.hkteam2.stocknews.common.TimeUtils;
import com.hkteam2.stocknews.support.ApiTestSupport;

/** 종목 검색·상세, 이슈 순위, 종합 요약, 언급량 (GET /api/stocks/...) */
class StockApiTest extends ApiTestSupport {

    @Test
    void 종목_검색은_이름이_딱_맞는_종목이_먼저() throws Exception {
        mvc.perform(get("/api/stocks").param("q", "기아"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.items[0].stockCode").value(KIA))
                .andExpect(jsonPath("$.items[0].stockName").value("기아"));
        // 종목코드 앞자리 0 보존 (문자열)
        mvc.perform(get("/api/stocks/{code}", KIA))
                .andExpect(jsonPath("$.stockCode").value("000270"));
    }

    @Test
    void 별칭이_딱_맞으면_그_종목이_먼저() throws Exception {
        // "현대차"로 시작하는 현대차증권보다 별칭이 딱 맞는 현대자동차가 앞
        mvc.perform(get("/api/stocks").param("q", "현대차"))
                .andExpect(jsonPath("$.items[0].stockCode").value("005380"))
                .andExpect(jsonPath("$.items[*].stockName", hasItem("현대차증권")));
        mvc.perform(get("/api/stocks").param("q", "에스오일"))
                .andExpect(jsonPath("$.items[0].stockName").value("S-Oil"));
    }

    @Test
    void 헷갈리는_별칭도_검색에는_나옴() throws Exception {
        // 포스코(AMBIGUOUS)는 AI 매칭에서만 빼고 검색에서는 씀. 이름에 포스코가 든 종목도 같이 나옴
        mvc.perform(get("/api/stocks").param("q", "포스코"))
                .andExpect(jsonPath("$.items[*].stockCode", hasItem("005490")))
                .andExpect(jsonPath("$.items[*].stockName", hasItem("포스코퓨처엠")));
    }

    @Test
    void 같은_순위면_최근_많이_언급된_종목이_먼저() throws Exception {
        // 글이 없으면 이름 길이·이름순: "삼성"으로 시작하는 4글자 중 삼성공조가 삼성전자보다 앞
        mvc.perform(get("/api/stocks").param("q", "삼성"))
                .andExpect(jsonPath("$.items[0].stockName").value("삼성공조"));

        link(insertArticle("삼성전자 오늘", "NEWS", "DONE", today(1)), "005930", 0.9);
        link(insertArticle("분석 중", "NEWS", "SUMMARIZED", today(2)), "006660", 0.9);   // DONE만 셈 (삼성공조)
        mvc.perform(get("/api/stocks").param("q", "삼성"))
                .andExpect(jsonPath("$.items[0].stockCode").value("005930"));

        // 이름이 딱 맞는 순위가 더 우선: 언급이 없어도 "삼성공조"는 삼성공조가 1위
        mvc.perform(get("/api/stocks").param("q", "삼성공조"))
                .andExpect(jsonPath("$.items[0].stockName").value("삼성공조"));
    }

    @Test
    void 없는_종목은_404() throws Exception {
        mvc.perform(get("/api/stocks/{code}", "999999"))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("STOCK_NOT_FOUND"));
    }

    @Test
    void 이슈_순위는_오늘_글만_세고_많은_순() throws Exception {
        for (int i = 1; i <= 2; i++) {
            link(insertArticle("기아 오늘" + i, "NEWS", "DONE", today(i)), KIA, 0.9);
        }
        link(insertArticle("네이버 오늘", "NEWS", "DONE", today(5)), NAVER, 0.9);
        for (int i = 1; i <= 3; i++) {   // 어제 글은 아무리 많아도 안 셈
            link(insertArticle("네이버 어제" + i, "NEWS", "DONE", yesterday().minusMinutes(i)), NAVER, 0.9);
        }
        link(insertArticle("분석 중", "NEWS", "SUMMARIZED", today(6)), CELLTRION, 0.9);   // DONE만 셈

        mvc.perform(get("/api/stocks/issues"))
                .andExpect(jsonPath("$.items", hasSize(2)))
                .andExpect(jsonPath("$.items[0].rank").value(1))
                .andExpect(jsonPath("$.items[0].stockCode").value(KIA))
                .andExpect(jsonPath("$.items[0].articleCount").value(2))
                .andExpect(jsonPath("$.items[1].stockCode").value(NAVER))
                .andExpect(jsonPath("$.items[1].articleCount").value(1));
    }

    @Test
    void 이슈_순위는_기본이_뉴스만_SNS는_따로() throws Exception {
        link(insertArticle("기아 뉴스", "NEWS", "DONE", today(1)), KIA, 0.9);
        for (int i = 1; i <= 3; i++) {   // SNS가 더 많아도 기본 순위에는 안 들어감
            link(insertArticle("네이버 블로그" + i, "SNS", "DONE", today(i + 1)), NAVER, 0.5);
        }

        mvc.perform(get("/api/stocks/issues"))
                .andExpect(jsonPath("$.items", hasSize(1)))
                .andExpect(jsonPath("$.items[0].stockCode").value(KIA));
        mvc.perform(get("/api/stocks/issues").param("source", "SNS"))
                .andExpect(jsonPath("$.items", hasSize(1)))
                .andExpect(jsonPath("$.items[0].stockCode").value(NAVER))
                .andExpect(jsonPath("$.items[0].articleCount").value(3));
    }

    @Test
    void 이슈_순위_글_수가_같으면_평균_관련도_높은_순() throws Exception {
        link(insertArticle("네이버", "NEWS", "DONE", today(1)), NAVER, 0.95);
        link(insertArticle("기아", "NEWS", "DONE", today(2)), KIA, 0.50);

        mvc.perform(get("/api/stocks/issues").param("limit", "1"))
                .andExpect(jsonPath("$.items", hasSize(1)))
                .andExpect(jsonPath("$.items[0].stockCode").value(NAVER))
                .andExpect(jsonPath("$.items[0].avgRelevance").value(95));
        mvc.perform(get("/api/stocks/issues").param("limit", "51"))
                .andExpect(status().isBadRequest());
    }

    @Test
    void 종합_요약이_없어도_감성_비율은_나오고_합은_100() throws Exception {
        link(insertArticle("좋은 소식", "NEWS", "DONE", today(1)), KIA, "POSITIVE", null, true);
        link(insertArticle("나쁜 소식", "NEWS", "DONE", today(2)), KIA, "NEGATIVE", null, true);
        link(insertArticle("그냥 소식", "SNS", "DONE", today(3)), KIA, "NEUTRAL", null, true);

        mvc.perform(get("/api/stocks/{code}/summary", KIA))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.newsSummary").value(nullValue()))
                .andExpect(jsonPath("$.sentiment.articleCount").value(3))
                // 1:1:1 → 33.3%씩 → 반올림이면 99. 최대 나머지 방식으로 34 + 33 + 33 = 100
                .andExpect(jsonPath("$.sentiment.positive").value(34))
                .andExpect(jsonPath("$.sentiment.negative").value(33))
                .andExpect(jsonPath("$.sentiment.neutral").value(33));
        // 출처를 고르면 그 출처 글만
        mvc.perform(get("/api/stocks/{code}/summary", KIA).param("source", "SNS"))
                .andExpect(jsonPath("$.sentiment.articleCount").value(1))
                .andExpect(jsonPath("$.sentiment.neutral").value(100));
    }

    @Test
    void AI가_만든_종합_요약이_있으면_같이_나온다() throws Exception {
        jdbc.update("""
                INSERT INTO stock_daily_summary (stock_code, summary_date, news_summary, sns_summary, generated_at)
                VALUES (?, CURDATE(), '기아 뉴스 요약', NULL, NOW())
                """, KIA);

        mvc.perform(get("/api/stocks/{code}/summary", KIA))
                .andExpect(jsonPath("$.newsSummary").value("기아 뉴스 요약"))
                .andExpect(jsonPath("$.snsSummary").value(nullValue()))
                .andExpect(jsonPath("$.sentiment.articleCount").value(0));
    }

    @Test
    void SNS_요약만_있으면_생성_시각은_비어_있다() throws Exception {
        // SNS가 먼저 줄을 만들면 generated_at에 SNS 시각이 들어감 → 뉴스 요약 시각처럼 보이면 안 됨
        jdbc.update("""
                INSERT INTO stock_daily_summary (stock_code, summary_date, news_summary, sns_summary, generated_at)
                VALUES (?, CURDATE(), NULL, '기아 SNS 반응 요약', NOW())
                """, KIA);

        mvc.perform(get("/api/stocks/{code}/summary", KIA))
                .andExpect(jsonPath("$.newsSummary").value(nullValue()))
                .andExpect(jsonPath("$.snsSummary").value("기아 SNS 반응 요약"))
                .andExpect(jsonPath("$.generatedAt").value(nullValue()));
    }

    @Test
    void 언급량은_오늘_0시부터_지금까지_모든_시간_칸이_빠짐없이() throws Exception {
        link(insertArticle("뉴스", "NEWS", "DONE", today(1)), KIA, 0.9);
        link(insertArticle("SNS", "SNS", "DONE", today(2)), KIA, 0.9);
        int expectedBuckets = LocalDateTime.now(TimeUtils.KST).getHour() + 1;   // 0시 ~ 지금 시각

        mvc.perform(get("/api/stocks/{code}/mentions", KIA))
                .andExpect(jsonPath("$.unit").value("HOUR"))
                .andExpect(jsonPath("$.items", hasSize(expectedBuckets)))
                // 0시 칸에 뉴스 1 + SNS 1
                .andExpect(jsonPath("$.items[0].newsCount").value(1))
                .andExpect(jsonPath("$.items[0].snsCount").value(1))
                .andExpect(jsonPath("$.items[0].totalCount").value(2));
    }

    @Test
    void 언급량_7일은_7칸이고_어제_글은_어제_칸에() throws Exception {
        link(insertArticle("어제 글", "NEWS", "DONE", yesterday()), KIA, 0.9);

        mvc.perform(get("/api/stocks/{code}/mentions", KIA).param("period", "7d"))
                .andExpect(jsonPath("$.unit").value("DAY"))
                .andExpect(jsonPath("$.items", hasSize(7)))
                .andExpect(jsonPath("$.items[5].totalCount").value(1))   // 끝에서 두 번째 = 어제
                .andExpect(jsonPath("$.items[6].totalCount").value(0));  // 마지막 = 오늘
    }

    @Test
    void 언급량_잘못된_기간은_400() throws Exception {
        mvc.perform(get("/api/stocks/{code}/mentions", KIA).param("period", "1y"))
                .andExpect(status().isBadRequest());
    }

    @Test
    void 종목_검색에_별칭_조건이_있어도_이름_검색은_그대로() throws Exception {
        // 이름에 "셀트리온"이 들어간 종목은 여러 개, 모두 이름에 검색어가 있어야 함
        mvc.perform(get("/api/stocks").param("q", "셀트리온"))
                .andExpect(jsonPath("$.items[*].stockName", hasItem("셀트리온")))
                .andExpect(jsonPath("$.items[*].stockName", everyItem(is(not("기아")))));
    }
}

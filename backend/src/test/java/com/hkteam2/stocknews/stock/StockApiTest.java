package com.hkteam2.stocknews.stock;

import static org.hamcrest.Matchers.everyItem;
import static org.hamcrest.Matchers.greaterThanOrEqualTo;
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
    void 테마_이름과_딱_같으면_그_테마_종목도_나오고_많이_언급된_종목이_앞() throws Exception {
        // 이름에 "반도체"가 든 종목(matchedTheme 없음)과 테마로만 찾은 종목(matchedTheme "반도체")이 함께
        mvc.perform(get("/api/stocks").param("q", "반도체").param("size", "100"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalCount", greaterThanOrEqualTo(100)))
                .andExpect(jsonPath("$.items[?(@.stockName == '한미반도체')].matchedTheme", hasItem(nullValue())))
                .andExpect(jsonPath("$.items[?(@.stockCode == '005930')].matchedTheme", hasItem("반도체")));

        // 이름 가운데 글자와 테마는 같은 순위 → 최근 언급이 많은 SK하이닉스가 1위 (테마를 맨 뒤로 보내면 11번째라 통합 검색 5개에 안 나옴)
        for (int i = 1; i <= 3; i++) {
            link(insertArticle("SK하이닉스 소식 " + i, "NEWS", "DONE", today(i)), "000660", 0.9);
        }
        mvc.perform(get("/api/stocks").param("q", "반도체"))
                .andExpect(jsonPath("$.items[0].stockCode").value("000660"))
                .andExpect(jsonPath("$.items[0].matchedTheme").value("반도체"));
        mvc.perform(get("/api/search").param("q", "반도체"))
                .andExpect(jsonPath("$.stocks.items[0].stockCode").value("000660"))
                .andExpect(jsonPath("$.stocks.items[0].matchedTheme").value("반도체"));

        // 이름이 q로 시작하는 순위는 그대로 우선: "서울반도체"는 서울반도체가 1위
        mvc.perform(get("/api/stocks").param("q", "서울반도체"))
                .andExpect(jsonPath("$.items[0].stockName").value("서울반도체"));
    }

    @Test
    void 테마는_딱_같을_때만_찾고_종목_상세에는_matchedTheme_칸이_없다() throws Exception {
        // "반도" 는 테마 "반도체"와 딱 같지 않음 → 테마로 찾은 종목 없음 (바이 → 바이오 160종목이 쏟아지지 않게)
        mvc.perform(get("/api/stocks").param("q", "반도").param("size", "100"))
                .andExpect(jsonPath("$.items[*].matchedTheme", everyItem(nullValue())));
        mvc.perform(get("/api/stocks/{code}", "005930"))
                .andExpect(jsonPath("$.matchedTheme").doesNotExist());
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

    /** AI 의 step7_group.save_groups() 가 하는 일: 묶음의 대표 기사 번호를 (기사, 종목) 줄에 넣음 */
    private void group(long representative, String stockCode, long... articleIds) {
        for (long id : articleIds) {
            jdbc.update("UPDATE article_stock SET group_article_id = ? WHERE article_id = ? AND stock_code = ?",
                    representative, id, stockCode);
        }
    }

    @Test
    void 이슈_순위는_글_수로_정렬하고_같은_소식_묶음은_사건_수로_따로_센다() throws Exception {
        // 기아: 같은 실적 소식 3건(한 묶음) + 다른 소식 1건 → 글 4건, 소식 2건
        long first = insertArticle("기아 3분기 영업익", "NEWS", "DONE", today(1));
        long second = insertArticle("기아, 3분기 영업이익 발표", "NEWS", "DONE", today(2));
        long third = insertArticle("[종합] 기아 3분기 영업익", "NEWS", "DONE", today(3));
        long other = insertArticle("기아 신차 공개", "NEWS", "DONE", today(4));
        for (long id : new long[] {first, second, third, other}) {
            link(id, KIA, 0.9);
        }
        group(first, KIA, first, second, third);
        // 네이버: 묶음 없는 글 3건 → 글 3건, 소식 3건
        for (int i = 1; i <= 3; i++) {
            link(insertArticle("네이버 소식" + i, "NEWS", "DONE", today(10 + i)), NAVER, 0.9);
        }

        mvc.perform(get("/api/stocks/issues"))
                .andExpect(jsonPath("$.items[0].stockCode").value(KIA))   // 순위는 글 수(보도량) 그대로
                .andExpect(jsonPath("$.items[0].articleCount").value(4))
                .andExpect(jsonPath("$.items[0].eventCount").value(2))
                .andExpect(jsonPath("$.items[1].stockCode").value(NAVER))
                .andExpect(jsonPath("$.items[1].articleCount").value(3))
                .andExpect(jsonPath("$.items[1].eventCount").value(3));
    }

    @Test
    void 감성_비율은_글_단위와_같은_소식_1표_단위를_같이_준다() throws Exception {
        // 같은 호재 소식 3건(한 묶음) + 악재 소식 1건: 글 단위는 호재 3 : 악재 1, 소식 단위는 1 : 1
        long first = insertArticle("호재 소식", "NEWS", "DONE", today(1));
        long second = insertArticle("호재 소식 받아 쓰기", "NEWS", "DONE", today(2));
        long third = insertArticle("호재 소식 종합", "NEWS", "DONE", today(3));
        for (long id : new long[] {first, second, third}) {
            link(id, KIA, "POSITIVE", null, true);
        }
        group(first, KIA, first, second, third);
        link(insertArticle("악재 소식", "NEWS", "DONE", today(4)), KIA, "NEGATIVE", null, true);

        mvc.perform(get("/api/stocks/{code}/summary", KIA))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.sentiment.articleCount").value(4))
                .andExpect(jsonPath("$.sentiment.positive").value(75))
                .andExpect(jsonPath("$.sentiment.negative").value(25))
                .andExpect(jsonPath("$.sentimentByEvent.articleCount").value(2))
                .andExpect(jsonPath("$.sentimentByEvent.positiveCount").value(1))
                .andExpect(jsonPath("$.sentimentByEvent.positive").value(50))
                .andExpect(jsonPath("$.sentimentByEvent.negative").value(50));
    }

    @Test
    void 감성을_판단하지_않은_연결은_감성_비율에서_빠진다() throws Exception {
        // V12: AI 활용 금지 언론사 기사는 제목만으로 연결하고 감성은 NULL (중립으로 세면 비율이 왜곡됨)
        link(insertArticle("좋은 소식", "NEWS", "DONE", today(1)), KIA, "POSITIVE", null, true);
        link(insertArticle("제목만 연결한 기사", "NEWS", "DONE", today(2)), KIA, null, null, true);

        mvc.perform(get("/api/stocks/{code}/summary", KIA))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.sentiment.articleCount").value(1))
                .andExpect(jsonPath("$.sentiment.positive").value(100))
                .andExpect(jsonPath("$.sentiment.neutral").value(0));
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

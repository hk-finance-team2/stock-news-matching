package com.hkteam2.stocknews.stock;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.List;

import org.junit.jupiter.api.Test;

import com.hkteam2.stocknews.support.ApiTestSupport;

/**
 * 종목 사전(별칭·테마·그룹·문맥 키워드) 데이터 검사. AI 매칭이 이 표를 그대로 읽으므로 데이터 실수를 미리 잡음
 * R__stock_alias.sql, R__stock_theme.sql, R__stock_group.sql, R__stock_alias_context.sql에 줄을 추가했을 때
 * 실수하면 여기서 실패함
 *
 * AI 매칭 방식 (ai/hk_llm/step6_match.py): 회사 이름의 공백을 지우고 대문자로 바꿔 종목명·별칭과 똑같은지 비교,
 * 종목명이 별칭보다 우선
 */
class StockDictionaryTest extends ApiTestSupport {

    /** AI가 읽을 별칭 (헷갈림 제외) */
    private static final String AI_ALIASES = "SELECT alias FROM stock_alias WHERE alias_type <> 'AMBIGUOUS'";

    @Test
    void 헷갈리는_별칭은_AI용_조회에_없음() {
        List<String> aliases = jdbc.queryForList(AI_ALIASES, String.class);
        assertThat(aliases).contains("현대차", "에스오일", "엔씨소프트", "삼전", "씨제이", "쌍용차", "대우조선해양")
                .doesNotContain("포스코", "모비스", "LIG", "레인보우", "티웨이", "아모레", "한미", "미래에셋", "디비");
    }

    @Test
    void 별칭이_다른_종목의_공식_이름과_같지_않음() {
        // 같으면 AI는 공식 이름 쪽 종목에 연결함 → 별칭이 무시되거나 엉뚱한 종목에 붙음 (예: 모비스는 따로 상장된 회사)
        List<String> clashes = jdbc.queryForList("""
                SELECT CONCAT(a.alias, ' → ', a.stock_code, ' / 공식 이름 ', s.stock_code)
                FROM stock_alias a
                JOIN stock_info s ON REPLACE(s.stock_name, ' ', '') = REPLACE(a.alias, ' ', '')
                WHERE s.stock_code <> a.stock_code AND a.alias_type <> 'AMBIGUOUS'
                """, String.class);
        assertThat(clashes).isEmpty();
    }

    @Test
    void 헷갈림이_아닌_별칭은_한_종목에만() {
        List<String> shared = jdbc.queryForList("""
                SELECT MIN(alias) FROM stock_alias
                WHERE alias_type <> 'AMBIGUOUS'
                GROUP BY REPLACE(alias, ' ', '')
                HAVING COUNT(DISTINCT stock_code) > 1
                """, String.class);
        assertThat(shared).isEmpty();
    }

    @Test
    void 한_종목이_여러_테마에_들어감() {
        List<String> themes = jdbc.queryForList(
                "SELECT theme FROM stock_theme WHERE stock_code = '012450' ORDER BY theme", String.class);
        assertThat(themes).containsExactly("방산", "우주항공");   // 한화에어로스페이스
    }

    @Test
    void 헷갈리는_별칭은_후보_종목마다_한_줄() {
        // 한미 → 한미약품·한미반도체·한미사이언스·한미글로벌. 검색에는 모두 나오고 AI는 문맥 키워드로 고름
        List<String> codes = jdbc.queryForList(
                "SELECT stock_code FROM stock_alias WHERE alias = '한미' AND alias_type = 'AMBIGUOUS' ORDER BY stock_code",
                String.class);
        assertThat(codes).containsExactly("008930", "042700", "053690", "128940");
    }

    @Test
    void 문맥_키워드는_헷갈리는_별칭의_후보에만() {
        // stock_alias와 외래키가 없어서(R__가 별칭을 지우고 다시 넣음) 여기서 짝이 맞는지 검사
        List<String> orphans = jdbc.queryForList("""
                SELECT CONCAT(c.alias, ' → ', c.stock_code) FROM stock_alias_context c
                WHERE NOT EXISTS (SELECT 1 FROM stock_alias a
                                  WHERE a.alias = c.alias AND a.stock_code = c.stock_code
                                    AND a.alias_type = 'AMBIGUOUS')
                """, String.class);
        assertThat(orphans).isEmpty();
    }

    @Test
    void 문맥_키워드로_후보를_고를_수_있음() {
        String sql = "SELECT stock_code FROM stock_alias_context WHERE alias = ? AND keyword = ?";
        assertThat(jdbc.queryForList(sql, String.class, "한미", "반도체")).containsExactly("042700");
        assertThat(jdbc.queryForList(sql, String.class, "한미", "신약")).containsExactly("128940");
    }

    @Test
    void 그룹은_별칭이_아니라_그룹_표에() {
        List<String> samsung = jdbc.queryForList(
                "SELECT stock_code FROM stock_group WHERE group_name = '삼성그룹'", String.class);
        assertThat(samsung).contains("005930", "207940");   // 삼성전자, 삼성바이오로직스
        // 그룹 이름이 별칭에 있으면 AI가 그룹의 한 종목에만 연결함
        List<String> groupAliases = jdbc.queryForList(
                "SELECT DISTINCT g.group_name FROM stock_group g JOIN stock_alias a ON a.alias = g.group_name",
                String.class);
        assertThat(groupAliases).isEmpty();
    }
}

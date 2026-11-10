package com.hkteam2.stocknews.article;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;

/** 공시 제목 → 유형·정정 표시 규칙 (2026-11-10 QA 에서 뜻이 반대로 나온 제목들) */
class ArticleLabelsTest {

    private static String type(String title) {
        return ArticleLabels.disclosureType("DART", title);
    }

    @Test
    void 해지_철회_해제_취소는_원래_유형으로_표시하지_않는다() {
        assertThat(type("삼성전자 자기주식취득신탁계약해지결정")).isEqualTo("해지·철회·해제");
        assertThat(type("기아 유상증자 결정 철회")).isEqualTo("해지·철회·해제");
        assertThat(type("에코프로 단일판매ㆍ공급계약해지")).isEqualTo("해지·철회·해제");
        assertThat(type("삼영이엔씨 주권매매거래정지해제 (액면병합 등)")).isEqualTo("해지·철회·해제");
        assertThat(type("모아라이프플러스 최대주주변경을수반하는주식담보제공계약해제ㆍ취소")).isEqualTo("해지·철회·해제");
        assertThat(ArticleLabels.contextDependent(type("삼성전자 자기주식취득신탁계약해지결정"))).isFalse();
        // 원래 유형은 그대로
        assertThat(type("삼성전자 주요사항보고서(자기주식취득결정)")).isEqualTo("자기주식 취득");
        assertThat(type("청보 주요사항보고서(회사합병결정)")).isEqualTo("합병");
        assertThat(type("아이엠 주권매매거래정지 (상장폐지 사유 발생)")).isEqualTo("상장폐지·관리종목·거래정지");
    }

    @Test
    void 정정_공시는_회사가_고친_것만_금감원_요구_명령은_아님() {
        assertThat(ArticleLabels.disclosureCorrection("DART", "기아 [기재정정]주요사항보고서(유상증자결정)")).isTrue();
        assertThat(ArticleLabels.disclosureCorrection("DART", "에이비 정정신고서제출요구(증권신고서)")).isFalse();
        assertThat(ArticleLabels.disclosureCorrection("DART", "에이비 정정명령부과(증권신고서)")).isFalse();
        assertThat(ArticleLabels.disclosureCorrection("RSS", "[기재정정] 기사")).isFalse();
    }
}

package com.hkteam2.stocknews.common;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import org.junit.jupiter.api.Test;

import com.hkteam2.stocknews.common.error.BusinessException;

/** 검색어 정리·LIKE 특수 문자 처리 (종목 검색·글 검색·통합 검색이 같이 씀) */
class SearchKeywordTest {

    @Test
    void 앞뒤_공백을_지우고_비었으면_null() {
        assertThat(SearchKeyword.normalize("  삼성 ")).isEqualTo("삼성");
        assertThat(SearchKeyword.normalize("   ")).isNull();
        assertThat(SearchKeyword.normalize(null)).isNull();
    }

    @Test
    void 오십자를_넘으면_400() {
        assertThat(SearchKeyword.normalize("가".repeat(50))).hasSize(50);
        assertThatThrownBy(() -> SearchKeyword.normalize("가".repeat(51))).isInstanceOf(BusinessException.class);
    }

    @Test
    void LIKE_특수_문자는_글자로_찾게_바꾼다() {
        assertThat(SearchKeyword.escapeLike("10%")).isEqualTo("10\\%");   // Java 글자 "10\%"
        assertThat(SearchKeyword.escapeLike("a_b")).isEqualTo("a\\_b");
        assertThat(SearchKeyword.escapeLike("삼성")).isEqualTo("삼성");
        assertThat(SearchKeyword.escapeLike(null)).isNull();
    }
}

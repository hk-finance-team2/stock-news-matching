package com.hkteam2.stocknews.article;

import java.math.BigDecimal;

/**
 * 기사에 붙는 관련 종목 칩. relevance는 화면용 % (0~100), AI가 아직 안 채웠으면 null
 * role (2026-11-10): MAIN 주인공 / MENTIONED 함께 언급 — 화면은 관련도 % 대신 이 등급을 보여 주는 쪽 (측정: 주인공 표시 연결은
 * 연습 문제에서 모두 맞았고 틀린 연결은 전부 MENTIONED, 관련도 숫자는 역할을 못 가림)
 * factType (V14): 근거 문장의 사실 종류 FACT/PLAN/FORECAST/RUMOR, 없으면 null
 * 같은 소식 (V13): sameNewsCount 이 종목에서 같은 소식으로 묶인 기사 수(묶이지 않았으면 null),
 * firstReportPress 그 묶음에서 가장 먼저 발행한 언론사, firstReport 이 기사가 첫 보도인가
 */
public record ArticleStockResponse(
        String stockCode,
        String stockName,
        String matchType,
        Integer relevance,
        String sentiment,
        boolean isMain,
        String role,
        String factType,
        Integer sameNewsCount,
        String firstReportPress,
        boolean firstReport
) {

    public static ArticleStockResponse from(ArticleStockRow row) {
        return new ArticleStockResponse(row.stockCode(), row.stockName(), row.matchType(),
                toPercent(row.relevance()), row.sentiment(), row.main(), ArticleLabels.role(row.main()), row.factType(),
                row.sameNewsCount(), row.firstPress(), row.firstReport());
    }

    /** 0.87 -> 87 (상세도 같이 씀) */
    static Integer toPercent(BigDecimal relevance) {
        return relevance == null ? null : relevance.movePointRight(2).intValue();
    }
}

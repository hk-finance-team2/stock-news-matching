package com.hkteam2.stocknews.article;

import java.time.OffsetDateTime;
import java.util.List;

import com.hkteam2.stocknews.common.TimeUtils;

/**
 * 기사 목록 한 줄. 본문은 내보내지 않고 요약과 원문 링크만
 * 정보 표시 (2026-11-10, 판단을 더하지 않고 제목·출처에서 읽은 사실만):
 * - priceMoveTitle: 제목이 주가가 이미 움직인 뒤 쓴 기사(특징주·급등·상승 …)인가 → 이미 반영됐을 수 있음
 * - disclosureType: 공시(DART)면 유형 이름(자기주식 취득, 유상증자 …), 아니면 null
 * - contextDependent: 목적·방식에 따라 해석이 갈리는 공시 유형인가 (자기주식·유상증자·무상증자·공급계약)
 * - disclosureKind: 공시의 의무/자율 MANDATORY·VOLUNTARY·FAIR(공정공시), 공시가 아니면 null
 * - disclosureCorrection: 정정 공시인가 (이미 낸 공시를 고쳐 다시 낸 것)
 */
public record ArticleResponse(
        Long articleId,
        String sourceType,
        String channel,
        String title,
        String press,
        OffsetDateTime publishedAt,
        String summary,
        String url,
        List<ArticleStockResponse> stocks,
        boolean priceMoveTitle,
        String disclosureType,
        boolean contextDependent,
        String disclosureKind,
        boolean disclosureCorrection
) {

    public static ArticleResponse from(ArticleRow row, List<ArticleStockResponse> stocks) {
        String disclosureType = ArticleLabels.disclosureType(row.channel(), row.title());
        return new ArticleResponse(row.articleId(), row.sourceType(), row.channel(), row.title(),
                row.press(), TimeUtils.toKst(row.publishedAt()), row.summary(), row.url(), stocks,
                ArticleLabels.priceMoveTitle(row.title()), disclosureType, ArticleLabels.contextDependent(disclosureType),
                ArticleLabels.disclosureKind(row.channel(), row.title()),
                ArticleLabels.disclosureCorrection(row.channel(), row.title()));
    }
}

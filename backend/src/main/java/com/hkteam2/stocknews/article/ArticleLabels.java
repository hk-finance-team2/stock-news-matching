package com.hkteam2.stocknews.article;

import java.util.List;
import java.util.regex.Pattern;

/**
 * 글에 붙이는 "정보" 표시 (2026-11-10, 멘토 피드백 "판단은 투자자, 보수적으로 정보만 제공").
 * 판단(호재·악재)을 더하지 않고, 이미 있는 제목·출처에서 읽을 수 있는 사실만 꺼냄.
 * 근거와 측정은 docs/decisions.md 2026-11-10 "정보만 제공 표시"
 */
final class ArticleLabels {

    private ArticleLabels() {
    }

    /**
     * 주가가 이미 움직인 뒤 쓴 기사의 제목 낱말 (특징주·급등·상승 …).
     * 측정(11/09): 3곳 이상 언론사가 다룬 소식의 73%가 이런 제목 → 기사가 나왔을 때 주가에 이미 반영됐을 수 있음.
     * 백엔드1 로컬 실험(price_check.py)의 낱말 목록에서 "%" 하나만 뺌: "의무공개매수 50%+1주" 처럼 지분율에도 걸려서
     * (11/10 화면 확인). 주가 기사는 "5% 급등"처럼 급등·상승 낱말이 같이 나와 그대로 잡힘
     */
    private static final Pattern PRICE_MOVE = Pattern.compile(
            "특징주|급등|급락|상한가|하한가|강세|약세|상승|하락|뛰|올랐|내렸|떨어|치솟|곤두박질|반등|폭락|폭등|신고가|52주");

    /** 공시 유형: 제목(회사명 + 보고서명) 낱말 → 화면 이름. 위에서부터 먼저 맞는 것. AI dart.py 의 고르는 낱말과 같은 범위 */
    private static final List<String[]> DISCLOSURE_TYPES = List.of(
            // 해지·철회·해제·취소를 먼저: 낱말만 보면 "자기주식취득신탁계약해지"가 "자기주식 취득", "거래정지해제"가
            // "상장폐지·관리종목·거래정지"로 뜻이 반대가 됨 (2026-11-10 QA, DART 7,138건 중 최대 약 270건)
            new String[] {"해지|철회|해제|취소", "해지·철회·해제"},
            new String[] {"영업\\(잠정\\)실적|잠정실적", "잠정실적"},
            new String[] {"자기주식\\s*취득|자기주식취득", "자기주식 취득"},
            new String[] {"자기주식\\s*처분|자기주식처분", "자기주식 처분"},
            new String[] {"주식소각|주식\\s*소각", "주식 소각"},
            new String[] {"유상증자", "유상증자"},
            new String[] {"무상증자", "무상증자"},
            new String[] {"감자", "감자"},
            new String[] {"단일판매|공급계약", "공급계약"},
            new String[] {"합병", "합병"},
            new String[] {"분할", "분할"},
            new String[] {"최대주주\\s*변경|최대주주변경", "최대주주 변경"},
            new String[] {"공개매수", "공개매수"},
            new String[] {"타법인주식", "타법인 주식 취득·처분"},
            new String[] {"기업가치\\s*제고", "기업가치 제고 계획"},
            new String[] {"풍문|조회공시", "풍문·조회공시 답변"},
            new String[] {"소송", "소송"},
            new String[] {"횡령|배임", "횡령·배임"},
            new String[] {"상장폐지|관리종목|거래정지", "상장폐지·관리종목·거래정지"},
            new String[] {"회생|부도", "회생·부도"},
            new String[] {"생산중단|영업정지|중대재해", "생산중단·영업정지·중대재해"},
            new String[] {"투자판단", "투자판단 관련 주요경영사항"},
            new String[] {"전환사채|신주인수권부사채|교환사채", "전환사채 등 발행"},
            new String[] {"주요사항보고서", "주요사항보고서"}
    );

    /**
     * 목적·방식에 따라 주가 반응이 갈리는 공시 (국내 사건 연구, 로컬 기록 ai-improve/research/21a):
     * 자기주식 취득은 평균 + 지만 임직원 보상 목적이면 −, 유상증자는 주주배정 − · 제3자배정 단기 +,
     * 무상증자는 + 가 30거래일 안에 사라짐, 공급계약은 오른 뒤 되돌아가는 경향
     */
    private static final List<String> CONTEXT_DEPENDENT = List.of("자기주식 취득", "자기주식 처분", "유상증자", "무상증자", "공급계약");

    private static final Pattern[] COMPILED = DISCLOSURE_TYPES.stream()
            .map(p -> Pattern.compile(p[0])).toArray(Pattern[]::new);

    static boolean priceMoveTitle(String title) {
        return title != null && PRICE_MOVE.matcher(title).find();
    }

    /** 공시(channel DART)면 유형 이름, 아니면 null. 목록에 없는 공시도 null (화면은 "공시"만 표시) */
    static String disclosureType(String channel, String title) {
        if (!"DART".equals(channel) || title == null) {
            return null;
        }
        for (int i = 0; i < COMPILED.length; i++) {
            if (COMPILED[i].matcher(title).find()) {
                return DISCLOSURE_TYPES.get(i)[1];
            }
        }
        return null;
    }

    static boolean contextDependent(String disclosureType) {
        return disclosureType != null && CONTEXT_DEPENDENT.contains(disclosureType);
    }

    /**
     * 공시의 의무/자율 (2026-11-10, 멘토 피드백 "필수 공시와 선택 공시를 다르게 다뤄라").
     * DART 보고서 이름에 적힌 표시로만 나눔: "(자율공시)" → VOLUNTARY, "(공정공시)" → FAIR, 그 밖 → MANDATORY
     * (주요사항보고서·수시공시. 거래소 공시 해설서: 수시공시는 "공시하여야 한다", 자율공시는 "공시할 수 있다").
     * 공정공시는 기업이 중요정보를 특정인에게 먼저 줄 때 시장에 먼저 공시하는 의무 제도(잠정실적 등).
     * 근거: 같은 공급계약도 의무공시와 자율공시는 주가 반응 모양이 다름 (경영연구 32(4), 2017). 공시가 아니면 null
     */
    static String disclosureKind(String channel, String title) {
        if (!"DART".equals(channel) || title == null) {
            return null;
        }
        if (title.contains("자율공시")) {
            return "VOLUNTARY";
        }
        return title.contains("공정공시") ? "FAIR" : "MANDATORY";
    }

    /** 이미 낸 공시를 고쳐 다시 낸 정정 공시인가 ("[기재정정]" 등). 화면에서 공시의 33% (11/10) — 새 소식이 아님을 알려 줌 */
    static boolean disclosureCorrection(String channel, String title) {
        // 금감원이 정정을 요구·명령한 것("정정신고서제출요구", "정정명령부과")은 회사가 고친 공시가 아님 (2026-11-10 QA)
        return "DART".equals(channel) && title != null && title.contains("정정")
                && !title.contains("제출요구") && !title.contains("정정명령");
    }

    /** 주인공(is_main) = MAIN, 아니면 MENTIONED. 측정(11/10): 주인공 표시 연결은 연습 문제 147개 모두 맞음, 틀린 연결은 전부 MENTIONED */
    static String role(boolean main) {
        return main ? "MAIN" : "MENTIONED";
    }
}

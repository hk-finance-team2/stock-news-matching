"""종목 매칭·묶기 규칙 시험. DB 없음"""


def test_step6_match():
    from collections import Counter
    from hk_llm.steps.step6_match import match_one, norm, on_topic, reason_text, score

    # 점수·매칭 규칙 시험 (DB 없이)
    s = {"name_weight": 0.4, "theme_weight": 0.4, "context_weight": 0.2, "min_score": 0.7}
    assert norm("(주) LG 씨엔에스") == "LG씨엔에스" and norm("hl만도") == "HL만도" and norm("기아(000270)") == "기아"
    assert norm("에쓰-오일") == "에쓰오일" and norm("S-Oil") == "SOIL"
    assert score(True, "A", [], {}, s) == 1.0  # 주인공: (0.4 + 0.2) / 0.6
    assert score(False, "A", [], {}, s) == 0.83  # 조연: (0.4 + 0.1) / 0.6
    assert score(True, "A", ["3분기 실적"], {"A": {"반도체"}}, s) == 1.0, "테마가 안 맞아도 깎지 않음"
    assert score(False, "A", ["금리"], {"A": {"HBM"}}, s) == 0.83, "조연도 테마 때문에 탈락하지 않음"
    assert score(False, "A", ["HBM 수요"], {"A": {"HBM"}}, s) == 1.0, "테마가 맞으면 점수를 올림"
    d = ({"HL만도": "204320", "샘표": "007540"}, {}, s)
    got = match_one([{"name": "HL만도", "is_main": True, "sentiment": "NEGATIVE", "reason": "r"},
                     {"name": "샘표", "is_main": True, "sentiment": "POSITIVE", "reason": "r"},
                     {"name": "바이낸스", "is_main": False, "sentiment": "NEUTRAL", "reason": "r"}], [], d)
    assert [g[0] for g in got] == ["204320", "007540"], got  # 사전에 없는 바이낸스는 빠짐
    miss = Counter()
    match_one([{"name": "바이낸스", "is_main": False, "sentiment": "NEUTRAL", "reason": "r"}], [], d, miss)
    assert miss == {"바이낸스": 1}, "못 찾은 이름을 모음"
    # 역할 (05-1): 나열·출처·그룹은 연결 안 함, 주인공만 is_main, 판단 보류는 감성 NULL, 예전 답(role 없음)도 읽음
    def co(name, role, sent="POSITIVE"):
        return {"name": name, "role": role, "sentiment": sent, "reason": "r", "evidence": 1}
    got = match_one([co("HL만도", "SUBJECT", "UNCERTAIN"), co("샘표", "SOURCE")], [], d)
    assert [g[0] for g in got] == ["204320"] and got[0][1]["is_main"] and got[0][1]["sentiment"] is None, got
    assert match_one([co("HL만도", "LISTED"), co("샘표", "GROUP")], [], d) == []
    assert not match_one([co("샘표", "PARTY")], [], d)[0][1]["is_main"], "당사자는 주인공 아님"
    fc = {**co("샘표", "SUBJECT"), "fact_type": "FORECAST"}
    assert match_one([fc], [], d)[0][1]["sentiment"] is None, "전망 문장이 근거면 판단 보류 (06-1)"
    assert match_one([{**fc, "fact_type": "FACT"}], [], d)[0][1]["sentiment"] == "POSITIVE"
    old = match_one([{"name": "샘표", "is_main": False, "sentiment": "NEUTRAL", "reason": "r"}], [], d)
    assert old and old[0][1]["role"] == "PARTY", "예전 답의 조연은 당사자로 읽음"

    # 괄호를 붙인 이름: 앞 → 안 순서로 찾음 (04-1)
    from hk_llm.steps.step6_match import lookup
    nm = {"한국항공우주": "047810", "KGM": "003620", "HL만도": "204320"}
    assert lookup(nm, "한국항공우주(KAI)") == "047810", "괄호 앞"
    assert lookup(nm, "KG모빌리티(KGM)") == "003620", "괄호 안"
    assert lookup(nm, "HL만도") == "204320" and lookup(nm, "없는회사(XYZ)") is None
    nm.update({"한화": "000880", "삼성물산": "028260"})
    assert lookup(nm, "한화 건설부문") == "000880" and lookup(nm, "삼성물산 패션부문") == "028260", "사업부 → 회사 (05-2a)"
    assert lookup(nm, "건설부문") is None and lookup(nm, "없는회사 건설부문") is None
    assert reason_text({"reason": "수주", "long_term": "POSITIVE"}) == "수주 (장기: 호재)"
    assert reason_text({"reason": "수주"}) == "수주"

    # 주제 확인: 유형·명단 기사 제외, 제목이나 앞부분에 있어야 연결
    names = {"삼성전자": "A", "삼전": "A", "두산": "B", **{f"회사{i}번": f"C{i}" for i in range(6)}}
    main = ("A", {"is_main": True}, 1.0, "삼성전자")
    side = ("B", {"is_main": False}, 0.83, "두산")
    tail = "다른 내용 " * 60 + "두산 소식"
    assert on_topic("삼성전자 실적", tail, [main, side], names) == [main], "뒷부분에만 나온 조연은 빠짐"
    assert on_topic("실적 기사", "두산이 수주했다", [side], names) == [side], "앞부분에 있으면 조연도 유지"
    twice = "다른 내용 " * 60 + "두산이 수주했다. 두산은 내년에도"
    assert on_topic("삼성전자 실적", twice, [main, side], names) == [main, side], "뒷부분이라도 2번 나오면 당사자로 보고 유지"
    assert on_topic("삼전 강세", tail, [main], names) == [main], "별칭으로도 찾음"
    assert on_topic("[주간 증시 전망] 삼성전자", "삼성전자", [main], names) == [], "유형 기사"
    assert on_topic("[부고] 삼성전자 전무 부친상", "삼성전자", [main], names) == [], "부고 말머리"
    assert on_topic("[특징주] 코스피 시황에 삼성전자 급등", "삼성전자", [main], names) == [main], "특징주는 예외"
    many = "".join(f"회사{i}번 " for i in range(6))
    assert on_topic("저PBR 151곳 공표", many + "두산", [side], names) == [], "명단 기사"
    assert on_topic("삼성전자 투자", "삼성전자 " + many, [main], names) == [main], "제목에 주인공이 있으면 명단 아님"
    names.update({f"회사{i}번": f"C{i}" for i in range(6, 10)})
    many = "".join(f"회사{i}번 " for i in range(10))
    assert on_topic("삼성전자 등 151곳 공표", "삼성전자 " + many, [main], names) == [], "제목에 있어도 종목이 너무 많으면 명단"
    assert on_topic("생산 지표 기사", None, [side], names) == [side], "본문이 지워졌으면 그대로"

    # 최장 일치 (04-2): 긴 이름 안의 짧은 이름, 영문 낱말 안의 영문 이름은 따로 세지 않음
    from hk_llm.steps.step6_match import mentions, spans
    nm2 = {"SK": "003600", "SK하이닉스": "000660", "하이닉스": "000660", "카카오": "035720", "카카오뱅크": "323410"}
    t = norm("SK하이닉스와 카카오뱅크, RISK 관리. SK 지주")
    assert sorted(c for _, _, c in spans(t, nm2)) == ["000660", "003600", "323410"], spans(t, nm2)
    assert mentions(t, "003600", "SK", nm2) == 1, "SK하이닉스·RISK 안의 SK 는 안 셈, 마지막 'SK 지주'만"
    assert mentions(t, "035720", "카카오", nm2) == 0, "카카오뱅크 안의 카카오는 카카오가 아님"
    assert not on_topic("카카오뱅크 실적", "카카오뱅크가 " * 3, [("035720", {"is_main": True}, 1.0, "카카오")], nm2), \
        "LLM 이 '카카오'라 써도 글에는 카카오뱅크뿐이면 카카오 연결 안 함"

    # 시황 기사 (04-4b): 제목에 나오고 그 종목만의 문장이 있는 종목만, 등락률 나열 종목은 빼기
    nm3 = {"삼성전자": "005930", "삼전": "005930", "SK하이닉스": "000660", "하닉": "000660", "삼성SDI": "006400", "두산에너빌리티": "034020"}
    sis = ("코스피는 2% 하락 출발했다.\n시가총액 상위 종목에서는 삼성SDI(-4.28%), 두산에너빌리티(-4.49%) 등이 약세다.\n"
           "삼성전자는 전 거래일 대비 7000원(3.06%) 내린 22만2000원에 거래되고 있다.")
    f_sam, f_sdi = ("005930", {"is_main": True}, 1.0, "삼성전자"), ("006400", {"is_main": False}, 0.83, "삼성SDI")
    f_hy = ("000660", {"is_main": True}, 1.0, "SK하이닉스")
    assert on_topic("코스피, 2%대 하락…삼전·하닉 동반 약세 [fn오전시황]", sis, [f_sam, f_sdi, f_hy], nm3) == [f_sam], \
        "제목+자기 문장이 있는 삼성전자만. SDI 는 나열, 하닉은 제목에만 있고 자기 문장 없음"
    assert on_topic("코스피 5%대 급락", sis, [f_sam, f_sdi], nm3) == [], "제목에 종목이 없는 시황은 연결 없음"
    assert on_topic("[fn오전시황] 삼성전자", None, [f_sam], nm3) == [], "본문이 지워진 시황은 예전처럼 버림"
    nm3["랩지노믹스"] = "084650"
    f_lab = ("084650", {"is_main": True}, 1.0, "랩지노믹스")
    assert on_topic("코스닥 상장사 임직원 31명 송치", "랩지노믹스 임직원이 송치됐다. 랩지노믹스는 입장을 냈다.", [f_lab], nm3) == [f_lab], \
        "'코스닥 상장사' 는 시황이 아님"
    two = "외국인이 삼성전자를 팔았다는 소식이다.\nSK하이닉스는 3% 내린 140만원에 거래됐다."
    assert on_topic("외국인, 삼전닉스 1조 순매도에…코스피 하락", two, [f_sam, f_hy], nm3) == [f_sam, f_hy], "삼전닉스 = 두 종목"

    # LLM 전 거르기 (04-6): 연결될 수 없는 게 확실한 기사만 False
    from hk_llm.steps.step6_match import could_link
    assert could_link("삼성전자 실적", "실적이 좋았다.", nm3), "제목에 이름"
    assert could_link("반도체 업황", "업계에서는 삼성전자 투자가 늘 것으로 본다.", nm3), "본문 어디든 이름"
    assert not could_link("서울 아파트값 올라", "부동산 시장이 들썩였다.", nm3), "사전 이름이 하나도 없음"
    assert not could_link("[부고] 삼성전자 전무 부친상", "삼성전자 전무", nm3), "유형 말머리"
    assert not could_link("코스피 2% 하락", "삼성전자는 3% 내린 22만원에 거래되고 있다.", nm3), "시황인데 제목에 종목 없음"
    assert could_link("코스피 하락…삼전 약세", "삼성전자는 3% 내린 22만원에 거래되고 있다.", nm3), "시황 + 제목에 종목"
    assert could_link("[특징주] 코스피 급락에도 삼성전자 상승", "", nm3) and could_link("외국인, 삼전닉스 매도", None, nm3)

    # 언론사 꼬리표 줄 (04-4a): "관련종목…" 줄은 매칭에서 안 읽음
    from hk_llm.steps.step6_match import article_text
    assert article_text("관련종목SK하이닉스(000660), 삼성전자(005930)\n블룸에너지 수혜") == "블룸에너지 수혜"
    hynix = ("000660", {"is_main": False}, 0.83, "SK하이닉스")
    assert not on_topic("블룸에너지 수혜 부상", "관련종목SK하이닉스(000660)\n" + "다른 내용 " * 60, [hynix], nm2), \
        "꼬리표에만 있는 종목은 앞부분에 나온 것으로 보지 않음"

    # 관련도: 제목·첫 부분·주인공·언급 횟수·테마로 기사 안에서 얼마나 중심인지 (화면 순서용)
    from hk_llm.steps.step6_match import relevance
    d = (names, {"A": {"반도체"}}, s)
    body4 = "삼성전자가 투자했다. " + "다른 내용 " * 60 + "삼성전자 삼성전자 삼성전자"
    assert relevance("삼성전자 투자", body4, main, ["반도체 투자"], d) == 1.0, "제목 + 주인공 + 4번 + 테마 = 만점"
    assert relevance("실적 기사", twice, side, [], d) == 0.12, "뒤쪽 2번 조연 = 0.25 × 2/4 → 0.12 (반올림)"
    assert relevance("실적 기사", "두산이 수주했다", side, [], d) == 0.26, "첫 부분 0.20 + 1번 0.06"
    assert relevance("삼성전자 투자", None, main, [], d) == 1.0, "본문이 지워졌으면 예전 점수"

    # 근거 문장: 이름이 나온 문장 중 LLM 이유와 단어가 가장 많이 겹치는 문장
    from hk_llm.steps.step6_match import evidence
    body = "삼성전자가 행사에 참석했다. 삼성전자는 HBM 공급 계약을 맺어 실적 개선이 기대된다. 두산은 별도 소식이다."
    item = ("A", {"is_main": True, "reason": "HBM 공급 계약으로 실적 개선"}, 1.0, "삼성전자")
    assert evidence(body, item, names) == "삼성전자는 HBM 공급 계약을 맺어 실적 개선이 기대된다.", "이유와 겹치는 문장"
    assert evidence("삼전이 강세를 보였다. 다른 문장이다.", item, names) == "삼전이 강세를 보였다.", "별칭으로도 찾음"
    assert evidence("다른 회사 이야기만 있는 본문입니다.", item, names) is None, "이름이 없으면 None"
    # LLM 이 근거 번호를 골랐으면 그 문장 (05-1): 0 = 제목, 1~ = 본문 문장 (numbered 와 같은 번호)
    from hk_llm.steps.step6_match import numbered
    assert numbered("제목", body) == ["제목", "삼성전자가 행사에 참석했다.", "삼성전자는 HBM 공급 계약을 맺어 실적 개선이 기대된다.", "두산은 별도 소식이다."]
    picked = ("A", {"is_main": True, "reason": "r", "evidence": 1}, 1.0, "삼성전자")
    assert evidence(body, picked, names, "삼성전자 제목") == "삼성전자가 행사에 참석했다.", "LLM 이 고른 번호"
    assert evidence(body, ("A", {**picked[1], "evidence": 0}, 1.0, "삼성전자"), names, "삼성전자 제목") == "삼성전자 제목"
    bad = ("A", {"is_main": True, "reason": "HBM 공급 계약으로 실적 개선", "evidence": 99}, 1.0, "삼성전자")
    assert evidence(body, bad, names, "제목") == "삼성전자는 HBM 공급 계약을 맺어 실적 개선이 기대된다.", "번호가 틀리면 예전 방식"


def test_step7_group():
    from datetime import timedelta
    from hk_llm.steps.step7_group import group_articles, similarity

    from datetime import datetime

    T = datetime(2026, 11, 2, 9, 0)

    def art(i, code, name, title, hours=0):
        return {"article_id": i, "stock_code": code, "stock_name": name, "title": title,
                "published_at": T + timedelta(hours=hours)}

    def ids(rows):
        return sorted(tuple(g["article_ids"]) for g in group_articles(rows))

    same = [  # 실제 같은 사건 쌍 (진행기록 17번, 샘플 9·1097번)
        ("예탁원", "예탁원, 내년 6월 뉴욕사무소 개소…", "예탁원, 내년 6월 뉴욕사무소 연다"),
        ("미래에셋", "미래에셋, 디지털엑스 오세진 대표 교체 가닥", "미래에셋, 디지털엑스 대표 바꾼다"),
        ("거래소", "거래소, 저PBR 상장사 151곳 첫 공표…", "'저PBR' 상장사 151곳 첫 공개…"),
        ("영광", "영광, 코스닥 상장 첫날 장 초반 70%대 '급등'", "[ET특징주] '조선·플랜트 기자재' 영광, 코스닥 상장 첫날 99%↑"),
        ("SK하이닉스", "솔리다임 상장 접은 SK하이닉스…주주환원 시험대 오른다", "SK하이닉스, 솔리다임 美상장 전격 중단…프리마켓 주가 관망"),
        ("한진칼", '호반그룹, 한진칼 최대주주로…한진칼은 "미확정"(종합)', "호반, 한진칼 최대주주 등극 가능성…여전히 '단순투자?'"),
        ("동원시스템즈", "동원시스템즈 3분기 영업익 240억원…작년 동기 대비 18.9% 증가", "동원시스템즈, 3Q 영업익 240억…전년비 18.9%↑"),
        ("한화오션", "한화오션, 잠수함 수평발사장치 국산화에 10%대 급등 [종목NOW]", "[ET특징주]한화오션, 장비 국산화에 상승세"),
        ("포스코퓨처엠", "포스코퓨처엠 3분기 영업이익 821억원…작년 동기 대비 23%↑", "'주력 소재 쌍끌이' 포스코퓨처엠, 분기 영업익 800억 돌파"),
    ]
    other = [  # 같은 종목, 다른 사건 (앞 2개는 수집한 실제 제목, 나머지는 임의로 만듦)
        ("SK하이닉스", "[특징주] 삼성전자 장초반 3%대 급락…SK하이닉스도 1.5%↓", "채용혜택 내건 SK하이닉스 AI해커톤, 시스템장애로 예선 중단"),
        ("SK하이닉스", '"SK하이닉스, 4분기 영업익 사상 첫 100조 돌파 전망"-KB', "채용혜택 내건 SK하이닉스 AI해커톤, 시스템장애로 예선 중단"),
        ("삼성전자", "삼성전자, 3분기 영업이익 시장 예상 상회", "삼성전자, 자사주 10조원 매입 결정"),
        ("삼성전자", "삼성전자, 미국 공장 증설 검토", "삼성전자 노조, 임금 협상 결렬 선언"),
        ("HL만도", "HL만도, 자율주행 투자로 수익성 둔화", "HL만도, 유럽 완성차 업체와 공급 계약"),
    ]
    for name, a, b in same:
        assert ids([art(1, "A", name, a), art(2, "A", name, b)]) == [(1, 2)], a
    for name, a, b in other:
        assert ids([art(1, "A", name, a), art(2, "A", name, b)]) == [], a

    a, b = same[1][1], same[1][2]
    assert ids([art(1, "A", "미래에셋", a), art(2, "B", "미래에셋", b)]) == [], "다른 종목은 안 묶음"
    assert ids([art(1, "A", "미래에셋", a), art(2, "A", "미래에셋", b, hours=25)]) == [], "24시간 넘으면 안 묶음"
    assert ids([art(1, "A", "미래에셋", a), art(2, "A", "미래에셋", b, hours=24)]) == [(1, 2)], "24시간 정각은 묶음"
    # HLB·HLB제약 은 제목이 거의 같아도 다른 종목이라 안 묶임
    assert ids([art(1, "A", "HLB", "HLB, 애프터마켓서 10%대 급등"), art(2, "B", "HLB제약", "HLB제약, 애프터마켓서 10%대 급등")]) == []
    # 사슬: 1-2, 2-3 이 비슷하면 셋이 한 묶음
    chain = [art(1, "A", "X", "X 뉴욕사무소 내년 개소"), art(2, "A", "X", "X 내년 뉴욕사무소 개소 결정"), art(3, "A", "X", "X 뉴욕사무소 개소 결정 이사회")]
    assert ids(chain) == [(1, 2, 3)], ids(chain)
    assert group_articles([]) == [] and similarity("", "") == 0.0


def test_title_only():
    """AI 활용 금지 언론사: 제목만으로 연결 (2026-11-05). 낱말이 딱 맞을 때만, 헷갈리는 이름은 뺌"""
    from hk_llm.core.press_policy import FULL, TITLE_ONLY, policy, title_only_presses
    from hk_llm.steps.title_only import MAX_STOCKS, decide, title_stocks

    assert title_only_presses() == ["서울경제", "연합뉴스", "연합인포맥스"]
    assert policy("한국경제") == FULL and policy("비즈워치") == FULL
    assert policy("처음 보는 언론사") == TITLE_ONLY, "모르는 언론사는 보수적으로"

    names = {"삼성전자": "A", "SK하이닉스": "B", "태양": "C", "SK": "D", "대상": "E", "HL만도": "F", "기아": "G",
             "LG전자": "H", "한화오션": "I"}
    blocked = {"SK", "대상"}  # 그룹 이름과 같은 지주사, 일반 단어 종목명
    assert title_stocks("삼성전자, 3분기 영업이익 시장 예상 상회", names, blocked) == {"A": "삼성전자"}
    assert title_stocks("SK하이닉스가 HBM 공급 확대", names, blocked) == {"B": "SK하이닉스"}, "조사 '가'를 떼고 봄"
    assert title_stocks("삼성전자·SK하이닉스 동반 강세", names, blocked) == {"A": "삼성전자", "B": "SK하이닉스"}
    assert title_stocks("태양광 업계 수주 확대", names, blocked) == {}, "낱말 일부('태양광'의 '태양')는 안 찾음"
    assert title_stocks("RISK 관리 강화", names, blocked) == {}, "영문 낱말 일부('RISK'의 'SK')도 안 찾음"
    assert title_stocks("SK, 반도체 투자 확대", names, blocked) == {}, "그룹 이름과 같은 지주사는 제목만으로 못 가림"
    assert title_stocks("지원 대상 확대", names, blocked) == {}, "일반 단어 종목명"
    assert title_stocks("[특징주] HL만도 급등", names, blocked) == {"F": "HL만도"}, "말머리 괄호는 낱말 경계"
    assert title_stocks("'기아' 美 판매 신기록", names, blocked) == {"G": "기아"}, "따옴표도 경계"

    got = decide("삼성전자, 3분기 실적 발표", names, blocked)
    assert got == [("A", "삼성전자", True, 0.65)], got
    assert decide("[마켓뷰] 삼성전자 강세", names, blocked) == [], "시황 말머리"
    many = "삼성전자·SK하이닉스·LG전자·한화오션 동반 상승"
    assert MAX_STOCKS == 3 and decide(many, names, blocked) == [], "종목 4개 이상 = 명단 제목"
    three = decide("삼성전자·SK하이닉스·LG전자 반도체 협력", names, blocked)
    assert [x[2] for x in three] == [False, False, False] and three[0][3] == 0.40, "3개면 주인공 아님"
    names.update({"키움증권": "K", "해성DS": "J", "상보": "S"})
    blocked = blocked | {"상보"}
    assert decide("키움증권, 해성DS 목표가↓", names, blocked) == [("J", "해성DS", True, 0.65)], "의견 낸 증권사는 출처"
    assert decide("키움증권, 반도체 업종 목표가 상향", names, blocked) == [], "증권사 의견 기사인데 대상이 사전에 없으면 연결 없음"
    assert decide("키움증권, 3분기 영업익 증가", names, blocked) == [("K", "키움증권", True, 0.65)], "증권사 자기 실적은 남음"
    assert decide("유로존 PMI 예비치 하회(상보)", names, blocked) == [], "연합 '(상보)' 표시는 종목 아님"

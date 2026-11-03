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

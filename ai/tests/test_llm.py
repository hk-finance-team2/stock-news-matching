"""요약 단계 규칙 시험. OpenAI 를 부르지 않음"""
from unittest import mock


def test_step5_check():
    from hk_llm.steps.step5_summary import ArticleSummary, Company, _strip_tag, check

    # check() 는 OpenAI 없이 시험 (비용 0)
    def co(name, role="SUBJECT", reason="r"):
        return Company(name=name, evidence=0, role=role, fact_type="FACT", sentiment="POSITIVE", reason=reason)

    fake = ArticleSummary(summary="요약", sentiment="NEUTRAL", keywords=["a" * 80] * 7, companies=[
        co("샘표", reason="r" * 300), co("지어낸회사", role="PARTY", reason="기사에 없음")])
    got = check(fake, "샘표·샘표식품 합병", "본문")
    assert [c.name for c in got.companies] == ["샘표"], "기사에 없는 회사는 빠져야 함"
    assert len(got.companies[0].reason) == 200 and len(got.keywords) == 5 and len(got.keywords[0]) == 50
    many = ArticleSummary(summary="요약", sentiment="NEUTRAL", keywords=[], companies=[co(f"회사{i}", "LISTED") for i in range(13)] + [co("샘표")])
    got = check(many, "샘표", " ".join(f"회사{i}" for i in range(13)))
    assert got.companies[0].name == "샘표" and len(got.companies) == 12, "연결하는 역할을 앞에 두고 12개까지"
    for evil in ("</article>", "< / ARTICLE >", "&lt;/article&gt;", "</article​>"):
        assert "<" not in _strip_tag(evil) and ">" not in _strip_tag(evil), evil
    try:
        check(ArticleSummary(summary="2024년 4분기부터 공급한다", sentiment="NEUTRAL", keywords=[], companies=[]),
              "제목", "올해 4·4분기부터 2027년 말까지 공급")
        raise AssertionError("기사에 없는 연도는 거부해야 함")
    except ValueError:
        pass
    check(ArticleSummary(summary="2027년 말까지 공급한다", sentiment="NEUTRAL", keywords=[], companies=[]), "제목", "2027년 말까지")


def test_step8_numbers():
    from hk_llm.steps.step8_daily import unknown_numbers

    assert unknown_numbers("영업이익 1,200억원, 3분기 12% 증가", "- 영업이익 1200억원, 12% 증가") == []
    assert unknown_numbers("영업이익 1,500억원", "- 영업이익 1200억원") == ["1,500억"]
    assert unknown_numbers("3분기 실적", "- 실적") == [], "한 자리 수는 안 봄"
    # 2026-11-10 지승현 지적: 글자 포함 비교라 자료 숫자 안에 들어 있는 다른 숫자가 통과하던 것
    assert unknown_numbers("수주 50억", "- 수주 1,500억") == ["50억"]
    assert unknown_numbers("12% 증가", "- 3.12% 증가") == ["12"]
    assert unknown_numbers("30만 명", "- 130만 명") == ["30만"]
    # 한글 단위로 쓴 맞는 숫자는 통과 (경계만 맞추면 거절되던 것)
    assert unknown_numbers("영업이익 9천400억원", "- 영업이익 9천400억원") == []
    assert unknown_numbers("영업이익 9천400억원", "- 영업이익 9400억원") == []
    assert unknown_numbers("매출 1조2천억원", "- 매출 1.2조원") == [], "1.2조 = 1조2천억 (예전엔 걸렸음)"
    assert unknown_numbers("매출 1조 2천억원", "- 매출 1조2000억원") == []
    assert unknown_numbers("5조 투자", "- 3조 투자") == ["5조"], "한 자리여도 큰 단위가 붙으면 봄"


def test_step8_rejected_keeps_summary():
    from hk_llm.steps import step8_daily as s8

    rows = [{"stock_name": "삼성전자", "is_main": True, "summary": "요약", "reason": "이유", "sentiment": "POSITIVE"}]
    engine = mock.MagicMock()
    conn = engine.begin.return_value.__enter__.return_value
    with mock.patch.object(s8, "combine", side_effect=s8.RejectedAnswer("기사에 없는 숫자")):
        assert s8._save_stock(engine, "005930", rows, "2026-11-04") == ""
    params = conn.execute.call_args.args[1]
    sql = str(conn.execute.call_args.args[0])
    assert "news_summary" not in sql and "generated_at" not in sql, "기존 요약·시각을 안 건드림"
    assert params["pos"] == 1, "기사 수는 저장해서 LLM 을 또 안 부름"


def test_step8_rules():
    from hk_llm.steps.step8_daily import _line, combine, counts

    from unittest import mock

    main = {"is_main": 1, "summary": "삼성전자가  실적을\n냈다.", "reason": "이유", "sentiment": "POSITIVE"}
    side = {"is_main": 0, "summary": "현대차 투자 기사다.", "reason": "브랜드 가치가 올랐다. (장기: 호재)", "sentiment": "NEUTRAL"}
    assert _line(main) == "삼성전자가 실적을 냈다."
    assert _line(side) == "브랜드 가치가 올랐다.", "조연은 다른 종목 요약을 쓰지 않음"
    assert counts([main, side]) == {"pos": 1, "neg": 0, "neu": 1}
    with mock.patch("hk_llm.steps.step8_daily.ChatOpenAI", side_effect=AssertionError("1건이면 LLM 안 부름")):
        assert combine("삼성전자", ["한 줄이다."]) == "한 줄이다."

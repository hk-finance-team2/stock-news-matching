"""AI 이용 거부 표시 자동 확인·언론사 방침 자동 바꿈 시험 (2026-11-10). DB·인터넷 안 씀

가짜 페이지·robots.txt 로 "언론사가 방침을 바꾼 상황"을 일부러 만들어, 자동으로 제목만으로 바뀌는지 확인
"""
import pathlib
import tempfile
from unittest import mock

import requests


def _policy_file():
    from hk_llm.core import press_policy

    return mock.patch.object(press_policy, "OVERRIDE_FILE", pathlib.Path(tempfile.mkdtemp()) / "override.json")


def test_page_notice_catches_real_notices():
    from hk_llm.core.press_policy import POLICY, TITLE_ONLY
    from hk_llm.steps.rights import page_reservation

    for press, (rule, why) in POLICY.items():
        if rule == TITLE_ONLY:  # 11/05 실제 기사 끝에서 옮겨 적은 고지 3개
            notice = why.split("'")[1]
            assert page_reservation(f"<div>본문</div><p>{notice}</p>".encode()), press


def test_page_notice_ignores_article_sentences():
    from hk_llm.steps.rights import page_reservation

    for s in ["정부가 AI 학습 금지 법안을 추진한다. 무단 수집 논란",
              "무단으로 AI 학습에 쓰는 것을 금지하는 법안",
              "저작권 침해 논란 속 AI 학습 데이터 사용 금지 판결",
              "ⓒ 한국경제, 무단전재 및 재배포 금지"]:  # AI 금지가 없는 보통 고지
        assert page_reservation(f"<p>{s}</p>") is None, s


def test_page_tdmrep_meta_and_header():
    from hk_llm.steps.rights import page_reservation

    assert page_reservation('<head><meta name="tdm-reservation" content="1"></head>')
    assert page_reservation("<head><meta content='1' name='tdm-reservation'></head>"), "속성 순서가 달라도"
    assert page_reservation('<meta name="tdm-reservation" content="0">') is None, "0 = 유보 안 함"
    assert page_reservation("<p>본문</p>", {"tdm-reservation": "1"}), "HTTP 헤더"


def test_content_signals_and_tdmrep_json():
    from hk_llm.steps.rights import content_signals, tdmrep_reserved

    assert content_signals("User-agent: *\nContent-Signal: search=yes, ai-train=no\nAllow: /") == {"search": "yes", "ai-train": "no"}
    assert content_signals("Content-Signal: ai-input=yes\ncontent-signal: ai-input=no")["ai-input"] == "no", "여러 줄이면 거부 우선"
    assert tdmrep_reserved([{"location": "/*", "tdm-reservation": 1}])
    assert not tdmrep_reserved([{"location": "/*", "tdm-reservation": 0}])
    assert not tdmrep_reserved("이상한 값")


def test_site_reservation_only_ai_input_no():
    from hk_llm.steps import rights

    def fake(robots_txt, tdmrep=None):
        def get(url):
            res = requests.Response()
            if url.endswith("robots.txt"):
                res.status_code, res._content = 200, robots_txt.encode()
            elif tdmrep is not None:
                res.status_code, res._content = 200, tdmrep.encode()
            else:
                res.status_code, res._content = 404, b""
            return res
        return get

    rights._site.cache_clear()
    with mock.patch.object(rights, "_get", fake("User-agent: *\nContent-Signal: search=yes,ai-train=no")):
        assert rights.site_reservation("https://a.example/1") is None, "학습만 거부(비즈워치)는 요약을 막지 않음"
    with mock.patch.object(rights, "_get", fake("User-agent: *\nContent-Signal: ai-input=no")):
        assert "ai-input=no" in rights.site_reservation("https://b.example/1")
    with mock.patch.object(rights, "_get", fake("User-agent: *", '[{"location": "/", "tdm-reservation": 1}]')):
        assert "tdmrep" in rights.site_reservation("https://c.example/1")
    with mock.patch.object(rights, "_get", side_effect=requests.ConnectionError("끊김")):
        assert rights.site_reservation("https://d.example/1") is None, "확인 못 하면 표시 없음 (robots.txt 는 robots.py 가 따로 지킴)"
    rights._site.cache_clear()


def test_policy_only_gets_stricter_automatically():
    from hk_llm.core import press_policy as pp

    with _policy_file():
        assert pp.policy("한국경제") == pp.FULL
        assert pp.restrict("한국경제", pp.TITLE_ONLY, "시험")
        assert pp.policy("한국경제") == pp.TITLE_ONLY and "한국경제" in pp.title_only_presses()
        assert not pp.restrict("한국경제", pp.FULL, "되돌리기 시도"), "자동으로는 느슨하게 못 바꿈"
        assert pp.policy("연합뉴스") == pp.TITLE_ONLY and not pp.restrict("연합뉴스", pp.TITLE_ONLY, "같음")
        assert any("한국경제" in i for i in pp.issues()), "사람이 반영할 때까지 알림"
        pp.reset("한국경제")
        assert pp.policy("한국경제") == pp.FULL and not pp.issues(), "사람이 확인 후 되돌림"
        assert pp.policy("처음 보는 언론사") == pp.TITLE_ONLY, "모르는 언론사는 제목만 (그대로)"


def test_exclude_press():
    from hk_llm.core import press_policy as pp
    from hk_llm.steps import step1_rss

    with _policy_file():
        pp.restrict("연합뉴스", pp.EXCLUDED, "권리자 요청")
        assert pp.excluded_presses() == ["연합뉴스"] and "연합뉴스" in pp.title_only_presses()
        with mock.patch.object(step1_rss, "fetch_feed", return_value=[]) as feed:
            step1_rss.fetch_all()
        asked = {c.args[1] for c in feed.call_args_list}
        assert "연합뉴스" not in asked and "한국경제" in asked, "제외 언론사는 RSS 도 요청 안 함"


def test_page_notice_needs_two_different_articles():
    from hk_llm.core import press_policy as pp

    with _policy_file():
        assert not pp.report_page_notice("전자신문", 1, "고지")
        assert not pp.report_page_notice("전자신문", 1, "고지"), "같은 기사를 또 봐도 1건"
        assert pp.policy("전자신문") == pp.FULL
        assert pp.report_page_notice("전자신문", 2, "고지"), "다른 기사 2건 → 언론사 전체를 제목만으로"
        assert pp.policy("전자신문") == pp.TITLE_ONLY


def test_body_fetch_stops_on_ai_notice():
    """언론사가 기사 끝에 AI 금지 고지를 붙이기 시작한 상황: 본문을 저장하지 않고, 2건째에 언론사 전체가 제목만으로"""
    from hk_llm.core import press_policy as pp
    from hk_llm.core.resilience import Breaker
    from hk_llm.steps import step4_body as s4

    rows = [mock.Mock(article_id=i, url=f"https://www.etnews.com/{i}", press="전자신문", retry_count=0) for i in (1, 2)]
    engine = mock.MagicMock()
    engine.connect.return_value.__enter__.return_value.execute.return_value.all.return_value = rows
    page = requests.Response()
    page.status_code, page._content = 200, "<div itemprop='articleBody'>본문 " * 50 + "</div><p>ⓒ 전자신문, 무단 전재-재배포, AI 학습 및 활용 금지</p>"
    page._content = page._content.encode()
    updates = []
    with _policy_file(), mock.patch.object(s4, "breaker", Breaker(pathlib.Path(tempfile.mkdtemp()) / "b.json")), \
            mock.patch.object(s4, "reachable", return_value=True), mock.patch.object(s4, "allowed", return_value=True), \
            mock.patch.object(s4, "crawl_delay", return_value=0), mock.patch.object(s4, "site_reservation", return_value=None), \
            mock.patch.object(s4, "_get", return_value=page), \
            mock.patch.object(s4, "_update", side_effect=lambda *a, **k: updates.append(k)):
        s4.fetch_bodies(engine)
        assert pp.policy("전자신문") == pp.TITLE_ONLY
    assert [u["status"] for u in updates] == ["SKIPPED", "SKIPPED"] and all(u.get("body") is None for u in updates), \
        "고지가 있는 기사의 본문은 저장 안 함"


def test_body_fetch_site_signal_switches_press():
    from hk_llm.core import press_policy as pp
    from hk_llm.core.resilience import Breaker
    from hk_llm.steps import step4_body as s4

    row = mock.Mock(article_id=7, url="https://news.bizwatch.co.kr/7", press="비즈워치", retry_count=0)
    engine = mock.MagicMock()
    engine.connect.return_value.__enter__.return_value.execute.return_value.all.return_value = [row]
    with _policy_file(), mock.patch.object(s4, "breaker", Breaker(pathlib.Path(tempfile.mkdtemp()) / "b.json")), \
            mock.patch.object(s4, "reachable", return_value=True), mock.patch.object(s4, "allowed", return_value=True), \
            mock.patch.object(s4, "site_reservation", return_value="robots.txt Content-Signal ai-input=no"), \
            mock.patch.object(s4, "_get") as get, mock.patch.object(s4, "_update"):
        s4.fetch_bodies(engine)
        assert pp.policy("비즈워치") == pp.TITLE_ONLY
    get.assert_not_called(), "사이트가 AI 입력을 거부하면 기사 페이지도 요청 안 함"

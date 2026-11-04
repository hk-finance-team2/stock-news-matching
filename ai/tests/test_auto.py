"""자동 실행·AI 서버·공시 원문 규칙 시험. DB·OpenAI 를 부르지 않음"""
import io
import os
import zipfile
from datetime import datetime, timedelta
from unittest import mock


def test_loop_wait():
    from hk_llm.loop import wait_seconds

    assert wait_seconds(1000.0) == 200.0
    assert wait_seconds(1200.0) == 300.0, "정각이면 다음 차례까지"
    assert wait_seconds(1499.5) == 0.5


def test_loop_daily_once_per_hour():
    from hk_llm import loop

    class Stop(Exception):
        pass

    # 1번째: 하루 요약 포함·성공 / 2번째: 같은 시라 제외, 실패해도 안 멈춤 / 3번째: 건너뜀(False) / 그다음 멈춤
    with mock.patch.object(loop, "get_engine"), mock.patch.object(loop, "run_locked") as sns_run, mock.patch.object(loop, "run", side_effect=[True, RuntimeError("실패"), False]) as run, \
            mock.patch.object(loop.time, "sleep", side_effect=[None, None, Stop]):
        try:
            loop.main()
            raise AssertionError("멈춰야 함")
        except Stop:
            pass
    assert [c.kwargs["daily"] for c in run.call_args_list] == [True, False, False]
    assert sns_run.call_count == 1, "SNS 는 시간당 1번, 뉴스와 따로"



def test_dart_document_text():
    from hk_llm.steps.dart import document_text

    def zipped(files):
        out = io.BytesIO()
        with zipfile.ZipFile(out, "w") as z:
            for name, data in files.items():
                z.writestr(name + ".xml", data)
        return out.getvalue()

    utf8 = '<?xml version="1.0" encoding="utf-8"?><DOCUMENT><STYLE>.a {color: red}</STYLE><P>단일판매 <B>공급계약</B>\n  체결</P></DOCUMENT>'.encode()
    assert document_text(zipped({"a00": b"<P>x</P>", "2026": utf8}), "2026") == "단일판매 공급계약 체결", "접수번호 파일을 읽음"
    euc = '<?xml version="1.0" encoding="euc-kr"?><P>유상증자 결정</P>'.encode("euc-kr")
    assert document_text(zipped({"other": euc}), "2026") == "유상증자 결정", "없으면 첫 파일, EUC-KR 도 읽음"


def test_dart_not_ready():
    from hk_llm.steps import dart

    with mock.patch.object(dart.requests, "get") as get:
        get.return_value = mock.Mock(status_code=200, content=b'<?xml version="1.0"?><result><status>014</status></result>')
        try:
            dart.fetch_document("key", "2026")
            raise AssertionError("014 는 NotReady")
        except dart.NotReady:
            pass
        get.return_value = mock.Mock(status_code=200, content=b'<result><status>020</status></result>')
        try:
            dart.fetch_document("key", "2026")
            raise AssertionError("다른 오류는 실패")
        except RuntimeError:
            pass


def test_sns_rules():
    from hk_llm.core.config import KST
    from hk_llm.steps import sns
    from hk_llm.steps.sns import Opinion, Post, cafe_marks, check, clean, is_new_cafe_post, is_spam, keep, published

    names = ["HLB", "HLB제약", "삼성전자"]
    assert clean("<b>HLB</b> &quot;주가&quot;   전망") == 'HLB "주가" 전망'
    assert keep("HLB", "HLB 주가 어디까지", "신약 기대", None, names)
    assert not keep("HLB", "HLB제약 주가 어디까지", "신약 기대", None, names), "다른 종목"
    assert not keep("삼성전자", "반도체 이야기", "삼성전자 주가", None, names), "제목에 이름이 없음"
    assert not keep("삼성전자", "삼성전자 주가 무료 추천", "카톡 문의", None, names), "광고"
    assert not keep("삼성전자", "삼성전자 시황 정리", "주가", None, names), "모음 글"
    assert not keep("삼성전자", "삼성전자 신제품 후기", "좋아요", None, names), "주식 이야기 아님"
    assert not keep("삼성전자", "삼성전자 주가", "상승", "중고나라", names), "금융 카페 아님"
    assert keep("삼성전자", "삼성전자 주가", "상승", "주식 종목분석", names)
    now = datetime(2026, 11, 3, 15, 0, tzinfo=KST)
    assert published(None, now) == now and published("20261103", now) == now
    assert published("20261102", now).day == 2 and published("20261101", now) is None
    for spam in ("HTTP://X.CO", "ｈｔｔｐ：／／x", "t.me/abc", "open.kakao.com/o/a", "abc . com 에서", "naver.com에서", "오픈\u200b채팅",
                 "010.1234.5678", "010 1234 5678", "(010)1234-5678", "카카오톡 아이디 abc",
                 "abc.com now", "t.me now", "30000 010-1234-5678", "주가 3 010-1234-5678", "0 1 0 1 2 3 4 5 6 7 8",
                 "abc。com", "abc．com", "abc.shop", "네이버.com", "abc\u3164.com", "오픈\u3164채팅", "오픈\ufe0f채팅",
                 "abc.c om", "a b c . c o m", "t.m e/abc", "1004.com", "365.kr"):
        assert is_spam(spam), f"광고를 통과시킴: {spam}"
    for fine in ("카카오톡 개편 기대", "목표가 3.5만원", "1,010억 3,456만 7,890원", "2010-11-30 실적", "삼성전자 주가 전망", None,
                 "1.SK하이닉스 상승", "상승했다.LG전자 하락", "2026.01.10 12:30 실적", "get.media 관련주", "3.5 . 7 상승", "1.top 종목", "12.live 방송",
                 "반도체.AI 수혜주", "HBM.AI 강세", "하락.Top 5 종목", "상승.Live 방송"):
        assert not is_spam(fine), f"정상 글을 막음: {fine}"
    assert not keep("삼성전자", "삼성전자 주가 오픈 채팅", "상승", None, names), "공백으로 우회"
    assert not keep("삼성전자", "삼성전자 주가", "상승 abc.com", None, names), "주소만 있는 글"
    assert not keep("삼성전자", "삼성전자 주가", "상담 받으세요", None, names), "글에는 광고 단어도 막음"
    assert keep("HLB", "HLB가 주가 상승", "기대", None, names), "조사는 붙어도 됨"
    assert not keep("HLB", "XHLB 주가", "기대", None, names), "다른 낱말 속"
    assert not keep("대상", "대상 주가 전망", "기대", None, ["대상"]), "일반 단어 종목명"
    for fine in ("리딩뱅크 경쟁과 유상증자 모집 의견", "목표가 30100원 의견", "2010-11 실적 비교"):
        assert check(Opinion(posts=[], summary=fine)).summary == fine, "금융 표현은 통과"
    for bad in ("오픈 채팅으로 오세요", "자세한 건 https://x.co", "010 1234 5678 로 연락"):
        assert check(Opinion(posts=[], summary=bad)).summary == "", f"광고 요약을 통과시킴: {bad}"
    mixed = check(Opinion(posts=[Post(id=1, sentiment="POSITIVE", reason="카톡 방 안내"), Post(id=2, sentiment="NEGATIVE", reason="실적 걱정")], summary="기대 의견"))
    assert mixed.posts[0].reason == "이유 표시 안 함" and mixed.posts[1].reason == "실적 걱정" and mixed.summary == "기대 의견"
    marks = cafe_marks(["https://cafe.naver.com/a/100", "https://cafe.naver.com/a/90", "https://blog.naver.com/x/5"])
    assert marks == {"a": 100}
    assert is_new_cafe_post("https://cafe.naver.com/a/101", marks)
    assert not is_new_cafe_post("https://cafe.naver.com/a/100", marks), "이미 본 번호"
    assert not is_new_cafe_post("https://cafe.naver.com/a/99", marks), "오래된 글"
    assert not is_new_cafe_post("https://cafe.naver.com/b/999", marks), "처음 보는 카페는 기준점"
    with mock.patch.dict(os.environ, {"NAVER_CLIENT_ID": "x"}), mock.patch.object(sns, "top_stocks", return_value=[]), \
            mock.patch.object(sns, "collect", return_value=(1, 2)), mock.patch.object(sns, "summarize", return_value=1) as summarize, \
            mock.patch.object(sns, "purge_old_posts") as purge:
        try:
            sns.run_sns(engine=object())
            raise AssertionError("검색 실패를 알려야 함")
        except RuntimeError:
            assert summarize.called, "검색이 실패해도 분석은 함"
    assert purge.called
    with mock.patch.dict(os.environ, {"NAVER_CLIENT_ID": "x"}), mock.patch.object(sns, "top_stocks", return_value=[]), \
            mock.patch.object(sns, "collect", return_value=(0, 0)), mock.patch.object(sns, "summarize", side_effect=RuntimeError("장애")), \
            mock.patch.object(sns, "purge_old_posts") as purge:
        try:
            sns.run_sns(engine=object())
            raise AssertionError("분석 실패가 전달돼야 함")
        except RuntimeError:
            pass
    assert purge.called, "분석이 실패해도 보관 기간이 지난 글은 지움"
    with mock.patch.dict(os.environ, {"NAVER_CLIENT_ID": ""}), mock.patch.object(sns, "purge_old_posts") as purge:
        assert sns.run_sns(engine=object()) == (0, 0) and purge.called, "키가 없어도 지움"


def test_sns_stocks_limit():
    from types import SimpleNamespace

    from hk_llm.steps import sns

    rows = [SimpleNamespace(stock_code=c, stock_name=c, article_id=i, title="t", description="d") for i, c in enumerate("ABC")]
    engine = mock.MagicMock()
    conn = engine.connect.return_value.__enter__.return_value
    conn.execute.return_value.all.return_value = rows
    with mock.patch.object(sns, "analyze") as analyze, mock.patch.object(sns, "save_result", return_value=1):
        assert sns.summarize(engine, 2) == 2
    assert analyze.call_count == 2, "--limit 이 LLM 호출 수도 막음"


def test_llm_budget():
    import pathlib
    import tempfile

    from hk_llm.steps import step5_summary as s5

    with tempfile.TemporaryDirectory() as folder, mock.patch.object(s5, "USAGE_FILE", pathlib.Path(folder) / "u.json"), \
            mock.patch.dict(os.environ, {"LLM_DAILY_USD": "0.5"}):
        assert s5.spent_today() == 0
        s5._add_usage({"m": {"input_tokens": 1_000_000, "output_tokens": 0}})
        assert abs(s5.spent_today() - 0.20) < 1e-9
        assert s5.llm_call(lambda: "ok") == "ok", "상한 아래면 호출"
        s5._add_usage({"m": {"input_tokens": 0, "output_tokens": 1_000_000}})
        called = mock.Mock()
        try:
            s5.llm_call(called)
            raise AssertionError("상한을 넘으면 멈춰야 함")
        except s5.BudgetExceeded as e:
            assert isinstance(e, s5.STOP_ERRORS)
        assert not called.called, "상한을 넘으면 LLM 을 안 부름"
        s5.USAGE_FILE.write_text("깨진 내용", encoding="utf-8")
        assert s5.spent_today() == 0, "기록 파일이 깨져도 수집은 안 멈춤"


def test_llm_usage_real_chain():
    # 실제 ChatOpenAI 체인에 가짜 응답을 줘서 토큰이 기록되는지 확인 (네트워크·비용 없음)
    import json
    import pathlib
    import tempfile

    import httpx2 as httpx  # 지금 openai 패키지가 쓰는 HTTP 라이브러리

    from hk_llm.steps import step5_summary as s5

    answer = {"summary": "요약", "sentiment": "NEUTRAL", "keywords": ["실적"], "companies": []}

    def handler(request):
        return httpx.Response(200, json={
            "id": "x", "object": "chat.completion", "created": 1, "model": s5.MODEL,
            "choices": [{"index": 0, "finish_reason": "stop", "message": {"role": "assistant", "content": json.dumps(answer)}}],
            "usage": {"prompt_tokens": 1000, "completion_tokens": 200, "total_tokens": 1200}})

    real = s5.ChatOpenAI
    client = httpx.Client(transport=httpx.MockTransport(handler))
    with tempfile.TemporaryDirectory() as folder, mock.patch.object(s5, "USAGE_FILE", pathlib.Path(folder) / "u.json"), \
            mock.patch.object(s5, "ChatOpenAI", lambda **kw: real(http_client=client, api_key="x", **kw)), \
            mock.patch.dict(os.environ, {"LLM_DAILY_USD": ""}):
        s5.summarize("제목", "본문")
        assert abs(s5.spent_today() - (1000 * s5.PRICE_IN + 200 * s5.PRICE_OUT)) < 1e-9, "실제 체인의 토큰이 잡혀야 상한이 동작함"


def test_llm_usage_failure_keeps_answer():
    import pathlib
    import tempfile

    from hk_llm.steps import step5_summary as s5

    with tempfile.TemporaryDirectory() as folder, mock.patch.object(s5, "USAGE_FILE", pathlib.Path(folder) / "u.json"), \
            mock.patch.object(pathlib.Path, "replace", side_effect=PermissionError("다른 프로세스가 쓰는 중")):
        s5._add_usage({"m": {"input_tokens": 1, "output_tokens": 1}})  # 예외가 나오면 안 됨
        assert list(pathlib.Path(folder).iterdir()) == [], "임시 파일을 남기면 안 됨"
    with mock.patch.dict(os.environ, {"LLM_DAILY_USD": "2달러"}):
        assert s5.daily_limit() == s5.DAILY_LIMIT, "오타로 글 실패가 나면 안 됨"
    with mock.patch.dict(os.environ, {"LLM_DAILY_USD": "0.5"}):
        assert s5.daily_limit() == 0.5


def test_llm_timeout():
    import httpx
    import openai

    from hk_llm.steps import step5_summary as s5

    timeout = openai.APITimeoutError(request=httpx.Request("POST", "http://x"))
    assert isinstance(timeout, s5.STOP_ERRORS), "그냥 두면 1건에 실행이 멈춤"

    def boom():
        raise timeout

    s5._timeouts = 0
    for _ in range(s5.TIMEOUT_STOP - 1):
        try:
            s5.llm_call(boom)
            raise AssertionError("실패해야 함")
        except s5.STOP_ERRORS:
            raise AssertionError("1건 시간 초과로 멈추면 안 됨")
        except ValueError:
            pass
    assert s5.llm_call(lambda: "ok") == "ok" and s5._timeouts == 0, "성공하면 초기화"
    for i in range(s5.TIMEOUT_STOP):
        try:
            s5.llm_call(boom)
        except s5.STOP_ERRORS:
            assert i == s5.TIMEOUT_STOP - 1, "연달아 나야 멈춤"
        except ValueError:
            pass
    assert s5._timeouts == 0


def test_run_matches_after_llm_stop():
    import httpx
    import openai

    from hk_llm import run as r

    engine = mock.MagicMock()
    stop = openai.APIConnectionError(request=httpx.Request("POST", "http://x"))
    with mock.patch.object(r, "collect", return_value=(1, [])), mock.patch.object(r, "collect_disclosures", return_value=0), \
            mock.patch.object(r, "fetch_bodies", return_value={"bad_hosts": []}), mock.patch.object(r, "summarize_articles", side_effect=stop), \
            mock.patch.object(r, "match_articles") as match, mock.patch.object(r, "purge_old_bodies"):
        try:
            r._run(engine, 1, False)
            raise AssertionError("실행은 실패로 남아야 함")
        except openai.APIConnectionError:
            pass
    assert match.called, "이미 요약한 기사는 연결"


def test_api_rules():
    from fastapi.testclient import TestClient
    from hk_llm import api
    from hk_llm.core.config import KST

    api._tries.clear()
    client = TestClient(api.app)
    head = {"X-Internal-Token": "secret"}
    url = "/summaries/005930"
    now = datetime.now(KST)
    with mock.patch.dict(os.environ, {"AI_INTERNAL_TOKEN": "secret"}), mock.patch.object(api, "get_engine"), \
            mock.patch.object(api, "regenerate", return_value="새 요약") as make, mock.patch.object(api, "stored") as stored:
        assert client.post(url).status_code == 401
        assert client.post(url, headers={"X-Internal-Token": "wrong"}).status_code == 401
        assert client.post("/summaries/5930", headers=head).status_code == 422
        make.assert_not_called()

        stored.return_value = ("옛 요약", now - timedelta(minutes=1))
        got = client.post(url, headers=head).json()
        assert got["regenerated"] is False and got["newsSummary"] == "옛 요약", "10분 안에는 LLM 안 부름"
        make.assert_not_called()

        stored.side_effect = [("옛 요약", now - timedelta(minutes=11)), ("새 요약", now)]
        got = client.post(url, headers=head).json()
        assert got["regenerated"] is True and got["newsSummary"] == "새 요약" and got["generatedAt"].endswith("+09:00")

        # 방금 호출했으면 저장 시각이 오래돼도, 앞 호출이 실패했어도 LLM 안 부름
        make.reset_mock()
        stored.side_effect = None
        stored.return_value = ("옛 요약", now - timedelta(minutes=11))
        assert client.post(url, headers=head).json()["regenerated"] is False
        make.assert_not_called()
    with mock.patch.dict(os.environ, {"AI_INTERNAL_TOKEN": ""}), mock.patch.object(api, "regenerate") as make:
        assert client.post(url).status_code == 401, "서버에 토큰이 없으면 전부 거부"
        make.assert_not_called()

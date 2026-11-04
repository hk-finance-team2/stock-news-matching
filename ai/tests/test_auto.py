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
    with mock.patch.object(loop, "get_engine"), mock.patch.object(loop, "run", side_effect=[True, RuntimeError("실패"), False]) as run, \
            mock.patch.object(loop.time, "sleep", side_effect=[None, None, Stop]):
        try:
            loop.main()
            raise AssertionError("멈춰야 함")
        except Stop:
            pass
    assert [c.kwargs["daily"] for c in run.call_args_list] == [True, False, False]


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
    from hk_llm.steps.sns import clean, keep, published

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

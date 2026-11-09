"""수집 단계 규칙 시험. 실제 기사 없음. step3 은 DB, robots 는 인터넷 필요"""
from datetime import datetime
from unittest import mock


def test_step1_rss():
    from hk_llm.core.config import KST
    from hk_llm.steps.step1_rss import ET, parse

    sample = """<rss><channel>
      <item><title><![CDATA[삼성전자 급등]]></title><link>https://www.fnnews.com/news/1</link>
        <author><![CDATA[bng@fnnews.com 김희선]]></author><pubDate>Mon,2 Nov 2026 07:04:55 +0900</pubDate></item>
      <item><title>제목만</title><link>https://www.hankyung.com/article/2</link>
        <author>도쿄=최만수</author></item>
      <item><title>링크 없음</title></item>
    </channel></rss>"""
    now = datetime(2026, 11, 2, 9, 0, tzinfo=KST)
    a, b = parse(sample, "테스트", now)
    assert a.reporter == "김희선" and a.published_at.isoformat() == "2026-11-02T07:04:55+09:00"
    assert b.reporter == "최만수" and b.published_at == now and b.description is None
    other = """<rss xmlns:dc="http://purl.org/dc/elements/1.1/"><channel>
      <item><title>오지 않은 &amp;quot;업토버&amp;quot;</title><link>https://a/1</link><author>전병훈 기자</author>
        <pubDate>2026-11-02 15:17:18</pubDate></item>
      <item><title>호반</title><link>https://a/2</link><author>j@bizwatch.co.kr(강민경 기자)</author>
        <dc:date>2026-11-02T15:19:02+09:00</dc:date></item>
    </channel></rss>"""
    c, d = parse(other, "테스트", now)
    assert c.title == '오지 않은 "업토버"' and c.reporter == "전병훈"
    assert c.published_at.isoformat() == "2026-11-02T15:17:18+09:00"
    assert d.reporter == "강민경" and d.published_at.isoformat() == "2026-11-02T15:19:02+09:00"
    try:
        parse('<!DOCTYPE r [<!ENTITY x "y">]><rss><item><title>&x;</title></item></rss>', "테스트")
        raise AssertionError("엔티티가 든 XML 은 거부해야 함")
    except ET.ParseError as e:
        raise AssertionError(f"defusedxml 전용 오류여야 함: {e}") from e
    except ValueError:
        pass  # defusedxml 의 EntitiesForbidden


def test_step2_dedup():
    from hk_llm.core.models import Article
    from hk_llm.steps.step2_dedup import dedup_by_url, url_key

    # 조사 5번 실제 사례 (RSS 주소 vs 네이버 API 주소)
    assert url_key("https://www.yna.co.kr/view/AKR20261030137800008?input=1195m") == "https://www.yna.co.kr/view/AKR20261030137800008"
    assert url_key("https://www.sedaily.com/article/20108364?ref=naver") == "https://www.sedaily.com/article/20108364"
    k = url_key("https://www.edaily.co.kr/News/Read?newsId=0511&mediaCodeNo=257&utm_source=naver&utm_medium=news")
    assert k == "https://www.edaily.co.kr/News/Read?mediaCodeNo=257&newsId=0511", k  # 기사 번호는 남김
    assert url_key("https://WWW.Hankyung.com/article/202610306351i/#top") == "https://www.hankyung.com/article/202610306351i"
    assert url_key("https://x.com/News/A") != url_key("https://x.com/news/a")  # 경로 대소문자는 구분

    from datetime import datetime

    def art(url, title):
        return Article(url=url, press="연합뉴스", title=title, published_at=datetime(2026, 11, 2))

    out = dedup_by_url([art("https://www.yna.co.kr/view/AKR1", "첫 건"),
                        art("https://www.yna.co.kr/view/AKR1?input=1195m", "꼬리만 다름"),
                        art("https://www.yna.co.kr/view/AKR2", "다른 기사")])
    assert [x.title for x in out] == ["첫 건", "다른 기사"] and out[0].url_key == "https://www.yna.co.kr/view/AKR1"


def test_step3_save():
    from sqlalchemy import text
    from hk_llm.core.db import get_engine, to_db
    from hk_llm.steps.step3_save import save_listed

    # DB 가 켜져 있어야 함 (docker compose up -d db). 시험용 1건을 넣었다가 지운다
    from datetime import datetime

    from hk_llm.core.config import KST
    from hk_llm.core.models import Article

    key = "test://hk_llm/step3_save_check"
    a = Article(url=key, url_key=key, press="테스트", title="저장 확인",
                published_at=datetime(2026, 11, 2, 9, 0, tzinfo=KST))
    engine = get_engine()
    try:
        assert save_listed([a]) == 1
        assert save_listed([a]) == 0, "같은 url_key 는 두 번 안 들어감"
        with engine.connect() as conn:
            row = conn.execute(text("SELECT status, published_at FROM article WHERE url_key = :k"), {"k": key}).one()
        assert row.status == "LISTED" and row.published_at == to_db(a.published_at), "시각 KST"
    finally:
        with engine.begin() as conn:
            conn.execute(text("DELETE FROM article WHERE url_key = :k"), {"k": key})


def test_sns_db():
    # DB 가 켜져 있어야 함. 가짜 검색으로 시험용 글을 넣었다가 지움 (네이버·LLM 안 부름)
    from datetime import date, datetime
    from types import SimpleNamespace
    from unittest import mock

    import requests
    from sqlalchemy import text

    from hk_llm.core.config import KST
    from hk_llm.core.db import get_engine
    from hk_llm.steps import sns

    prefix = "https://cafe.naver.com/hkllmtestcafe/"
    code, name = "005930", "삼성전자"
    response = []

    def fake_search(kind, query):
        if kind == "blog":
            raise requests.ConnectionError("끊김")
        return [{"title": f"{name} 주가 전망", "description": "상승 기대", "link": prefix + str(n), "cafename": "주식 시험"} for n in response]

    def row(n, conn):
        return conn.execute(text("""SELECT a.article_id, a.status, a.description, a.summary, a.model, a.summarized_at,
                                           (SELECT COUNT(*) FROM article_stock s WHERE s.article_id = a.article_id) AS links,
                                           (SELECT MAX(s.relevance) FROM article_stock s WHERE s.article_id = a.article_id) AS relevance
                                    FROM article a WHERE a.url_key = :k"""), {"k": prefix + str(n)}).one()

    engine = get_engine()
    day = datetime(2000, 1, 1, tzinfo=KST)
    try:
        with mock.patch.object(sns, "search", fake_search):
            response[:] = [100]
            assert sns.collect(engine, [(code, name)]) == (0, 1), "처음 보는 카페는 기준점, 블로그 실패에도 계속"
            response[:] = [101, 99]
            assert sns.collect(engine, [(code, name)]) == (1, 1), "기준점보다 큰 번호만 새 글"
        with engine.connect() as conn:
            base, old, new = row(100, conn), row(99, conn), row(101, conn)
        assert base.status == "SKIPPED" and base.description is None and base.links == 0
        assert old.status == "SKIPPED" and old.links == 0, "번호가 작은 글은 오래된 글"
        assert new.status == "FETCHED" and new.links == 1
        assert float(new.relevance) == sns.SNS_RELEVANCE, "SNS 는 뉴스보다 관련도를 낮게 (F-05)"

        item = SimpleNamespace(article_id=new.article_id, title="제목", description="상승 기대")
        opinion = sns.Opinion(posts=[sns.Post(id=new.article_id, about=True, sentiment="POSITIVE", reason="실적 기대")], summary="기대 의견")
        assert sns.save_result(engine, code, [item], opinion, day) == 1
        summary_sql = text("SELECT sns_summary FROM stock_daily_summary WHERE stock_code = :c AND summary_date = :d")
        with engine.connect() as conn:
            done = row(101, conn)
            assert conn.execute(summary_sql, {"c": code, "d": date(2000, 1, 1)}).scalar() == "기대 의견"
        assert done.status == "DONE" and done.summary == "상승 기대"
        assert done.model is None and done.summarized_at is None, "원문 미리보기를 AI 요약으로 표시하면 안 됨"

        opinion.summary = ""
        sns.save_result(engine, code, [item], opinion, day)
        with engine.connect() as conn:
            assert conn.execute(summary_sql, {"c": code, "d": date(2000, 1, 1)}).scalar() == "기대 의견", "버린 요약은 덮어쓰지 않음"

        with engine.begin() as conn:  # 같은 글을 다시 분석 전으로 돌려 "이 종목 이야기 아님" 답을 시험
            conn.execute(text("UPDATE article SET status = 'FETCHED' WHERE article_id = :i"), {"i": new.article_id})
        opinion = sns.Opinion(posts=[sns.Post(id=new.article_id, about=False, sentiment="POSITIVE", reason="급등종목 모음")], summary="")
        assert sns.save_result(engine, code, [item], opinion, day) == 0
        with engine.connect() as conn:
            assert row(101, conn).status == "SKIPPED", "모음 글·이름이 출처로만 나온 글은 화면에 안 나감"

        old_spam = SimpleNamespace(article_id=old.article_id, title="제목", description="abc.com 으로 오세요")
        with engine.begin() as conn:
            conn.execute(text("UPDATE article SET status = 'FETCHED', description = :d WHERE article_id = :i"), {"d": old_spam.description, "i": old.article_id})
        opinion = sns.Opinion(posts=[sns.Post(id=old.article_id, about=True, sentiment="NEUTRAL", reason="의견")], summary="")
        assert sns.save_result(engine, code, [old_spam], opinion, day) == 0
        with engine.connect() as conn:
            hidden = row(99, conn)
        assert hidden.status == "SKIPPED" and hidden.description is None and hidden.summary is None, "원문이 화면에 나가면 안 됨"

        sns.top_stocks(engine, 1)  # 쿼리가 DB 에서 돌아가는지
        with engine.begin() as conn:  # 101번만 8일 전에 모은 글로
            conn.execute(text("UPDATE article SET collected_at = NOW() - INTERVAL 8 DAY WHERE article_id = :i"), {"i": new.article_id})
        assert sns.purge_old_sns(engine) >= 1
        with engine.connect() as conn:
            left = conn.execute(text("SELECT COUNT(*) FROM article WHERE url_key LIKE :k"), {"k": prefix + "%"}).scalar()
            links = conn.execute(text("SELECT COUNT(*) FROM article_stock WHERE article_id = :i"), {"i": new.article_id}).scalar()
        assert left == 2 and links == 0, "7일 지난 SNS 글은 종목 연결과 함께 지움, 최근 글은 남김"

        with mock.patch.object(sns, "run_sns") as run_sns:
            with engine.connect() as other:
                assert other.execute(text("SELECT GET_LOCK('hk_llm_sns', 0)")).scalar() == 1
                assert sns.run_locked(engine) is False and not run_sns.called, "앞 실행이 돌면 건너뜀"
                other.execute(text("SELECT RELEASE_LOCK('hk_llm_sns')"))
            assert sns.run_locked(engine) is True and run_sns.called
            run_sns.side_effect = RuntimeError("실패")
            assert sns.run_locked(engine) is False, "실패해도 예외가 스레드 밖으로 안 나감"
    finally:
        with engine.begin() as conn:
            conn.execute(text("DELETE s FROM article_stock s JOIN article a USING (article_id) WHERE a.url_key LIKE :k"), {"k": prefix + "%"})
            conn.execute(text("DELETE FROM article WHERE url_key LIKE :k"), {"k": prefix + "%"})
            conn.execute(text("DELETE FROM stock_daily_summary WHERE stock_code = :c AND summary_date = :d"), {"c": code, "d": date(2000, 1, 1)})


def test_step4_extract():
    from hk_llm.steps.step4_body import extract

    html = """<html><body><div id="articletxt">
        <figure><figcaption>사진=SOOP</figcaption></figure>
        SOOP이 3분기 실적 부진에 급락하고 있다.<br><br>2일 오전   9시16분 코스닥시장에서<br>
        <aside>광고</aside>한경우 한경닷컴 기자 case@hankyung.com</div></body></html>"""
    got = extract(html, "https://www.hankyung.com/article/1")
    assert got == "SOOP이 3분기 실적 부진에 급락하고 있다.\n2일 오전 9시16분 코스닥시장에서", repr(got)
    assert extract(html, "https://unknown.example/1") is None
    # 바이트로 받은 페이지: meta charset 을 따라 UTF-8 로 읽어야 함 (2026-11-05 파이낸셜뉴스 글자 깨짐 버그)
    fn = ('<html><head><title>t</title></head><body>' + '<!-- 긴 머리말 -->' * 200 + '<meta charset="UTF-8" />'
          '<div class="article-view__body">삼성전자가 3분기 영업이익 10조원을 기록했다. 시장 예상을 웃돌았다.</div></body></html>').encode("utf-8")
    got = extract(fn, "https://www.fnnews.com/news/1")
    assert got and got.startswith("삼성전자가 3분기"), repr(got)
    nometa = '<html><body><div class="article-view__body">한글 본문입니다.</div></body></html>'.encode("utf-8")
    assert extract(nometa, "https://www.fnnews.com/news/2") == "한글 본문입니다.", "meta 가 없으면 UTF-8"
    tagged = ('<div class="article-view__body"><div>관련종목하림지주(003380), 팬오션(028670)</div>'
              '팬오션이 선박을 자사선으로 전환한다.</div>')
    assert extract(tagged, "https://www.fnnews.com/news/3") == "팬오션이 선박을 자사선으로 전환한다.", "관련종목 꼬리표는 뺌"
    from hk_llm.steps.step4_body import TABLES_DROPPED
    before = TABLES_DROPPED["www.fnnews.com"]
    withtable = '<div class="article-view__body">실적이 늘었다.<table><tr><td>매출</td><td>1조</td></tr></table></div>'
    assert extract(withtable, "https://www.fnnews.com/news/4") == "실적이 늘었다.", "표는 빼고"
    assert TABLES_DROPPED["www.fnnews.com"] == before + 1, "버린 표 수를 셈 (07)"


def test_health_rules():
    """수집 점검 (health.py): DB 없이 판단 규칙만"""
    from datetime import datetime, timedelta

    from hk_llm.steps import health
    from hk_llm.steps.step4_body import broken

    now = datetime(2026, 11, 6, 9, 0)
    assert health.gap_issue(now - timedelta(minutes=10), now) is None, "15분 이내는 정상"
    assert health.gap_issue(now - timedelta(minutes=25), now).startswith("수집 공백 25분"), "15분 넘으면 공백"
    assert health.gap_issue(None, now) is None, "처음 실행"
    feed = "https://rss.etnews.com/02.xml"
    errs = [f"실패한 피드: {feed} (ParseError: x)"] * health.FEED_STREAK
    assert health.feed_issues(errs, [feed, "https://other"]) == [f"피드 {health.FEED_STREAK}번 연속 실패: {feed}"]
    assert health.feed_issues(errs[:-1] + [None], [feed]) == [], "한 번이라도 성공하면 연속 아님"
    assert health.feed_issues(errs[:3], [feed]) == [], "기록이 모자라면 판단 안 함"
    got = health.volume_issues({"전자신문": 0, "한국경제": 50}, {"전자신문": 13, "한국경제": 54, "작은곳": 4})
    assert got == ["수집량 급감 전자신문: 최근 24시간 0건 (지난 7일 하루 평균 13건)"], "평균 절반 아래만, 평균이 작은 곳은 빼고"
    assert broken("ì¤ì\x80ë\x8f" * 3) and not broken("삼성전자가 3분기 영업이익 10조원을 기록했다. Ã 한 글자"), "글자 깨짐 의심"


def test_notify_rules():
    """Slack 알림: 새 문제·해결·12시간 뒤 다시만, 숫자만 바뀐 건 같은 문제. 네트워크 없음"""
    from hk_llm.core import notify

    assert notify.key("수집 공백 25분 (마지막 성공 11/05 15:21)") == notify.key("수집 공백 1,336분 (마지막 성공 11/06 09:00)")
    assert notify.key("멈춘 기사 전자신문 34건 (…)") != notify.key("멈춘 기사 한국경제 5건 (…)")
    first, s1 = notify.plan(["수집 공백 25분 (x)", "멈춘 기사 전자신문 34건 (y)"], {}, now=0)
    assert first == ["🔴 수집 공백 25분 (x)", "🔴 멈춘 기사 전자신문 34건 (y)"]
    again, s2 = notify.plan(["수집 공백 30분 (x)", "멈춘 기사 전자신문 35건 (y)"], s1, now=600)
    assert again == [] and s2 == s1, "숫자만 바뀐 같은 문제는 다시 안 보냄"
    later, s3 = notify.plan(["멈춘 기사 전자신문 40건 (y)"], s2, now=13 * 3600)
    assert later == ["🟠 아직 계속됨: 멈춘 기사 전자신문 40건 (y)", "✅ 해결됨: 수집 공백 25분 (x)"], later
    assert notify.plan([], s3, now=13 * 3600 + 1)[0] == ["✅ 해결됨: 멈춘 기사 전자신문 40건 (y)"]
    with mock.patch.dict("os.environ", {"SLACK_WEBHOOK_URL": ""}):  # .env 의 진짜 주소로 보내지 않게
        assert notify.send("시험", url="") is False, "주소가 없으면 안 보냄"


def test_robots():
    from hk_llm.steps.robots import allowed

    # 2026-10-30 확인 결과 기준. 사이트가 robots.txt 를 바꾸면 달라질 수 있음
    assert allowed("https://www.hankyung.com/article/2026103049506")
    assert not allowed("https://www.hankyung.com/print/2026103049506")
    assert not allowed("https://news.mt.co.kr/mtview.php?no=2025092114541910435")
    assert allowed("https://www.yna.co.kr/view/AKR20261030097100055")


def test_robots_failure_not_cached():
    from types import SimpleNamespace

    import requests

    from hk_llm.steps import robots, step4_body

    url = "https://www.hankyung.com/article/1"
    ok = SimpleNamespace(ok=True, status_code=200, text="User-agent: *\nDisallow: /print/\n")
    robots._parser.cache_clear()
    robots._down.clear()
    try:
        with mock.patch.object(robots.requests, "get", side_effect=requests.ConnectionError("끊김")) as get:
            assert not robots.reachable(url) and not robots.allowed(url), "실패는 수집 안 함"
            assert get.call_count == 1, "실패한 사이트를 URL 마다 다시 묻지 않음 (backfill)"
        robots._down.clear()
        with mock.patch.object(robots.requests, "get", return_value=SimpleNamespace(ok=False, status_code=503, text="")):
            assert not robots.reachable(url), "5xx 도 일시적"
        robots._down.clear()  # 기다리는 시간이 지났다고 치고
        with mock.patch.object(robots.requests, "get", return_value=ok) as get:
            assert robots.reachable(url) and robots.allowed(url), "실패가 굳으면 안 됨"
            assert not robots.allowed("https://www.hankyung.com/print/1")
            assert get.call_count == 1, "성공은 캐시"

        robots._parser.cache_clear()
        robots._down.clear()
        row = SimpleNamespace(article_id=1, url=url, retry_count=0)
        engine = mock.MagicMock()
        engine.connect.return_value.__enter__.return_value.execute.return_value.all.return_value = [row, row]
        with mock.patch.object(robots.requests, "get", side_effect=requests.ConnectionError("끊김")) as get, \
                mock.patch.object(step4_body, "_get") as page, mock.patch.object(step4_body, "_update") as update:
            assert step4_body.fetch_bodies(engine)["RETRY"] == 2
        assert get.call_count == 1, "같은 실행에서 다시 안 물어봄"
        assert not page.called, "확인 못 한 사이트엔 본문 요청 안 함"
        # SKIPPED 로 굳지 않고 LISTED 그대로, 재시도 횟수도 안 셈. 이유만 남김 (수집 점검이 "멈춘 기사"의 이유로 보여 줌)
        assert all(c.kwargs.get("status") == "LISTED" and c.kwargs.get("tries") is None and "robots" in c.kwargs.get("error", "")
                   for c in update.call_args_list) and update.call_count == 2, update.call_args_list
    finally:
        robots._parser.cache_clear()
        robots._down.clear()


def test_dart_rules():
    import requests
    from hk_llm.core.config import KST
    from hk_llm.steps.dart import API, _get_page, important, published

    # 필터·시각·키 보호 시험 (네트워크 없음)
    from unittest import mock

    for title in ("연결재무제표기준영업(잠정)실적(공정공시)", "단일판매ㆍ공급계약체결", "주요사항보고서(자기주식취득결정)", "공개매수신고서"):
        assert important(title), title
    for title in ("증권발행실적보고서", "합병등종료보고서", "자기주식처분결과보고서", "공개매수설명서", "결산실적공시예고(안내공시)",
                  "임원ㆍ주요주주특정증권등소유상황보고서", "조회공시요구(현저한시황변동)에대한답변(중요공시대상없음)"):
        assert not important(title), title
    now = datetime(2026, 11, 2, 15, 0, tzinfo=KST)
    assert published("20261102", now) == now
    assert published("20261101", now) == datetime(2026, 11, 1, tzinfo=KST)
    secret = "SECRETKEY"
    boom = requests.ConnectionError(f"{API}?crtfc_key={secret}")
    with mock.patch("hk_llm.steps.dart.requests.get", side_effect=boom):
        try:
            _get_page(secret, "Y", "20261101", "20261102", 1)
            raise AssertionError("예외가 나야 함")
        except RuntimeError as e:
            assert secret not in str(e) and e.__cause__ is None and e.__suppress_context__, "오류에 키가 남으면 안 됨"


def test_util_retry():
    import requests
    from hk_llm.core.util import retry

    calls = []

    def flaky():  # 두 번 끊겼다가 성공
        calls.append(1)
        if len(calls) < 3:
            raise requests.ConnectionError("끊김")
        return "ok"

    assert retry(flaky, wait=0) == "ok" and len(calls) == 3

    def not_found():
        r = requests.Response()
        r.status_code = 404
        calls.append(1)
        return r

    calls.clear()
    try:
        retry(not_found, wait=0)
        raise AssertionError("404 는 예외가 나야 함")
    except requests.HTTPError:
        assert len(calls) == 1, "404 는 다시 해도 같으니 재시도 안 함"

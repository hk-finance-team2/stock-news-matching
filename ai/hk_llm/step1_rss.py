"""1단계 (15번): 언론사 7곳의 RSS 11개에서 기사 목록 받기. 실행: python -m hk_llm.step1_rss (ai 폴더에서) → 피드별 건수와 예시 출력

돌려주는 값: Article 목록 (models.py)
중복 제거(16번)·DB 저장(18번)은 여기서 하지 않는다.
"""
import html
import re
from datetime import datetime
from email.utils import parsedate_to_datetime

import defusedxml.ElementTree as ET  # 외부 XML 이라 안전한 파서 (XXE·엔티티 폭탄 방지)
import requests

from hk_llm.util import get_logger, retry
from hk_llm.config import KST, USER_AGENT
from hk_llm.models import Article

FEEDS = {
    "한국경제": ["https://www.hankyung.com/feed/finance", "https://www.hankyung.com/feed/economy"],
    "연합뉴스": ["https://www.yna.co.kr/rss/economy.xml", "https://www.yna.co.kr/rss/market.xml"],
    "서울경제": ["https://www.sedaily.com/rss/finance", "https://www.sedaily.com/rss/economy"],
    "파이낸셜뉴스": [
        "https://www.fnnews.com/rss/r20/fn_realnews_stock.xml",
        "https://www.fnnews.com/rss/r20/fn_realnews_economy.xml",
    ],
    "전자신문": ["https://rss.etnews.com/02.xml"],
    "연합인포맥스": ["https://news.einfomax.co.kr/rss/allArticle.xml"],
    "비즈워치": ["https://news.bizwatch.co.kr/rss"],
}
DC = "{http://purl.org/dc/elements/1.1/}"  # 연합뉴스 기자명은 <dc:creator>

log = get_logger(__name__)


def _text(item, tag):
    v = item.findtext(tag)
    return v.strip() if v and v.strip() else None


def _reporter(raw):
    # "bng@fnnews.com 김희선" → "김희선", "도쿄=최만수" → "최만수", "전병훈 기자" → "전병훈"
    if not raw:
        return None
    raw = re.sub(r"[\w.+-]+@[\w.-]+", "", raw).split("=")[-1].strip(" ()")  # 비즈워치 "a@bizwatch.co.kr(강민경 기자)"
    raw = re.sub(r"\s*기자$", "", raw)
    return raw or None


def _published(raw, now):
    try:
        return parsedate_to_datetime(raw).astimezone(KST)
    except (TypeError, ValueError):
        pass
    try:  # 비즈워치 2026-11-02T15:19:02+09:00, 연합인포맥스 2026-11-02 15:17:18 (시간대 없음 = KST)
        d = datetime.fromisoformat(raw)
    except (TypeError, ValueError):
        return now  # 발행 시각 없거나 깨짐 → 수집 시각 (결정사항 4번)
    return d.astimezone(KST) if d.tzinfo else d.replace(tzinfo=KST)


def parse(xml, press, now=None):
    now = now or datetime.now(KST)
    items = []
    for it in ET.fromstring(xml).iter("item"):
        url, title = _text(it, "link"), _text(it, "title")
        if not url or not title:
            continue
        items.append(Article(
            url=url,
            press=press,
            title=html.unescape(title),  # 연합인포맥스 제목에 &quot; 가 그대로 옴
            reporter=_reporter(_text(it, "author") or _text(it, DC + "creator")),
            description=_text(it, "description"),
            published_at=_published(_text(it, "pubDate") or _text(it, DC + "date"), now),
        ))
    return items


def fetch_feed(url, press):
    res = retry(lambda: requests.get(url, headers={"User-Agent": USER_AGENT}, timeout=15))
    return parse(res.content, press)  # bytes 로 넘겨야 XML 선언의 인코딩을 따름


def fetch_all():
    """피드 하나가 실패해도 나머지는 계속. 실패한 피드는 로그만 남긴다."""
    articles, failed = [], []
    for press, urls in FEEDS.items():
        for url in urls:
            try:
                got = fetch_feed(url, press)
                log.info("%s %s → %d건", press, url, len(got))
                articles += got
            except Exception as e:
                log.error("RSS 실패 %s: %s", url, e)
                failed.append(url)
    return articles, failed


if __name__ == "__main__":
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

    articles, failed = fetch_all()
    assert not failed, f"실패한 피드: {failed}"
    assert all(x.published_at.utcoffset().total_seconds() == 9 * 3600 for x in articles)
    log.info("총 %d건 (중복 포함). 예: %s", len(articles), articles[0])

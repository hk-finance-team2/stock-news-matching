"""언론사 RSS 8개에서 기사 목록 받기 (15번). 실행: python -m hk_llm.collector.rss_collector (ai 폴더에서) → 피드별 건수와 예시 출력

돌려주는 값: ArticleDto 목록 (dto/article_dto.py)
중복 제거(16번)·DB 저장(18번)은 여기서 하지 않는다.
"""
import re
import xml.etree.ElementTree as ET
from datetime import datetime
from email.utils import parsedate_to_datetime

import requests

from hk_llm.common.logger import get_logger
from hk_llm.common.retry import retry
from hk_llm.config import KST, USER_AGENT
from hk_llm.dto.article_dto import ArticleDto

FEEDS = {
    "한국경제": ["https://www.hankyung.com/feed/finance", "https://www.hankyung.com/feed/economy"],
    "연합뉴스": ["https://www.yna.co.kr/rss/economy.xml", "https://www.yna.co.kr/rss/market.xml"],
    "서울경제": ["https://www.sedaily.com/rss/finance", "https://www.sedaily.com/rss/economy"],
    "파이낸셜뉴스": [
        "https://www.fnnews.com/rss/r20/fn_realnews_stock.xml",
        "https://www.fnnews.com/rss/r20/fn_realnews_economy.xml",
    ],
}
DC = "{http://purl.org/dc/elements/1.1/}"  # 연합뉴스 기자명은 <dc:creator>

log = get_logger(__name__)


def _text(item, tag):
    v = item.findtext(tag)
    return v.strip() if v and v.strip() else None


def _reporter(raw):
    # "bng@fnnews.com 김희선" → "김희선", "도쿄=최만수" → "최만수"
    if not raw:
        return None
    raw = re.sub(r"\S+@\S+", "", raw).split("=")[-1].strip()
    return raw or None


def _published(raw, now):
    try:
        return parsedate_to_datetime(raw).astimezone(KST)
    except (TypeError, ValueError):
        return now  # 발행 시각 없거나 깨짐 → 수집 시각 (결정사항 4번)


def parse(xml, press, now=None):
    now = now or datetime.now(KST)
    items = []
    for it in ET.fromstring(xml).iter("item"):
        url, title = _text(it, "link"), _text(it, "title")
        if not url or not title:
            continue
        items.append(ArticleDto(
            url=url,
            press=press,
            title=title,
            reporter=_reporter(_text(it, "author") or _text(it, DC + "creator")),
            description=_text(it, "description"),
            published_at=_published(_text(it, "pubDate"), now),
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

    articles, failed = fetch_all()
    assert not failed, f"실패한 피드: {failed}"
    assert all(x.published_at.utcoffset().total_seconds() == 9 * 3600 for x in articles)
    log.info("총 %d건 (중복 포함). 예: %s", len(articles), articles[0])

"""2단계 (16번): 기사 중복 제거, 주소 기준

    from hk_llm.step2_dedup import dedup_by_url
    articles = dedup_by_url(articles)  # Article 마다 url_key 가 채워지고, 같은 url_key 는 첫 건만 남음

이번 실행 안에서의 중복만 거른다. 이미 DB 에 있는 기사는 step3_save 에서
`article.url_key` UNIQUE 로 걸러진다.
"""
from dataclasses import replace
from urllib.parse import parse_qsl, urlencode, urlsplit, urlunsplit

from hk_llm.util import get_logger
from hk_llm.models import Article

# 결정사항 4번: 추적용 꼬리만 뗀다. 기사 번호 꼬리(newsId, idxno 등)는 남김
TRACKING = {"ref", "input"}
TRACKING_PREFIX = ("utm_",)
URL_KEY_MAX = 500  # article.url_key VARCHAR(500)

log = get_logger(__name__)


def _tracking(name):
    name = name.lower()
    return name in TRACKING or name.startswith(TRACKING_PREFIX)


def url_key(url):
    p = urlsplit(url.strip())
    query = urlencode(sorted((k, v) for k, v in parse_qsl(p.query, keep_blank_values=True) if not _tracking(k)))
    # 호스트 대소문자·#뒤·끝 / 는 같은 기사 → 맞춤. 경로 대소문자는 사이트마다 의미가 달라 그대로
    return urlunsplit((p.scheme.lower(), p.netloc.lower(), p.path.rstrip("/") or "/", query, ""))


def dedup_by_url(articles):
    seen, out = set(), []
    for a in articles:
        key = url_key(a.url)
        if len(key) > URL_KEY_MAX:
            log.warning("주소가 너무 길어 건너뜀 (%d자): %s", len(key), a.url)
            continue
        if key in seen:
            continue
        seen.add(key)
        out.append(replace(a, url_key=key))
    log.info("주소 중복 제거: %d건 → %d건", len(articles), len(out))
    return out


if __name__ == "__main__":
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

    from hk_llm.step1_rss import fetch_all
    articles, _ = fetch_all()
    out = dedup_by_url(articles)
    assert len({x.url_key for x in out}) == len(out)
    print("ok", len(articles), "→", len(out))

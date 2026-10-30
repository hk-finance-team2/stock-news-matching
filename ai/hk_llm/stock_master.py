"""KRX 상장 종목 마스터(종목명-코드) 받기. 실행: python stock_master.py → data/stocks.csv

출처: KIND(한국거래소 기업공시채널) 상장법인목록 '엑셀 다운로드' 버튼과 같은 주소.
엑셀이라고 하지만 실제로는 EUC-KR HTML 표라서 표준 라이브러리로 읽는다.

코스피200 여부: data/kospi200.csv (KRX Data Marketplace [11006] 지수구성종목, 수동 다운로드).
로그인이 필요해 자동으로 못 받음. 매년 6월·12월 정기변경 때 다시 받아서 덮어쓴다.
"""
import csv
from html.parser import HTMLParser
from pathlib import Path

import requests

from robots import USER_AGENT

URL = "https://kind.krx.co.kr/corpgeneral/corpList.do"
OUT = Path(__file__).parent / "data" / "stocks.csv"
KOSPI200 = Path(__file__).parent / "data" / "kospi200.csv"
COLUMNS = ["종목코드", "회사명", "시장구분", "업종", "코스피200"]
MARKETS = {"유가": "KOSPI", "코스닥": "KOSDAQ", "코넥스": "KONEX"}


class _Table(HTMLParser):
    def __init__(self):
        super().__init__()
        self.rows, self._row, self._cell = [], None, None

    def handle_starttag(self, tag, attrs):
        if tag == "tr":
            self._row = []
        elif tag in ("td", "th") and self._row is not None:
            self._cell = ""

    def handle_data(self, data):
        if self._cell is not None:
            self._cell += data

    def handle_endtag(self, tag):
        if tag in ("td", "th") and self._cell is not None:
            self._row.append(self._cell.strip())
            self._cell = None
        elif tag == "tr" and self._row:
            self.rows.append(self._row)
            self._row = None


def parse(html):
    t = _Table()
    t.feed(html)
    header, *rows = t.rows
    idx = {name: header.index(name) for name in ["회사명", "시장구분", "종목코드", "업종"]}
    return [
        {
            "종목코드": r[idx["종목코드"]].zfill(6),
            "회사명": r[idx["회사명"]],
            "시장구분": MARKETS.get(r[idx["시장구분"]], r[idx["시장구분"]]),
            "업종": r[idx["업종"]],
        }
        for r in rows
    ]


def download():
    res = requests.get(
        URL,
        params={"method": "download", "searchType": 13},
        headers={"User-Agent": USER_AGENT},
        timeout=30,
    )
    res.raise_for_status()
    res.encoding = "euc-kr"
    return parse(res.text)


def kospi200_codes():
    # KRX 다운로드 CSV 는 CP949 인코딩 (UTF-8 편집기에서 열면 깨져 보임)
    with KOSPI200.open(encoding="cp949", newline="") as f:
        return {row["종목코드"] for row in csv.DictReader(f)}


def save(stocks):
    OUT.parent.mkdir(exist_ok=True)
    # utf-8-sig: 엑셀로 열어도 한글이 안 깨지게
    with OUT.open("w", encoding="utf-8-sig", newline="") as f:
        w = csv.DictWriter(f, fieldnames=COLUMNS)
        w.writeheader()
        w.writerows(sorted(stocks, key=lambda s: s["종목코드"]))


if __name__ == "__main__":
    stocks = download()
    by_code = {s["종목코드"]: s for s in stocks}
    assert by_code["005930"]["회사명"] == "삼성전자" and by_code["005930"]["시장구분"] == "KOSPI"
    assert len(by_code) == len(stocks), "종목코드 중복"
    k200 = kospi200_codes()
    assert not k200 - by_code.keys(), f"마스터에 없는 코스피200 종목: {k200 - by_code.keys()}"
    for s in stocks:
        s["코스피200"] = "Y" if s["종목코드"] in k200 else "N"
    assert by_code["005930"]["코스피200"] == "Y"
    save(stocks)
    counts = {m: sum(s["시장구분"] == m for s in stocks) for m in MARKETS.values()}
    print(f"{len(stocks)}개 저장 → {OUT}  {counts}  코스피200 {len(k200)}개")

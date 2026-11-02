"""7단계 (17번): 같은 사건을 다룬 비슷한 기사 묶기. 아직 저장하지 않음 (DB 칸 필요, 백엔드 요청 전)

    from hk_llm.step7_group import group_articles
    groups = group_articles(rows)   # rows: article_id, stock_code, stock_name, title, published_at

묶는 조건: 같은 종목 + 비슷한 제목 + 가까운 시각. 기사를 버리지 않는다.
제목 유사도: 괄호·기호·공백과 종목명을 뺀 뒤 글자 2개씩 자른 조각의 겹침 비율 (Jaccard)
🧪 SIMILAR·WINDOW 는 임시값. 실제 기사가 쌓이면 다시 본다
"""
import re
from datetime import timedelta

SIMILAR = 0.15  # 수집한 실제 제목 쌍 179개를 읽어 정함: 0.15 이상은 같은 사건, 0.05 아래는 다른 소식이 섞임
WINDOW = timedelta(hours=24)


def _bigrams(title, stock_name=""):
    t = re.sub(r"\[[^\]]*\]|\([^)]*\)", "", title)
    t = re.sub(r"[^0-9A-Za-z가-힣]", "", t.replace(stock_name, "")).upper()
    return {t[i:i + 2] for i in range(len(t) - 1)}


def similarity(a, b, stock_name=""):
    x, y = _bigrams(a, stock_name), _bigrams(b, stock_name)
    return len(x & y) / len(x | y) if x and y else 0.0


def group_articles(rows, similar=SIMILAR, window=WINDOW):
    """[{stock_code, stock_name, article_ids}] — 2건 이상인 묶음만. 한 기사가 여러 종목 묶음에 들어갈 수 있음"""
    by_stock = {}
    for r in rows:
        by_stock.setdefault(r["stock_code"], []).append(r)
    groups = []
    for code, items in by_stock.items():
        parent = {r["article_id"]: r["article_id"] for r in items}

        def find(x):
            while parent[x] != x:
                parent[x] = parent[parent[x]]
                x = parent[x]
            return x

        for i, a in enumerate(items):  # ponytail: 종목 안에서 모든 쌍 비교. 하루치 기준이라 충분, 많아지면 시각순으로 자르기
            for b in items[i + 1:]:
                near = abs(a["published_at"] - b["published_at"]) <= window
                if near and similarity(a["title"], b["title"], a["stock_name"]) >= similar:
                    parent[find(a["article_id"])] = find(b["article_id"])
        found = {}
        for r in items:
            found.setdefault(find(r["article_id"]), []).append(r["article_id"])
        groups += [{"stock_code": code, "stock_name": items[0]["stock_name"], "article_ids": sorted(ids)}
                   for ids in found.values() if len(ids) > 1]
    return groups


def load_rows(engine):
    from sqlalchemy import text
    sql = text("""SELECT a.article_id, s.stock_code, i.stock_name, a.title, a.published_at
                  FROM article a JOIN article_stock s USING (article_id) JOIN stock_info i USING (stock_code)
                  WHERE a.status = 'DONE' AND a.channel = 'RSS'""")
    with engine.connect() as conn:
        return [dict(r._mapping) for r in conn.execute(sql)]


if __name__ == "__main__":
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
    ]
    other = [  # 같은 종목, 다른 사건 (앞 2개는 수집한 실제 제목, 나머지는 임의로 만듦)
        ("SK하이닉스", "[특징주] 삼성전자 장초반 3%대 급락…SK하이닉스도 1.5%↓", "채용혜택 내건 SK하이닉스 AI해커톤, 시스템장애로 예선 중단"),
        ("SK하이닉스", '"SK하이닉스, 4분기 영업익 사상 첫 100조 돌파 전망"-KB', "채용혜택 내건 SK하이닉스 AI해커톤, 시스템장애로 예선 중단"),
        ("삼성전자", "삼성전자, 3분기 영업이익 시장 예상 상회", "삼성전자, 자사주 10조원 매입 결정"),
        ("삼성전자", "삼성전자, 미국 공장 증설 검토", "삼성전자 노조, 임금 협상 결렬 선언"),
        ("HL만도", "HL만도, 자율주행 투자로 수익성 둔화", "HL만도, 유럽 완성차 업체와 공급 계약"),
    ]
    for name, a, b in same:
        print(f"같은 사건 {similarity(a, b, name):.2f} {a[:24]}")
    for name, a, b in other:
        print(f"다른 사건 {similarity(a, b, name):.2f} {a[:24]}")
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
    print("ok 규칙 시험")

    # 실제 샘플 (읽기만, DB 켜져 있어야 함)
    from hk_llm.db import get_engine

    rows = load_rows(get_engine())
    title = {r["article_id"]: r["title"] for r in rows}
    found = group_articles(rows)
    print(f"실제 샘플: 연결 {len(rows)}줄, 묶음 {len(found)}개")
    for g in found:
        print(" ", g["stock_name"], [(i, title[i][:30]) for i in g["article_ids"]])
    assert any(set(g["article_ids"]) >= {9, 1097} for g in found), "영광 상장 첫날 두 기사는 묶여야 함"
    print("ok")

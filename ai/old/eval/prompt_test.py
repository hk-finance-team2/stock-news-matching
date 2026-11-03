"""프롬프트 비교: 라벨이 있는 DONE 기사 50건을 지금·수정 프롬프트로 1번씩. DB 쓰기 없음, 본 코드 안 바꿈

    python -m eval.prompt_test   (100회 호출, 약 $0.07~0.09) → hk_llm/data/eval/prompt_test.json
"""
import json
from pathlib import Path

from langchain_core.prompts import ChatPromptTemplate
from langchain_core.runnables import RunnableSequence
from sqlalchemy import bindparam, text

from eval.score import macro_f1
from hk_llm.core.db import get_engine
from hk_llm.steps.step5_summary import MAX_CHARS, PROMPT, _strip_tag, chain, check
from hk_llm.steps.step6_match import load_dictionary, match_one, on_topic

OUT = Path(__file__).resolve().parents[1] / "hk_llm" / "data" / "eval"

OLD_SYSTEM = PROMPT.messages[0].prompt.template
HUMAN = PROMPT.messages[1].prompt.template
EDITS = [
    ("핵심 숫자(실적, 등락률)만 쓴다.\n",
     "핵심 숫자(실적, 등락률)만 쓴다.\n"
     "증권사·전문가의 전망은 'OO증권은 ~로 전망했다'처럼 주체를 밝힌다. 회사의 발표처럼 쓰지 않는다.\n"
     "기사에 목표주가 변경, 어닝쇼크, 주가 급등락이 있으면 넣는다.\n"),
    ("그날 주가나 실적에 미칠 규모가 기사에 없는 홍보·할인·서비스 출시·수상·인사·협약·행사 소식은 NEUTRAL.\n",
     "호재·악재는 실적이나 재무 전망을 바꿀 구체적인 근거가 기사에 있을 때만 쓴다.\n"
     "그 근거가 없는 홍보·할인·서비스 출시·수상·인사·협약·행사·공장 소개·경영진 방문·이용자 수 발표는 NEUTRAL.\n"
     "기사에 그 회사 주가의 급등락이 나오면 그날 감성은 그 방향을 따른다.\n"),
    ("전년보다 늘어도 전망치를 밑돌면 POSITIVE 가 아니다.\n",
     "전년보다 늘어도 전망치를 크게 밑돌면 NEGATIVE, 전망치를 크게 웃돌면 POSITIVE 다. 목표주가 하향만으로 NEGATIVE 로 보지 않는다.\n"
     "증권사가 최선호주·매수 추천으로 꼽은 회사는 POSITIVE 다.\n"),
]


def new_prompt():
    system = OLD_SYSTEM
    for a, b in EDITS:
        assert system.count(a) == 1, a
        system = system.replace(a, b)
    return ChatPromptTemplate.from_messages([("system", system), ("human", HUMAN)])


def run(prompt, title, body):
    """step5 의 summarize 와 같은 처리에 프롬프트만 바꿈"""
    out = RunnableSequence(prompt, *chain().steps[1:]).invoke({"title": _strip_tag(title), "body": _strip_tag(body[:MAX_CHARS])})
    if out["parsed"] is None:
        raise ValueError(out["parsing_error"])
    return check(out["parsed"], title, body), out["raw"].usage_metadata


def score(rows, version, labels):
    """[맞음, 틀림, 놓침], 감성 (정답, 예측) 목록"""
    link = [0, 0, 0]
    pairs = []
    for r in rows:
        if version not in r:
            continue
        lab = labels[str(r["id"])]
        got = r[version]["links"]
        link[0] += sum(s in lab["must"] or s in lab["ok"] for s in got)
        link[1] += sum(s not in lab["must"] and s not in lab["ok"] for s in got)
        link[2] += sum(s not in got for s in lab["must"])
        pairs += [(lab["sent"][s], v) for s, v in got.items() if s in lab["sent"]]
    return link, pairs


def main():
    labels = json.loads((OUT / "labels.json").read_text(encoding="utf-8"))
    sample = [d for d in json.loads((OUT / "sample.json").read_text(encoding="utf-8")) if d["status"] == "DONE"]
    engine = get_engine()
    dictionary = load_dictionary(engine)
    with engine.connect() as c:
        info = dict(c.execute(text("SELECT stock_code, stock_name FROM stock_info")).all())
        sql = text("SELECT article_id, title, body, keywords FROM article WHERE article_id IN :i").bindparams(bindparam("i", expanding=True))
        arts = {r.article_id: r for r in c.execute(sql, {"i": [d["id"] for d in sample]})}
    rows, tokens, errors = [], {"old": [0, 0], "new": [0, 0]}, []
    for d in sample:
        art, row = arts[d["id"]], {"id": d["id"], "title": d["title"]}
        row["saved"] = {"links": {x["stock"]: x["sentiment"] for x in d["links"]}, "summary": d["summary"]}
        for version, prompt in (("old", PROMPT), ("new", new_prompt())):
            try:
                s, u = run(prompt, art.title, art.body)
            except Exception as e:
                errors.append((d["id"], version, type(e).__name__, str(e)[:120]))
                continue
            tokens[version][0] += u["input_tokens"]
            tokens[version][1] += u["output_tokens"]
            comps = [c.model_dump() for c in s.companies]
            found = on_topic(art.title, art.body, match_one(comps, s.keywords, dictionary), dictionary[0])
            row[version] = {"links": {info[f[0]]: f[1]["sentiment"] for f in found}, "summary": s.summary}
        rows.append(row)
    (OUT / "prompt_test.json").write_text(json.dumps(rows, ensure_ascii=False, indent=0), encoding="utf-8")
    print("오류", errors)
    for v, (i, o) in tokens.items():
        print(v, f"토큰 {i}/{o} 비용 ${i * .2 / 1e6 + o * 1.25 / 1e6:.4f}")
    # 수정의 계기가 된 기사는 따로: 같은 기사에서 좋아지는 건 당연하므로
    seen = {100, 98, 90, 161, 205, 22, 115, 246, 414}
    for name, part in (("전체 50", rows), ("수정 계기 9건 제외", [r for r in rows if r["id"] not in seen])):
        print("---", name)
        for v in ("saved", "old", "new"):
            link, pairs = score(part, v, labels)
            macro, per = macro_f1(pairs)
            same = sum(g == q for g, q in pairs)
            print(f"{v}: 연결[맞음,틀림,놓침]={link} Macro-F1={macro:.3f}", {k[:3]: round(x, 2) for k, x in per.items()}, f"일치 {same}/{len(pairs)}")
    print("--- 저장본과 old 의 감성 차이 (같은 프롬프트의 실행 흔들림)")
    flips = total = 0
    for r in rows:
        if "old" in r:
            for s, v in r["saved"]["links"].items():
                if s in r["old"]["links"]:
                    total, flips = total + 1, flips + (v != r["old"]["links"][s])
    print(f"{flips}/{total}")
    print("--- new 와 old 가 다른 기사")
    for r in rows:
        if "old" in r and "new" in r and r["old"]["links"] != r["new"]["links"]:
            lab = labels[str(r["id"])]["sent"]
            print(r["id"], r["title"][:30], "| old", r["old"]["links"], "| new", r["new"]["links"], "| 정답", lab)
    print("--- new 요약")
    for r in rows:
        if "new" in r:
            print(r["id"], r["new"]["summary"])


if __name__ == "__main__":
    main()

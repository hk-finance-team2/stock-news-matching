"""정답지 회귀 시험 (11/06): 프롬프트·규칙·모델을 바꾸기 전에 정답지 v2.1 개발용 99건으로 다시 채점하고, 기준 아래면 실패

    python -m eval.regress --answers 답파일.jsonl     (ai 폴더에서) 규칙만 바꿨을 때: 저장해 둔 LLM 답으로 다시 채점. LLM 비용 0
    python -m eval.regress --llm                      프롬프트·모델을 바꿨을 때: 99건에 지금 요약 LLM 을 다시 돌림. 약 $0.11
    --gold 정답지폴더 (기본: 레포 data/eval/gold-v2)    --save 파일 (--llm 의 답을 저장해 다음에 --answers 로)

- 정답지는 기사 본문이 들어 있어 Git 에 없음 (data/ 는 커밋 제외, 저작권). 정답지가 있는 PC 에서만 돎
- 봉인 시험용(gold_test)은 읽지 않음
- 지표 (라벨 기준 v2.1 6절): 핵심 연결(주인공·당사자) Precision·Recall, 맞은 연결의 감성 일치 (판단 보류 = NULL)
- 기준(아래 THRESHOLDS): 11/06 새 프롬프트 3번(06-2 끈 뒤 핵심 P 0.922~0.923 / R 0.87~0.89 / 맞은 핵심 연결 감성 0.60~0.71)의 가장 낮은 값보다 조금 아래.
  기준 아래로 떨어지면 종료 코드 1 → 바꾼 것을 다시 봄
- 근거: 모델·설정을 바꾸기 전에 고정된 평가 세트로 품질을 확인 — "The ML Test Score" (Breck et al., IEEE Big Data 2017)
"""
import argparse
import json
import sys
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

from sqlalchemy import bindparam, text

from hk_llm.core.db import get_engine
from hk_llm.steps import step6_match as m

THRESHOLDS = {"core_precision": 0.90, "core_recall": 0.84, "sentiment": 0.55}
# 감성은 같은 프롬프트로도 실행마다 0.60~0.71 로 흔들려(11/06 3번) 기준을 낮게. 0.60 이면 멀쩡한 실행(0.596)도 실패로 잡힘
# 확인: 11/06 새 프롬프트 답 3번은 통과, 예전 프롬프트 답 2번은 핵심 P 0.887~0.889 로 실패 (06-2 를 끈 뒤에도 같음)
CORE = {"SUBJECT", "PARTY"}
DEFAULT_GOLD = Path(__file__).resolve().parents[2] / "data" / "eval" / "gold-v2"


def load(gold_dir):
    excluded = json.loads((gold_dir / "sample.json").read_text(encoding="utf-8")).get("excluded", {})
    arts = {a["url_key"]: a for a in map(json.loads, (gold_dir / "articles.jsonl").read_text(encoding="utf-8").splitlines())
            if a["split"] == "dev" and a["id"] not in excluded}
    gold = {g["url_key"]: g for g in map(json.loads, (gold_dir / "gold_dev.jsonl").read_text(encoding="utf-8").splitlines())
            if g["url_key"] in arts}
    return gold


def score(gold, rows, answers, dictionary):
    """rows: {url_key: (title, body)}, answers: {url_key: {"companies": [...], "keywords": "..."}}"""
    tp = fp = fn = same = both = 0
    for key, g in gold.items():
        truth = {l["code"]: l for l in g["links"] if l.get("code")}
        core = {c for c, l in truth.items() if l["role"] in CORE}
        title, body = rows.get(key, ("", None))
        a = answers.get(key, {})
        kw = (a.get("keywords") or "").split(",")
        got = {f[0]: f[1] for f in m.on_topic(title, body, m.match_one(a.get("companies") or [], kw, dictionary), dictionary[0])}
        for code, c in got.items():
            if code not in truth:
                fp += 1
            elif code in core:
                tp += 1
                both += 1
                gs = None if truth[code]["sentiment"] == "UNCERTAIN" else truth[code]["sentiment"]
                same += c["sentiment"] == gs
        fn += len(core - set(got))
    return {"core_precision": round(tp / (tp + fp), 3) if tp + fp else 0.0,
            "core_recall": round(tp / (tp + fn), 3) if tp + fn else 0.0,
            "sentiment": round(same / both, 3) if both else 0.0, "tp": tp, "fp": fp, "fn": fn}


def run_llm(rows):
    from hk_llm.steps import step5_summary as s5

    def one(item):
        key, (title, body) = item
        try:
            s, _ = s5.summarize(title, body)
            return key, {"companies": [c.model_dump() for c in s.companies], "keywords": ",".join(s.keywords)}
        except Exception as e:  # noqa: BLE001 — 실패한 기사는 연결 없음으로 셈 (점수에 그대로 드러남)
            return key, {"error": f"{type(e).__name__}: {e}"[:200]}
    with ThreadPoolExecutor(4) as ex:
        return dict(ex.map(one, rows.items()))


def main(argv=None):
    p = argparse.ArgumentParser()
    p.add_argument("--answers")
    p.add_argument("--llm", action="store_true")
    p.add_argument("--gold", default=str(DEFAULT_GOLD))
    p.add_argument("--save")
    args = p.parse_args(argv)
    if bool(args.answers) == args.llm:
        p.error("--answers 파일 또는 --llm 중 하나")
    gold = load(Path(args.gold))
    engine = get_engine()
    with engine.connect() as conn:
        rows = {r.url_key: (r.title, r.body) for r in conn.execute(
            text("SELECT url_key, title, body FROM article WHERE url_key IN :k").bindparams(bindparam("k", expanding=True)),
            {"k": list(gold)})}
    if args.llm:
        answers = run_llm(rows)
        if args.save:
            Path(args.save).write_text("".join(json.dumps({"url_key": k, **v}, ensure_ascii=False) + "\n"
                                               for k, v in answers.items()), encoding="utf-8")
    else:
        answers = {a["url_key"]: a for a in map(json.loads, Path(args.answers).read_text(encoding="utf-8").splitlines())}
    res = score(gold, rows, answers, m.load_dictionary(engine))
    failed = [k for k, v in THRESHOLDS.items() if res[k] < v]
    print(json.dumps({"기사": len(gold), **res, "기준": THRESHOLDS, "통과": not failed, "기준 아래": failed}, ensure_ascii=False))
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())

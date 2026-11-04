"""ai 문서 점검: 끊어진 링크, 코드 경로, 옛 상태 표현"""
import pathlib
import re

root = pathlib.Path(".").resolve()  # ai 폴더에서 실행
docs = [p for p in root.rglob("*.md") if ".venv" not in p.parts]
print("문서", len(docs))
for p in docs:
    s = p.read_text(encoding="utf-8")
    for m in re.finditer(r"\]\(([^)\s]+)\)", s):
        t = m.group(1).split("#")[0]
        if not t or t.startswith(("http", "mailto")):
            continue
        t = re.sub(r":\d+$", "", t)
        if not (p.parent / t).exists():
            print("끊긴 링크", p.relative_to(root), t)
    if "진행기록" in p.parts or "old" in p.parts:
        continue  # 당시 기록은 경로·상태를 그대로 둠
    for m in re.finditer(r"`((?:ai/)?(?:hk_llm|eval|tests|old)/[^`\s]+\.(?:py|json|txt|csv))`", s):
        t = m.group(1).removeprefix("ai/")
        if not (root / t).exists():
            print("없는 경로", p.relative_to(root), m.group(1))
pat = re.compile(r"자동 실행.{0,12}(없|안 |보류|아직)|35번.{0,10}보류|스케줄러|FastAPI.{0,12}(안|아직|정하)|LLM 안 씀|제목 기준|전부 .?NEUTRAL|아직 안 붙|안 붙임|저장 안 함|오래된 것부터|오래된 순|샘플 40건 확인|사람 확인|1~6단계|1→6|eval/|hk_llm/data/eval|sample40|실험 뒤|실험이 끝난|4곳|8개")
for p in docs:
    if "진행기록" in p.parts or "조사" in p.parts or "old" in p.parts:
        continue
    for i, line in enumerate(p.read_text(encoding="utf-8").splitlines(), 1):
        if pat.search(line):
            print(f"{p.relative_to(root)}:{i}: {line.strip()[:170]}")

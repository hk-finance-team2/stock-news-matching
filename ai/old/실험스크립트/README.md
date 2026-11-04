# 실험 스크립트

[../../docs/한계와_실험.md](../../docs/한계와_실험.md) 의 실험 때 돌린 스크립트. **임시 폴더에서 돌린 그대로라 경로·입력 파일을 맞춰야 돌아간다.** LLM 비용이 나가는 것이 있으니 내용을 보고 실행한다. 입력·결과 JSON 은 기사 내용이 있어 넣지 않았다.

| 실험 | 파일 |
|---|---|
| 9·11 프롬프트 평가 | `evalp.py`, `eval.py`, `miss.py`, `show.py` |
| 12 사전 보강 재매칭 | `rematch.py`, `snap.py`, `cmp.py`, `run2.py`, `hits.py` |
| 13 코드 규칙 | `gate.py`, `gate2.py`, `gate3.py`, `show3.py`, `titles.py` |
| 14 실제 실행·명단 보완 | `verify6.py`, `after30.py`, `run30.py`, `scan.py`, `check43.py` |
| 15 요약 200건 | `count.py`, `run200.py`, `prog.py`, `after200.py` |
| 16 후보 목록 방식 | `cand.py`, `hyb.py` |
| 17 말머리·관련도 등급 | `rematch300.py`, `tier.py` |
| 18 300건 점검 | `audit.py`, `audit2.py`, `step12b.py` |
| 22·23 공시·E2E | `check_nollm.py`, `e2e_small.py`, `e2e_api.py` |
| 문서 점검 | `doc_check.py` |
| SNS 수집처 시험 | `sns_probe.py`, `sns_probe2.py`, `sns_robots.py` |
| 기록 없음 | `pre.py`: 요약 전에 사전 대조로 거르는 시험. 진행기록에 결과가 없음 |

- 어느 실험인지는 파일 설명과 저장 시각으로 맞췄다 (당시 기록에 파일 이름이 없음)
- 19·20 평가 코드는 [../eval/](../eval/)
- 안 넣음: 코드 수정용 일회성 `patch*.py`, `docs6.py`, `step12.py`, 자료 조회용 `wd.py`, `x.py`. 실험 1~8·21 스크립트는 안 남아 있음

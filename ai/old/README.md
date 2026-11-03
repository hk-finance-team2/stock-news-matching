# old: 더 이상 쓰지 않는 파일

지금 코드·문서에서 빠진 파일을 버전별로 모아 둔다. **실행하지 않고 고치지 않는다** (import 경로가 옛날 그대로라 그대로는 안 돌아감). 내용만 갱신된 문서는 여기 두지 않고 Git 기록으로 본다.

| 위치 | 내용 | 원래 경로 | 출처 커밋 | 대체한 것 | 옮긴 이유 |
|---|---|---|---|---|---|
| `hk_llm_평평한구조/` | 폴더 없이 한곳에 있던 코드 11개 | `ai/hk_llm/*.py` | `cddbff1` (main) | `hk_llm/core/`, `hk_llm/steps/` | 2026-11-03 폴더 나눔 |
| `tools/stock_master.py` | KIND 상장법인목록 → `stocks.csv` | `ai/hk_llm/tools/` | `cddbff1` (main) | 백엔드 `stock_info` (V6) | 사전을 DB 에서 읽음. 팀 문서가 이 이름을 언급 |
| `tools/naver_test.py` | 네이버 뉴스 검색 키 확인 | `ai/hk_llm/tools/` | `cb9f65c^` | 없음 | 네이버 API 보류. 다시 쓸 때 복구 |
| `docs/개발순서_원본.txt` | 처음 받은 개발 순서 | `ai/docs/` | `cb9f65c^` | [../docs/개발순서.md](../docs/개발순서.md) | 번호의 기준이라 원본 보존 |

- 옮기기 전 위치와 변경 내역: `git log --follow -- <지금 경로>`
- 더 옛날 구조(dto/dao/service, `e522033` 이전)는 main 에 올라간 적이 없어 넣지 않음
- 데이터(`stocks.csv`, `kospi200.csv`, `sample_rss.json`)는 팀 규칙상 Git 제외. 내 PC `_보관/ai-안쓰는파일-20261103/` 에 있음

# ai

뉴스·공시 수집 및 LLM 요약 파이프라인 (서버 없이 실행할 때마다 돌고 끝남)

- 역할: 뉴스·공시 수집, 정제·중복 제거, 기사-종목 연결, LLM 요약, 매칭 정확도 측정
- 기술: Python, LangChain (FastAPI 는 아직 안 씀: 백엔드와 DB 로만 주고받음, 팀 합의 예정)

## 팀원이 먼저 볼 것

| 문서 | 내용 |
|---|---|
| [docs/팀공유.md](docs/팀공유.md) | AI 쪽에서 정한 것, 화면용 기사 데이터 예시 |
| [docs/AI테이블_제안.md](docs/AI테이블_제안.md) | **백엔드에 드리는** AI 테이블(`article`, `article_stock`, `collect_run`) 컬럼 제안 |
| [docs/결정사항.md](docs/결정사항.md) | 지금 기준 AI 설계 한눈에 보기 |

## 지금 상태 (2026-11-02)

- 끝: RSS 수집(15) → 중복 제거(16) → DB 저장(18) → 본문(20~22) → LLM 요약(27~34) → 종목 매칭(23·25), 공시 수집, 종목별 하루 요약(32) ([docs/개발순서.md](docs/개발순서.md))
- 다음: SNS (수집처 조사만 끝남, [docs/조사/SNS_조사.md](docs/조사/SNS_조사.md)). 사람 확인 남음: 샘플 40건 (26·33)
- 뉴스: **언론사 7곳 RSS 11개** (한경·연합·서경·파이낸셜·전자신문·연합인포맥스·비즈워치, 하루 최대 약 1,600건 추정). 정한 주기는 5분이지만 **자동 실행(35번)은 아직 없어서 직접 실행할 때만 돎**
- 흐름: RSS 목록 → 중복 제거 → 원문 본문 → LLM 요약 → 요약에서 종목 연결 (`run.py` 는 여기까지 + 공시. 묶기·하루 요약은 아직 안 붙임)
- 단계끼리는 `article.status` 로 넘김: `LISTED` → `FETCHED` → `SUMMARIZED` → `DONE` / `NO_STOCK`
- 백엔드와는 **DB 로만** 주고받음 (AI 가 쓰고 백엔드가 읽음). 테이블은 백엔드 Flyway V5·V7
- 화면에는 **요약 + 원문 링크만** (본문은 7일 후 삭제, 언론사 AI 정책)
- 보류: 자동 실행(35), 비슷한 기사 저장(17, 칸 요청은 실험 뒤), 요약·매칭 개선 ([docs/할일.md](docs/할일.md))
- 공시: DART 주요 공시를 제목 기준으로 저장 (원문 요약·감성은 아직)
- 🧪 팀 공유 필요: 매칭 점수(이름 통과 + 테마 가산점), 공시 표시 방식
- 보류: 네이버 API(과거 기록용)

## 폴더

`steps/` 의 번호가 파이프라인 순서.

```
ai/
├── README.md
├── requirements.txt
├── hk_llm/
│   ├── run.py               ★ 파이프라인 1번 실행 (1→6, 실행 기록 collect_run)
│   ├── steps/               단계별 코드. 번호 순서가 흐름 순서
│   │   ├── step1_rss.py     1. 언론사 RSS 11개 기사 목록 받기 (15번)
│   │   ├── step2_dedup.py   2. 주소 기준 중복 제거 (16번)
│   │   ├── step3_save.py    3. article 에 LISTED 로 저장 (18번)
│   │   ├── step4_body.py    4. 원문 본문 가져와 FETCHED, 7일 지난 본문 삭제 (20~22번)
│   │   ├── step5_summary.py 5. LLM 요약·감성·회사 목록 → SUMMARIZED (27~34번)
│   │   ├── step6_match.py   6. 회사 이름 → 종목 연결 → DONE / NO_STOCK (23·25번)
│   │   ├── step7_group.py   7. 비슷한 기사 묶기 (17번, 아직 저장·실행에 안 붙임)
│   │   ├── step8_daily.py   8. 종목별 하루 요약 → stock_daily_summary (32번, 자동 실행은 35번)
│   │   ├── dart.py          공시 수집: 주요 공시만 저장 → 바로 DONE (LLM 안 씀)
│   │   └── robots.py        본문 가져오기 전 robots.txt 허용 확인
│   ├── core/                여러 단계가 같이 쓰는 것
│   │   ├── config.py        설정: 폴더 위치, 시간대, .env 값
│   │   ├── db.py            DB 연결, KST 시각 변환
│   │   ├── models.py        기사 한 건의 모양 (Article, article 테이블 한 줄)
│   │   └── util.py          로그, 실패 시 재시도
│   ├── data/                (Git 제외) 검토용 샘플
│   └── logs/                (Git 제외) hk_llm.log
├── tests/                   실제 기사 없이 규칙만 확인하는 시험
└── docs/                문서 안내는 docs/README.md
```

## 실행

모든 명령은 `ai` 폴더에서 `python -m` 으로 실행한다 (`hk_llm` 패키지를 찾아야 해서).

```bash
cd ai
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
```

- 키·DB 계정은 레포 최상위 `.env` (`.env.example` 참고, 레포 `docs/setup.md` 2절)
- DB 켜기: 레포 최상위에서 `docker compose up -d db`. 테이블이 없으면 백엔드를 한 번 켬 `docker compose up -d --build backend` (Flyway 가 만듦)

| 하고 싶은 것 | 명령 |
|---|---|
| 파이프라인 1번 (RSS → 요약까지, OpenAI 비용) | `python -m hk_llm.run` |
| 요약 n건 미리보기 (저장 안 함, 건당 약 $0.0006) | `python -m hk_llm.steps.step5_summary 3` |
| 규칙 시험 전체 (LLM 비용 없음, DB·인터넷 필요) | `python -m tests` |
| 실제 공시 수집 (비용 없음, DB 저장, `DART_API_KEY` 필요) | `python -m hk_llm.steps.dart` |
| 오늘 종목별 요약 (2건 이상인 종목만 비용) | `python -m hk_llm.steps.step8_daily --run` |
| 1~3단계 시험 | `python -m hk_llm.run --check` |
| RSS 만 받아 보기 | `python -m hk_llm.steps.step1_rss` |

- 가짜 데이터로 하는 시험은 `tests/`, 각 파일 맨 아래 `if __name__ == "__main__":` 은 실제 기사·API 로 돌리는 부분
- `data/`·`logs/` 는 Git 에 올리지 않는다 (팀 규칙)

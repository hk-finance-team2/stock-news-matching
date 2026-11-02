# ai

뉴스·공시 수집 및 LLM 요약 서버

- 역할: 뉴스·공시 수집, 정제·중복 제거, 기사-종목 연결, LLM 요약, 매칭 정확도 측정
- 기술: Python, FastAPI, LangChain

## 팀원이 먼저 볼 것

| 문서 | 내용 |
|---|---|
| [docs/팀공유.md](docs/팀공유.md) | AI 쪽에서 정한 것, 화면용 기사 데이터 예시 |
| [docs/AI테이블_제안.md](docs/AI테이블_제안.md) | **백엔드에 드리는** AI 테이블(`article`, `article_stock`, `collect_run`) 컬럼 제안 |
| [docs/결정사항.md](docs/결정사항.md) | 지금 기준 AI 설계 한눈에 보기 |

## 지금 상태 (2026-11-02)

- 끝: RSS 목록 받기(15) → 주소 중복 제거(16) → DB 저장 `LISTED`(18). 다음: 원문 본문 가져오기(20) ([docs/개발순서.md](docs/개발순서.md))
- 뉴스: **언론사 RSS 8개** (한경·연합·서경·파이낸셜뉴스, 30분마다 확인, 하루 약 1,000건)
- 흐름: RSS 목록 → 중복 제거 → 원문 본문 → LLM 요약 → 요약에서 코스피200 종목 연결
- 단계끼리는 `article.status` 로 넘김: `LISTED` → `FETCHED` → `SUMMARIZED` → `DONE` / `NO_STOCK`
- 백엔드와는 **DB 로만** 주고받음 (AI 가 쓰고 백엔드가 읽음). 테이블은 백엔드 Flyway V5
- 화면에는 **요약 + 원문 링크만** (본문은 7일 후 삭제, 언론사 AI 정책)
- 보류: 네이버 API(과거 기록용), SNS

## 폴더

```
ai/
├── README.md
├── requirements.txt
├── hk_llm/
│   ├── config.py           설정 한곳: 폴더 위치, 시간대(KST), .env 값
│   ├── collector/          밖에서 가져오기
│   │   ├── rss_collector.py    언론사 RSS 8개 기사 목록 (15)
│   │   └── robots_checker.py   본문 가져오기 전 robots.txt 허용 확인
│   ├── service/            단계 처리
│   │   ├── dedup_service.py    주소 기준 중복 제거 (16)
│   │   └── collect_service.py  RSS 수집 1번 실행: 받기 → 중복 제거 → DB 저장 (18)
│   ├── dao/                DB 읽기·쓰기 (테이블마다 1개, db.py 는 연결)
│   ├── dto/                테이블 한 줄의 모양 (dataclass)
│   ├── common/             logger.py 로그, retry.py 실패 시 재시도
│   ├── tools/              한 번씩 돌리는 도구: naver_test.py 키 확인, stock_master.py 종목 목록
│   ├── data/               (Git 제외) stocks.csv, kospi200.csv, sample_rss.json
│   └── logs/               (Git 제외) hk_llm.log
└── docs/                   문서 안내는 docs/README.md
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
| RSS 수집 1번 (DB 저장까지) | `python -m hk_llm.service.collect_service` |
| RSS 만 받아 보기 | `python -m hk_llm.collector.rss_collector` |
| 네이버 API 키 확인 | `python -m hk_llm.tools.naver_test 삼성전자` |
| 종목 목록 `data/stocks.csv` 만들기 | `python -m hk_llm.tools.stock_master` (먼저 KRX 코스피200 CSV 를 `hk_llm/data/kospi200.csv` 로, [docs/진행기록/1_준비.md](docs/진행기록/1_준비.md) 1-6) |

- 각 파일 맨 아래 `if __name__ == "__main__":` 은 자체 시험. 실행해서 `ok` 가 나오면 통과
- `data/`·`logs/` 는 Git 에 올리지 않는다 (팀 규칙)

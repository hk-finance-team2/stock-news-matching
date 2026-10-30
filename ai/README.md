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

## 지금 상태 (2026-10-30)

- 준비 단계 진행 중 → 다음: 로깅 모듈, RSS 수집 구현 ([docs/개발순서.md](docs/개발순서.md))
- 뉴스: **언론사 RSS 8개로 실시간** 수집 (한경·연합·서경·파이낸셜뉴스, 30분마다, 하루 약 1,000건)
- 흐름: RSS 목록 → 중복 제거 → 원문 본문 → LLM 요약 → 요약에서 코스피200 종목 연결
- 화면에는 **요약 + 원문 링크만** (본문은 7일 후 삭제, 언론사 AI 정책)
- DB: 팀 공용 Docker MariaDB (`docker compose up -d db`, `localhost:3308`, `stocknews`)
- 보류: 네이버 API(과거 기록용), SNS, 매칭 점수 방식

## 폴더

```
ai/
├── README.md
├── requirements.txt
├── hk_llm/
│   ├── naver_test.py     네이버 API HUB 키 확인
│   ├── robots.py         본문 가져오기 전 robots.txt 허용 확인
│   ├── stock_master.py   종목 마스터 data/stocks.csv 생성 (코스피200 표시)
│   └── data/             (Git 제외) stocks.csv, kospi200.csv
└── docs/
    ├── README.md         문서 안내
    ├── 결정사항.md        지금 유효한 결정
    ├── 개발순서.md        단계별 진행 상태
    ├── 팀공유.md          AI 쪽에서 정한 것
    ├── AI테이블_제안.md   백엔드에 드리는 테이블 제안
    ├── 할일.md            AI 담당 할 일
    ├── 진행기록/          단계별 기록 (날짜순)
    └── 조사/              직접 확인한 자료 (뉴스 소스, robots.txt, 비용)
```

## 실행

```bash
cd ai
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
```

- 키는 레포 최상위 `.env` 에 넣는다 (`.env.example` 참고: `OPENAI_API_KEY`, `NAVER_CLIENT_ID`, `NAVER_CLIENT_SECRET`)
- 종목 마스터: KRX 에서 코스피200 CSV 를 받아 `hk_llm/data/kospi200.csv` 로 저장한 뒤 (방법: [docs/진행기록/1_준비.md](docs/진행기록/1_준비.md) 1-6)
  ```bash
  cd hk_llm
  python stock_master.py
  ```
- `data/` 폴더는 기사·KRX 데이터라 Git 에 올리지 않는다 (팀 규칙)

# AGENTS.md — 팀 공통 규칙

사람과 AI 에이전트(Claude Code, Codex, Antigravity, Cursor 등) 모두 이 문서를 따릅니다.
AI 에이전트는 작업 전에 이 문서를 읽어 주세요.

규칙은 두 종류입니다.
- **꼭 지킬 것**: 팀 전체가 깨지거나 사고가 나는 것만 모았습니다. 애매하면 멈추고 사람에게 묻습니다.
- **권장**: 기본 방향입니다. 상황에 맞게 유연하게 판단해도 됩니다.

## 1. 프로젝트

- 한경닷컴 IT교육센터 금융 팀프로젝트 (4명, 1차 마무리 목표 2026-11-20)
- 주제: 뉴스·공시를 종목과 연결하고, 주가 거래 변동 시점과 매칭해 LLM으로 요약하는 웹 서비스
- 데이터: 한국투자증권(KIS) Open API 시세, 뉴스·공시
- 핵심 기능을 먼저 완성하고, 확장 기능은 팀이 정한 뒤에 붙입니다.

## 2. 레포 구조

| 폴더 | 내용 | 기술 |
|---|---|---|
| `backend/` | Spring Boot 서버 (시세 수집, 거래 변동 감지, 시간 윈도 매칭, 회원·관심종목, 화면용 API·SSE) | Java 21, Spring Boot 4.1, Gradle, MyBatis, MariaDB 11.8 |
| `ai/` | 뉴스·공시 수집, 기사-종목 연결, LLM 요약 | Python, FastAPI, LangChain |
| `frontend/` | 사용자 대시보드 | React, Chart.js |
| `docs/` | 팀 공용 문서 (API 명세, DB 스키마, 결정 기록) | Markdown |

- backend 기본 패키지: `com.hkteam2.stocknews` (하위 `common`, `stock`, `match`, `news`, `user`)
- 백엔드 2명은 패키지 단위로 담당을 나눕니다.

## 3. 꼭 지킬 것

1. **`main`에 직접 커밋하지 않습니다.** 브랜치에서 작업하고 PR로 합칩니다.
2. **비밀 정보를 올리지 않습니다.** `.env`, API 키, 비밀번호는 커밋하지 않고 코드에 직접 쓰지 않습니다.
   새 환경변수가 생기면 `.env.example`에 이름만 추가합니다.
3. **데이터를 올리지 않습니다.** KIS 시세(재배포 금지)와 수집한 기사 본문(저작권)은
   `data/` 또는 `recordings/` 폴더에 저장합니다. 이 폴더는 자동으로 커밋에서 빠집니다.
4. **남의 영역과 공용 파일은 알리고 고칩니다.** 다른 사람 담당 폴더·패키지나 아래 공용 파일을 바꿀 때는
   팀(Slack)에 먼저 알립니다.
   - `backend/build.gradle`, `application*.yml`, `backend`의 `common` 패키지, `docs/`, 이 문서
5. **AI 에이전트는 사람의 확인 없이 push하거나 PR을 merge하지 않습니다.**

## 4. 파트 간 공통 약속

서로 주고받는 데이터가 어긋나지 않게 하는 약속입니다. 바꾸고 싶으면 팀에서 정하고 이 문서를 고칩니다.

- 인코딩 UTF-8, DB는 utf8mb4, 시간대 Asia/Seoul
- API 날짜·시간: ISO-8601, 시간대 포함 (예: `2026-10-29T10:23:00+09:00`)
- API JSON 필드: camelCase (예: `stockCode`, `publishedAt`)
- DB 테이블·컬럼: snake_case (예: `stock_info`, `published_at`)
- 종목코드: 6자리 문자열 (예: `"005930"`, 앞자리 0 보존)
- API·DB·파트 간 데이터 형식은 `docs/`의 문서를 기준으로 합니다.
  문서와 다르게 해야 하면 문서를 먼저(또는 같은 PR에서 함께) 고칩니다.

## 5. Git (권장)

- 브랜치 이름: `feature/파트-기능`, `fix/파트-내용`
  - 예: `feature/be-kis-collect`, `feature/ai-news-summary`, `fix/fe-chart-time`
- 커밋 메시지: `타입: 내용` (한국어)
  - `feat` 기능, `fix` 버그, `docs` 문서, `refactor` 구조 개선, `test` 테스트, `chore` 설정·기타

## 6. AI 에이전트 작업 방식 (권장)

- `.editorconfig` 설정을 따릅니다.
- 요청받은 작업과 관련 없는 파일을 대량으로 고치거나 줄바꿈·들여쓰기만 바꾸지 않습니다.
- KIS 응답 형식, 라이브러리 버전처럼 확실하지 않은 것은 추측하지 말고 확인하거나 사용자에게 묻습니다.
- 빌드 설정(`build.gradle` 등)처럼 팀 전체에 영향이 있는 변경은 사용자에게 먼저 확인합니다.
- 사용자가 Git 사용법(브랜치, 커밋, push, PR, 충돌 등)을 물으면 `docs/git-guide.md`를 기준으로 안내합니다.

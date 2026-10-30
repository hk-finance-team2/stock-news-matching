# stock-news-matching

뉴스·SNS 글이 **어떤 종목에, 왜** 영향을 주는지 AI로 분석해 요약과 함께 보여주는 웹 서비스

한경닷컴 IT교육센터 금융 팀프로젝트 (2026)

## 구조

| 폴더 | 내용 |
|---|---|
| `backend/` | Spring Boot 서버 (종목 사전, 회원·관심 종목·게시판, 화면용 API) |
| `ai/` | 뉴스·SNS 수집, 종목 매칭, LLM 요약 |
| `frontend/` | 사용자 대시보드 |
| `docs/` | 설치·실행 방법, API 목록, DB 설계, 결정 기록 |

## 시작하기

1. 처음이라면 **[Git 사용 가이드](docs/git-guide.md)**를 순서대로 따라 하세요. 레포 내려받기부터 PR 올리기까지 들어 있습니다.
2. 내 PC에서 DB와 백엔드를 켜려면 **[개발 환경 설정](docs/setup.md)**을 보세요. Docker만 있으면 명령 한 줄로 켜집니다.
3. 문서 전체 안내는 **[docs/README.md](docs/README.md)**에 있습니다.

팀 규칙은 [AGENTS.md](AGENTS.md)에 있습니다.

## AI 에이전트

팀 규칙은 [AGENTS.md](AGENTS.md) 한 곳에 있습니다.

| 도구 | 읽는 파일 |
|---|---|
| Codex, Antigravity(1.20.5 이상), Cursor, GitHub Copilot 등 | `AGENTS.md` (자동) |
| Claude Code | `CLAUDE.md` → `AGENTS.md`를 불러옴 |

규칙을 바꿀 때는 `AGENTS.md`만 고치면 됩니다.

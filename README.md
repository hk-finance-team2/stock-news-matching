# stock-news-matching

뉴스·공시를 종목과 연결하고, 주가 거래 변동 시점과 매칭해 LLM으로 요약하는 웹 서비스

한경닷컴 IT교육센터 금융 팀프로젝트 (2026)

## 구조

| 폴더 | 내용 |
|---|---|
| `backend/` | Spring Boot 서버 |
| `ai/` | 뉴스·공시 수집, LLM 요약 서버 |
| `frontend/` | 사용자 대시보드 |
| `docs/` | API 명세, DB 스키마, 결정 기록 |

## 시작하기

처음이라면 **[Git 사용 가이드](docs/git-guide.md)**를 순서대로 따라 하세요.
레포 내려받기부터 매일 작업하는 흐름, PR 올리기까지 들어 있습니다.

팀 규칙은 [AGENTS.md](AGENTS.md)에 있습니다.

## AI 에이전트

팀 규칙은 [AGENTS.md](AGENTS.md) 한 곳에 있습니다.

| 도구 | 읽는 파일 |
|---|---|
| Codex, Antigravity(1.20.5 이상), Cursor, GitHub Copilot 등 | `AGENTS.md` (자동) |
| Claude Code | `CLAUDE.md` → `AGENTS.md`를 불러옴 |

규칙을 바꿀 때는 `AGENTS.md`만 고치면 됩니다.

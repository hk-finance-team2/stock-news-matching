# 백엔드 API 한눈에 보기

프론트가 화면을 붙일 때 보는 문서입니다. 요청·응답의 자세한 모양은 서버를 켠 뒤 **Swagger**에서 확인하고 직접 눌러 볼 수 있습니다.

- 서버 주소: `http://localhost:8080`
- Swagger: http://localhost:8080/swagger-ui.html
- 서버 켜는 법: [setup.md](setup.md) 4절

## 1. 공통 규칙

| 항목 | 규칙 | 예 |
|---|---|---|
| JSON 필드 이름 | camelCase | `stockCode`, `createdAt` |
| 시각 | 한국 시간, 시간대 포함 | `"2026-10-30T14:39:39+09:00"` |
| 종목코드 | 6자리 **문자열** (앞자리 0 유지) | `"005930"` |
| 목록 응답 | `{ "items": [...], "totalCount": 전체 개수 }` | |
| 페이지 요청 | `page`는 **1부터**, `size`는 1~100 (기본 20) | `?page=2&size=20` |
| 실패 응답 | `{ "code": "...", "message": "..." }` + HTTP 상태 | `{ "code": "STOCK_NOT_FOUND", "message": "종목을 찾을 수 없습니다." }` |

`message`는 사용자에게 그대로 보여 줘도 되는 한국어 문장입니다. 화면 분기는 `code`로 하세요.

## 2. 로그인 방식 (JWT)

1. `POST /api/auth/login` → 응답의 `accessToken`을 저장
2. 로그인이 필요한 API를 부를 때 헤더에 붙이기
   ```
   Authorization: Bearer {accessToken}
   ```
3. 토큰 유효 시간은 60분(`expiresIn: 3600`). 만료되면 다시 로그인
4. **401을 받으면 저장한 토큰을 지우고 로그인 화면으로.** 만료된 토큰을 붙이면 로그인이 필요 없는 API도 401이 됩니다.
5. 로그아웃은 프론트에서 토큰을 지우면 됩니다. (토큰 저장 위치는 프론트와 정할 예정)

Swagger에서는 오른쪽 위 **Authorize**에 토큰을 넣으면 로그인이 필요한 API도 시험할 수 있습니다.

## 3. API 목록

🔓 로그인 없이 · 🔒 로그인 필요

### 회원

| | 방식 | 주소 | 설명 |
|---|---|---|---|
| 🔓 | POST | `/api/auth/signup` | 회원가입 `{ loginId, password }` · 아이디 영문 소문자·숫자 4~20자, 비밀번호 8~64자 |
| 🔓 | POST | `/api/auth/login` | 로그인 → `{ accessToken, tokenType, expiresIn }` |
| 🔒 | GET | `/api/auth/me` | 내 정보 `{ userId, loginId, role }` |

### 종목

| | 방식 | 주소 | 설명 |
|---|---|---|---|
| 🔓 | GET | `/api/stocks` | 종목 목록 (지금은 예시 종목 5개) |
| 🔓 | GET | `/api/stocks/{stockCode}` | 종목 하나 `{ stockCode, stockName, market, sector }` |

### 관심 종목

| | 방식 | 주소 | 설명 |
|---|---|---|---|
| 🔒 | GET | `/api/watchlist` | 내 관심 종목 (최근 추가 순) |
| 🔒 | POST | `/api/watchlist` | 추가 `{ stockCode }` |
| 🔒 | DELETE | `/api/watchlist/{stockCode}` | 삭제 |

### 종목 토론 게시판

| | 방식 | 주소 | 설명 |
|---|---|---|---|
| 🔓 | GET | `/api/stocks/{stockCode}/posts?page=1&size=20` | 글 목록 (최신순, 본문 없음, 댓글 수·공감 수 포함) |
| 🔓 | GET | `/api/posts/{postId}` | 글 상세 (본문 포함) |
| 🔒 | POST | `/api/stocks/{stockCode}/posts` | 글쓰기 `{ title, content }` · 제목 200자, 본문 5000자 |
| 🔒 | DELETE | `/api/posts/{postId}` | 글 삭제 (본인만, 댓글·공감도 함께 삭제) |
| 🔓 | GET | `/api/posts/{postId}/comments` | 댓글 목록 (오래된 순) |
| 🔒 | POST | `/api/posts/{postId}/comments` | 댓글 쓰기 `{ content }` · 1000자 |
| 🔒 | DELETE | `/api/comments/{commentId}` | 댓글 삭제 (본인만) |
| 🔒 | POST | `/api/posts/{postId}/like` | 공감 토글 → `{ liked, likeCount }` (누르면 공감, 다시 누르면 취소) |

### 아직 없는 API (AI 기사 테이블이 생긴 뒤 추가)

뉴스·SNS 글 목록·상세, 종목별 조회(이슈 순위·종합 요약·감성 비율·언급량), 통합 검색, 데이터 상태, 관심 종목의 오늘 매칭 글 수.
그동안은 프론트에서 예시 데이터로 화면을 만들어 두면 됩니다.

## 4. 오류 코드

| HTTP | code | 언제 |
|---|---|---|
| 400 | `INVALID_REQUEST` | 입력 규칙 위반, 깨진 JSON (`message`에 어긴 규칙) |
| 400 | `INVALID_PAGE` | page·size 범위 밖 |
| 401 | `UNAUTHORIZED` | 로그인 필요한 API에 토큰 없음·만료·위조 |
| 401 | `INVALID_CREDENTIALS` | 로그인 실패 (아이디 또는 비밀번호 틀림) |
| 403 | `FORBIDDEN` | 권한 없음 |
| 403 | `NOT_POST_OWNER` / `NOT_COMMENT_OWNER` | 남의 글·댓글 삭제 |
| 404 | `NOT_FOUND` | 없는 주소 |
| 404 | `STOCK_NOT_FOUND` / `POST_NOT_FOUND` / `COMMENT_NOT_FOUND` / `WATCHLIST_NOT_FOUND` | 없는 종목·글·댓글·관심 종목 |
| 409 | `DUPLICATE_LOGIN_ID` | 이미 있는 아이디로 가입 |
| 409 | `ALREADY_IN_WATCHLIST` | 이미 관심 종목에 있음 |
| 500 | `INTERNAL_ERROR` | 서버 오류 (백엔드에 알려 주세요) |

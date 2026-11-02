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
| 🔓 | GET | `/api/stocks?q=삼성&page=1&size=20` | **종목 검색**. 종목명(포함)·종목코드(시작)·별칭(포함)으로 찾음. 이름이 딱 맞는 것 → 이름이 q로 시작 → 코드 순. `q`가 없으면 전체 2,655개를 이름순으로 페이지 |
| 🔓 | GET | `/api/stocks/issues?source=&limit=10` | **오늘의 이슈 종목 순위**. 아래 참고 |
| 🔓 | GET | `/api/stocks/{stockCode}` | 종목 하나 `{ stockCode, stockName, market, sector }` |
| 🔓 | GET | `/api/stocks/{stockCode}/summary?source=` | **오늘의 종합 요약·감성 비율**. 아래 참고 |
| 🔓 | GET | `/api/stocks/{stockCode}/mentions?period=today` | **언급량 추이 (그래프)**. 아래 참고 |

**오늘의 이슈 종목** (홈 오른쪽, 종목별 조회 왼쪽 목록)
- 오늘(한국 시간 **0시 ~ 지금**) 작성된 글에 **많이 나온 종목** 순. 글 수가 같으면 평균 관련도가 높은 순
- `source`: `NEWS` / `SNS` (없으면 둘 다), `limit`: 1~50 (기본 10). 페이지 없음
- 한 건: `{ rank, stockCode, stockName, articleCount, avgRelevance, lastPublishedAt }`
  - `articleCount`: 오늘 이 종목이 나온 글 수, `avgRelevance`: 평균 관련도 %(없으면 `null`), `lastPublishedAt`: 가장 최근 글 시각
- 오늘 글이 없으면 `items: []`. 0시가 막 지나면 비어 있을 수 있음

**오늘의 종합 요약** (종목별 조회 화면 가운데)

```json
{
  "stockCode": "005930", "stockName": "삼성전자", "date": "2026-11-02",
  "newsSummary": "고대역폭 메모리 공급 계약으로 …", "snsSummary": "반도체 업황 회복을 기대하는 …",
  "generatedAt": "2026-11-02T11:10:28+09:00",
  "sentiment": { "articleCount": 2, "positiveCount": 1, "negativeCount": 0, "neutralCount": 1,
                 "positive": 50, "negative": 0, "neutral": 50 }
}
```

- `newsSummary`·`snsSummary`: AI가 1시간마다 만드는 오늘 요약. **아직 없으면 `null`** → "요약 준비 중" 표시. SNS 글이 없는 종목은 `snsSummary`만 `null`일 수 있음
- `sentiment`: 오늘(한국 시간 0시~지금) 이 종목이 나온 글을 **지금** 센 것 (이 종목에 대한 감성 기준). `positive`·`negative`·`neutral`은 % 정수이고 **합이 항상 100**. 오늘 글이 없으면 모두 0
  - 기본은 **뉴스·SNS 합계** (요구사항 F-08). `source=NEWS` / `source=SNS`를 붙이면 그 출처 글만 셈 (요약 문장은 그대로)
- 없는 종목은 404 `STOCK_NOT_FOUND`

**언급량 추이** (종목별 조회 화면 그래프)

```json
{
  "stockCode": "005930", "period": "today", "unit": "HOUR",
  "items": [
    { "time": "2026-11-02T00:00:00+09:00", "newsCount": 0, "snsCount": 0, "totalCount": 0 },
    { "time": "2026-11-02T09:00:00+09:00", "newsCount": 1, "snsCount": 1, "totalCount": 2 }
  ]
}
```

- `period`: `today`(기본, 오늘 0시부터 **1시간** 칸, 지금 시각 칸까지) / `7d`·`30d`(오늘 포함 7일·30일, **1일** 칸). 그 밖은 400
- `items`: 기간의 **모든 칸이 시각 순으로 빠짐없이**. 글이 없는 칸도 0으로 들어 있어서 그대로 그리면 됨
- `time`은 칸 시작 시각 (`09:00` = 9시대), `unit`(`HOUR`/`DAY`)으로 아래 글자를 "09시"로 쓸지 "11/02"로 쓸지 정함
- 글의 **작성 시각** 기준, 칸마다 뉴스·SNS를 따로 셈. 없는 종목은 404

### 뉴스·SNS 글

| | 방식 | 주소 | 설명 |
|---|---|---|---|
| 🔓 | GET | `/api/articles` | **글 목록**. AI 분석이 끝난 글만, 기본은 최신순. 아래 조건을 골라 붙임 |
| 🔓 | GET | `/api/articles/{articleId}` | **글 상세**. 아래 "글 상세" 참고. 없거나 분석이 덜 끝난 글은 404 `ARTICLE_NOT_FOUND` |

| 조건 | 값 | 쓰는 곳 |
|---|---|---|
| `stockCode` | 종목코드 6자리. 이 종목과 연결된 글만 (없는 종목이면 404) | 종목별 조회 화면 |
| `source` | `NEWS` / `SNS` (없으면 전체) | 출처 탭 |
| `sort` | `latest` 최신순(기본) / `relevance` 관련도순 | 정렬 버튼 |
| `minRelevance` | 0~100 (%). 관련도가 이 값 이상인 종목이 있는 글만. `stockCode`와 같이 쓰면 그 종목 기준 | 관련도 필터 |
| `q` | 검색어 (50자 이하). 제목·요약·키워드에 들어 있는 글만 | 검색 |
| `period` | `today` / `7d` / `30d` (없으면 전체). 7d = 오늘 포함 7일 (언급량 그래프와 같은 뜻) | 기간 버튼 |
| `page`, `size` | 1부터, 1~100 (기본 20) | |

예: 홈 `GET /api/articles` · 삼성전자 화면 `GET /api/articles?stockCode=005930` · SNS만 관련도순 `GET /api/articles?source=SNS&sort=relevance`

응답 한 건:

```json
{
  "articleId": 2, "sourceType": "NEWS", "channel": "RSS",
  "title": "...", "press": "예시일보", "publishedAt": "2026-11-02T09:04:19+09:00",
  "summary": "3줄 요약", "url": "원문 링크",
  "stocks": [
    { "stockCode": "010950", "stockName": "S-Oil", "matchType": "INDIRECT",
      "relevance": 85, "sentiment": "POSITIVE", "isMain": true }
  ]
}
```

- `stocks`는 관련도 높은 순. `relevance`는 **%(정수)**, `matchType`은 `DIRECT`(직접)·`INDIRECT`(간접)
- `matchType`·`relevance`는 AI가 아직 안 채웠으면 `null` → 화면에서 칩 모양·% 표시를 생략
- `sourceType`이 `SNS`면 "참고용 · 확인되지 않은 정보" 표시 (요구사항 N-05)
- 기사 본문은 내보내지 않습니다. 요약과 원문 링크(`url`)만
- 개발 중에 글이 없으면 [setup.md](setup.md) 2절의 **예시 기사**를 켜세요

#### 글 상세 `GET /api/articles/{articleId}`

목록 한 건의 칸에 아래가 더 붙습니다.

| 칸 | 내용 |
|---|---|
| `reporter` | 기자명 (없으면 `null`) |
| `keywords` | 핵심 키워드 목록 `["HBM", "반도체"]` (없으면 `[]`) |
| `sentiment` | 글 전체 감성 `POSITIVE` / `NEGATIVE` / `NEUTRAL` (없으면 `null`) |
| `model`, `summarizedAt` | 요약을 만든 AI 모델과 시각 → "AI가 만든 요약" 안내용 (N-05) |
| `stocks[]` | 목록 칩 칸 + **`reason`**(연결 이유, 항상 있음), **`evidence`**(근거 문장, 없으면 `null`), `matchedKeywords`(목록, 없으면 `[]`) |
| `relatedSns[]` | **뉴스일 때만.** 같은 종목이 나온 SNS 중 작성 시각 앞뒤 24시간 안, 가까운 순 최대 5개 `{ articleId, channel, title, press, publishedAt, summary, url }`. SNS 글이면 `[]` |

### 통합 검색

| | 방식 | 주소 | 설명 |
|---|---|---|---|
| 🔓 | GET | `/api/search?q=삼성&period=7d` | **종목 + 글 한 번에** (F-13) |

```json
{
  "q": "삼성",
  "stocks":   { "items": [ { "stockCode": "005930", "stockName": "삼성전자", ... } ], "totalCount": 21 },
  "articles": { "items": [ { "articleId": 23, "title": "...", "stocks": [...] } ],     "totalCount": 1 }
}
```

- `stocks`: 위에서 **5개만**. 규칙은 `GET /api/stocks?q=`와 같음. `totalCount`가 5보다 크면 "종목 더 보기" → `GET /api/stocks?q=삼성&page=1`
- `articles`: 한 페이지. 규칙·칸은 `GET /api/articles?q=`와 같음. 조건 `period`, `source`, `sort`, `page`, `size`
- `q`는 **필수** (없거나 공백뿐이거나 50자 넘으면 400)
- 글은 **제목·요약·키워드에 검색어가 글자로 들어 있어야** 나옴. 종목과 연결됐어도 글자가 없으면 안 나옴 (그런 글은 종목 화면에서)

### 관심 종목

| | 방식 | 주소 | 설명 |
|---|---|---|---|
| 🔒 | GET | `/api/watchlist` | 내 관심 종목 (최근 추가 순) `{ stockCode, stockName, market, addedAt, todayArticleCount, lastMatchedAt }` |
| 🔒 | GET | `/api/watchlist/articles` | **관심 종목 글 모아 보기**. 내 관심 종목 중 하나라도 연결된 글 |
| 🔒 | POST | `/api/watchlist` | 추가 `{ stockCode }` |
| 🔒 | DELETE | `/api/watchlist/{stockCode}` | 삭제 |

- `todayArticleCount`: 오늘(한국 시간 0시~) 이 종목이 나온 글 수, `lastMatchedAt`: 이 종목이 나온 가장 최근 글 시각 (오늘이 아니어도, 한 번도 없으면 `null`)
- `/api/watchlist/articles`: 조건(`source`, `sort`, `minRelevance`, `page`, `size`)과 응답 모양은 `GET /api/articles`와 같음 (`stockCode`만 없음). 관심 종목 두 개에 걸친 글도 **한 번만** 나옴. 관심 종목이 없으면 `items: []`

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

### 데이터 상태

| | 방식 | 주소 | 설명 |
|---|---|---|---|
| 🔓 | GET | `/api/status` | **마지막 갱신 시각** (F-16). "뉴스 3분 전 · SNS 10분 전 · 요약 40분 전" 표시용 |

```json
{
  "newsCollectedAt": "2026-11-02T14:00:12+09:00",
  "snsCollectedAt": "2026-11-02T13:55:40+09:00",
  "summaryGeneratedAt": "2026-11-02T13:30:00+09:00",
  "lastSuccessAt": "2026-11-02T14:00:30+09:00",
  "lastRun": { "status": "SUCCESS", "startedAt": "...", "finishedAt": "...", "collectedCount": 12, "summarizedCount": 10 }
}
```

- `newsCollectedAt`·`snsCollectedAt`: 마지막으로 받은 뉴스·SNS 글의 **수집 시각** (분석 중인 글 포함)
- `summaryGeneratedAt`: 마지막 종목 종합 요약 생성 시각, `lastSuccessAt`: AI 수집이 마지막으로 **성공**한 시각
- `lastRun`: 가장 최근 수집 실행. `status`가 `RUNNING`이면 수집 중(`finishedAt`은 `null`), `FAILED`면 마지막 수집 실패
- 아직 데이터가 없으면 각각 `null` → 화면은 "아직 없음"

### 아직 없는 API

종합 요약 다시 생성 (AI 서버 API 형식이 정해지면 추가).

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
| 404 | `STOCK_NOT_FOUND` / `ARTICLE_NOT_FOUND` / `POST_NOT_FOUND` / `COMMENT_NOT_FOUND` / `WATCHLIST_NOT_FOUND` | 없는 종목·글·댓글·관심 종목 |
| 409 | `DUPLICATE_LOGIN_ID` | 이미 있는 아이디로 가입 |
| 409 | `ALREADY_IN_WATCHLIST` | 이미 관심 종목에 있음 |
| 500 | `INTERNAL_ERROR` | 서버 오류 (백엔드에 알려 주세요) |

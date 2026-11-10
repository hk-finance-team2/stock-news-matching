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
| 🔓 | GET | `/api/stocks?q=삼성&page=1&size=20` | **종목 검색**. 종목명(포함)·종목코드(시작)·별칭(포함)·**테마(q와 딱 같을 때)**로 찾음. 이름이 딱 맞는 것 → 별칭이 딱 맞는 것(`현대차` → 현대자동차) → 이름이 q로 시작 → 코드 → 나머지(가운데 글자·**테마**) 순. 같은 순위 안에서는 **최근 7일 분석이 끝난 글에 많이 나온 종목 먼저**(`삼성` → 삼성전자가 삼성공조보다 앞), 그다음 이름이 짧은 순. `q`가 없으면 전체 2,655개를 이름순으로 페이지. 항목 `{ stockCode, stockName, market, sector, matchedTheme }` — 아래 참고 |
| 🔓 | GET | `/api/stocks/issues?source=&limit=10` | **오늘의 이슈 종목 순위**. 아래 참고 |
| 🔓 | GET | `/api/stocks/{stockCode}` | 종목 하나 `{ stockCode, stockName, market, sector }` |
| 🔓 | GET | `/api/stocks/{stockCode}/summary?source=` | **오늘의 종합 요약·감성 비율**. 아래 참고 |
| 🔒 | POST | `/api/stocks/{stockCode}/summary` | **종합 요약 다시 생성** (F-08). AI 서버가 오늘 기사로 새로 만들고 다시 읽은 요약을 돌려줌. 아래 참고 |
| 🔓 | GET | `/api/stocks/{stockCode}/mentions?period=today` | **언급량 추이 (그래프)**. 아래 참고 |

**종목 검색의 테마** (2026-11-04 추가)
- `반도체`처럼 q가 테마 이름과 **딱 같으면** 그 테마 종목도 나옴. 이름 가운데에 든 종목(한미반도체 등)과 **같은 순위**라 최근 언급 순 → 뉴스에 많이 나온 삼성전자·SK하이닉스가 앞. `반도` 처럼 일부만 같으면 테마로는 안 찾음
- `matchedTheme`: 이름·코드·별칭으로는 안 맞고 **테마로만** 찾은 종목이면 그 테마(`"반도체"`), 아니면 `null` → 화면에 "테마: 반도체"처럼 이유를 보여 줄 때
- 종목 상세(`/api/stocks/{stockCode}`)에는 이 칸이 없음 (검색 결과에만)

**오늘의 이슈 종목** (홈 오른쪽, 종목별 조회 왼쪽 목록)
- 오늘(한국 시간 **0시 ~ 지금**) 작성된 글에 **많이 나온 종목** 순. 글 수가 같으면 평균 관련도가 높은 순
- `source`: `NEWS` / `SNS` (**없으면 `NEWS`**), `limit`: 1~50 (기본 10). 페이지 없음
  - 기본이 뉴스만인 이유: AI가 SNS를 "최근 뉴스가 많은 종목"만 골라 모으므로, 섞어서 세면 같은 종목을 두 번 세게 됨. SNS 순위는 `source=SNS`로 따로
- 한 건: `{ rank, stockCode, stockName, articleCount, eventCount, avgRelevance, lastPublishedAt }`
  - `articleCount`: 오늘 이 종목이 나온 글 수(보도량, **순위 기준**), `avgRelevance`: 평균 관련도 %(없으면 `null`), `lastPublishedAt`: 가장 최근 글 시각
  - `eventCount` (2026-11-09): **같은 소식 묶음을 1건으로 센 소식 수**. 예: 같은 실적 기사를 3곳이 쓰고 다른 소식이 1건이면 `articleCount` 4, `eventCount` 2. 화면은 "글 4건 · 소식 2건"처럼 정보로 보여 주면 됨. 묶음은 AI가 5분마다 저장(같은 종목 + 24시간 안 + 제목이 비슷함, V13). 묶음이 아직 없으면 `articleCount`와 같음
- 오늘 글이 없으면 `items: []`. 0시가 막 지나면 비어 있을 수 있음

**오늘의 종합 요약** (종목별 조회 화면 가운데)

```json
{
  "stockCode": "005930", "stockName": "삼성전자", "date": "2026-11-02",
  "newsSummary": "고대역폭 메모리 공급 계약으로 …", "snsSummary": "반도체 업황 회복을 기대하는 …",
  "generatedAt": "2026-11-02T11:10:28+09:00",
  "sentiment": { "articleCount": 2, "positiveCount": 1, "negativeCount": 0, "neutralCount": 1,
                 "positive": 50, "negative": 0, "neutral": 50 },
  "sentimentByEvent": { "articleCount": 2, "positiveCount": 1, "negativeCount": 0, "neutralCount": 1,
                        "positive": 50, "negative": 0, "neutral": 50 }
}
```

- `newsSummary`·`snsSummary`: AI가 1시간마다 만드는 오늘 요약. **아직 없으면 `null`** → "요약 준비 중" 표시. SNS 글이 없는 종목은 `snsSummary`만 `null`일 수 있음
- `generatedAt`: **뉴스 요약**을 만든 시각. 뉴스 요약이 없으면(SNS 반응 요약만 있어도) `null`. 데이터 상태(`/api/status`)의 `summaryGeneratedAt`도 뉴스 요약 기준
- `sentiment`: 오늘(한국 시간 0시~지금) 이 종목이 나온 글을 **지금** 센 것 (이 종목에 대한 감성 기준). 감성을 판단하지 않은 연결(`null`, 제목만 연결한 기사)은 세지 않음. `positive`·`negative`·`neutral`은 % 정수이고 **합이 항상 100**. 오늘 글이 없으면 모두 0
  - 기본은 **뉴스·SNS 합계** (요구사항 F-08). `source=NEWS` / `source=SNS`를 붙이면 그 출처 글만 셈 (요약 문장은 그대로)
- `sentimentByEvent` (2026-11-09): 같은 소식 묶음을 **1표**로 센 감성 비율 (모양은 `sentiment`와 같고, 안의 `articleCount`·`…Count`는 **글 수가 아니라 소식 수**). 같은 호재 소식을 7곳이 쓰면 `sentiment`는 호재 7표, `sentimentByEvent`는 1표. 한 묶음 안에서 기사마다 감성이 다르면 각 감성에 1표씩. 출처 조건(`source`)도 똑같이 적용
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
| `sentiment` | `POSITIVE` / `NEGATIVE` / `NEUTRAL` (없으면 전체). `stockCode`가 있으면 그 종목에 대한 감성, 없으면 주인공 종목의 감성 (카드에 보이는 감성과 같은 뜻). 관심 종목 글(`/api/watchlist/articles`)도 같음 | 감성 버튼 |
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
- **정보 표시 칸 (2026-11-10, 판단을 더하지 않고 사실만. 근거: `decisions.md` 2026-11-10)** — 글 목록·글 상세 모두 같음
  - `stocks[].role`: `MAIN`(주인공) / `MENTIONED`(함께 언급). 화면은 관련도 % 대신 이 등급을 보여 주는 쪽을 권장 (주인공 표시 연결은 연습 문제에서 모두 맞았고, 틀린 연결은 전부 `MENTIONED`. 관련도 숫자는 역할을 가리지 못함). `MENTIONED`는 접어 두기 권장
  - `stocks[].factType`: 근거 문장의 사실 종류 `FACT`(일어난 일)·`PLAN`(회사 계획)·`FORECAST`(전망·의견)·`RUMOR`(소문), 없으면 `null` (V14, 11/10 이후 새로 분석한 기사부터 채워짐. 제목만 연결·공시는 `null`)
  - `priceMoveTitle`: 제목이 "특징주·급등·상승"처럼 **주가가 이미 움직인 뒤 쓴 기사**인가 (`true`/`false`). 화면은 "주가 움직임 뒤 기사(이미 반영됐을 수 있음)" 정도로 표시
  - `disclosureType`: 공시(`channel` `DART`)면 유형 이름 (`잠정실적`, `자기주식 취득`, `유상증자`, `공급계약`, `전환사채 등 발행` …), 뉴스나 목록에 없는 공시는 `null`
  - `contextDependent`: 목적·방식에 따라 해석이 갈리는 공시 유형인가 (자기주식 취득·처분, 유상증자, 무상증자, 공급계약 → `true`). 화면은 "목적·방식에 따라 해석이 달라지는 공시입니다" 안내
- `sourceType`이 `SNS`면 "참고용 · 확인되지 않은 정보" 표시 (요구사항 N-05)
  - **SNS 글은 네이버 검색 결과 그대로 보여 주기:** `summary`는 네이버 검색 미리보기(AI 요약 아님). 카드에 관련도·직접/간접·감성을 붙이지 않고, 제목은 `url`(원문)로 바로 연결 (네이버 검색 API 약관 특약 2.1 "검색 결과에 다른 내용을 끼워 넣지 않음"). SNS 감성은 종목 화면의 감성 비율(`source=SNS`)과 `snsSummary`로 따로 보여 줌. 예: 데모 화면
  - SNS 글은 모은 지 **7일이 지나면 지워집니다** (약관 7.3 "별도 DB로 쌓아 두지 않음"). 그래서 30일 언급량 그래프의 SNS는 최근 7일만 있음. 종목 하루 요약의 `snsSummary`는 남음
  - SNS 글의 시각은 **모은 시각**(카페는 작성 시각이 없고 블로그는 날짜만)이라 뉴스와 한 줄로 세우지 않고 출처 탭 기본은 뉴스로
- 기사 본문은 내보내지 않습니다. 요약과 원문 링크(`url`)만
- **AI 활용 금지 언론사(연합뉴스·서울경제·연합인포맥스) 기사는 `summary`·`sentiment`가 `null`** (2026-11-05). 기사 끝에 "AI 학습 및 활용 금지"가 있어 본문을 AI에 넣지 않고 제목만으로 종목을 연결함. 화면은 "AI 요약 없음 · 원문 보기", 감성 배지 없음. `stocks[].sentiment`도 `null`이고 종목 감성 비율에서 빠짐
- 개발 중에 글이 없으면 [setup.md](setup.md) 2절의 **예시 기사**를 켜세요

#### 글 상세 `GET /api/articles/{articleId}`

목록 한 건의 칸에 아래가 더 붙습니다.

| 칸 | 내용 |
|---|---|
| `reporter` | 기자명 (없으면 `null`) |
| `keywords` | 핵심 키워드 목록 `["HBM", "반도체"]` (없으면 `[]`) |
| `sentiment` | 글 전체 감성 `POSITIVE` / `NEGATIVE` / `NEUTRAL` (없으면 `null`) |
| `model`, `summarizedAt` | 요약을 만든 AI 모델과 시각 → "AI가 만든 요약" 안내용 (N-05) |
| `stocks[]` | 목록 칩 칸 + **`reason`**(연결 이유, 항상 있음), **`evidence`**(근거 문장, 없으면 `null`. 팀원 PC 처럼 데이터 파일로 받은 DB 에는 없음), `matchedKeywords`(목록, 없으면 `[]`). `sentiment`는 감성을 판단하지 않은 연결이면 `null` |
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

- `stocks`: 위에서 **5개만**. 규칙·칸(`matchedTheme` 포함)은 `GET /api/stocks?q=`와 같음. `totalCount`가 5보다 크면 "종목 더 보기" → `GET /api/stocks?q=삼성&page=1`
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
- `/api/watchlist/articles`: 조건(`source`, `sort`, `minRelevance`, `sentiment`, `period`, `page`, `size`)과 응답 모양은 `GET /api/articles`와 같음 (`stockCode`만 없음). 관심 종목 두 개에 걸친 글도 **한 번만** 나옴. 관심 종목이 없으면 `items: []`

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

### 시세 (확장 ①②, 1차 시연 범위 밖)

한국투자증권(KIS) 현재가·차트·체결. **서버 `.env`에 `KIS_ENABLED=true`(+ 본인 KIS 키)일 때만** 동작하고, 아니면 `503 QUOTE_DISABLED` → 화면은 "시세 준비 중". 녹화본 API(다시 보기·점검)는 DB만 읽어서 스위치와 상관없이 동작. 로그인 없이.

| | 방식 | 주소 | 설명 |
|---|---|---|---|
| 🔓 | GET | `/api/quotes/{stockCode}` | 현재가. 생중계 종목은 DB 실시간 값(`live: true`), 아니면 KIS 조회(5초 캐시) |
| 🔓 | GET | `/api/quotes?codes=005930,000660` | 여러 종목 현재가 (최대 10개, 없는·실패한 종목은 빠짐) |
| 🔓 | GET | `/api/quotes/{stockCode}/chart?unit=5m&date=2026-10-30` | **봉(캔들) 차트**. `unit` `1m`·`5m`·`10m`·`30m`: `date` 하루(없으면 오늘)의 09:00~15:30 분봉, 최대 1년 전까지. `day`: 최근 1년, `week`·`month`: 최근 100개, `year`: 상장 이후. `to`(일·주·월봉만): 그 날짜(포함)까지 거꾸로 100개 이내 (왼쪽으로 끌 때 이어 받기). 옛 값 `minute`=`1m`. `items`는 오래된 것부터 |
| 🔓 | GET | `/api/quotes/{stockCode}/ticks` | 최근 체결 30건 (최신이 앞) |
| 🔓 | GET (SSE) | `/api/quotes/stream?codes=005930` | **실시간 방송** (최대 5종목). 이벤트 `quote`(현재가, 연결 직후 한 번 + 바뀔 때마다), `tick`(새 체결, 생중계 종목만) |
| 🔓 | GET | `/api/quotes/status` | 수집 상태: 웹소켓 연결, 생중계 자리(`capacity`, `activeCodes`, `waitingCodes`, `viewers`), 받은·저장·버린 체결 수 |
| 🔓 | GET | `/api/quotes/{stockCode}/recordings` | 다시 볼 수 있는 날 (녹화된 날짜·체결 수) |
| 🔓 | GET (SSE) | `/api/quotes/{stockCode}/replay?date=2026-11-03&from=09:00&speed=10` | **다시 보기**. 이벤트 `start` → `replay`(체결마다) → `end`. 배속 1·5·10·30·60 |
| 🔓 | GET | `/api/quotes/check?date=` | 수집 점검: 종목별 저장 체결량 ÷ 실제 거래량(누적 거래량 차이) = `coverageRate`, 지연 ms |
| 🔓 | GET | `/api/quotes/{stockCode}/big-moves?period=1y&threshold=5` | **과거 급등·급락 이력 (F-17)**. 하루 등락률이 ±`threshold`% 이상인 날(최신부터) + 그날 이 종목에 연결된 글. `period` `3m`·`6m`·`1y`(기본), `threshold` 3~30(기본 5) |

현재가 한 건:

```json
{ "stockCode": "005930", "price": 219500, "changeAmount": -9500, "changeRate": -4.15, "direction": "DOWN",
  "open": 220500, "high": 223000, "low": 217000, "accVolume": 7611275,
  "fetchedAt": "2026-11-03T13:04:55+09:00", "live": true }
```

- `direction`: `UP`(상승·상한) / `DOWN`(하락·하한) / `FLAT`. 화면 색은 상승 빨강, 하락 파랑 (국내 증권 앱 관례)
- `live`: `true`면 웹소켓 실시간 값(`fetchedAt` = 마지막 체결 시각), `false`면 몇 초마다 조회한 값
- 방송(SSE)은 브라우저 `EventSource`로 듣기: `new EventSource('/api/quotes/stream?codes=005930')` → `addEventListener('quote', e => JSON.parse(e.data))`. 끊기면 브라우저가 알아서 다시 연결. 화면을 떠나면 `close()`
- 생중계 자리: 보는 사람이 있는 종목에 KIS 구독을 돌려씀 (공식 41건, 신규 키는 처음 3일 동안 3건). 자리가 없으면 그 종목은 5초마다 조회값으로 방송
- 차트 응답: `{ stockCode, unit, date, items: [{ time, open, high, low, close, volume }] }`. `date`는 분봉일 때만(아니면 `null`). 분봉 `time`은 구간 시작 시각(5분봉 09:05 = 09:05~09:09), 일·주·월·년봉은 KIS가 준 날짜. 수정주가
  - 분봉은 서버가 KIS 1분봉(한 번에 120분, 하루 4번)을 받아 n분씩 묶음: 시가 = 첫 봉, 종가 = 마지막 봉, 고가·저가 = 최고·최저, 거래량 = 합. 장 시간(09:00~15:30)만이라 거래량 합은 일봉(시간외 포함)보다 조금 적음
  - 캐시: 오늘 분봉 60초, 지난 날 분봉 1시간, 일·주·월·년봉 10분, `to`로 이어 받은 지난 구간 1시간. 1분봉 원본을 날짜마다 캐시해서 5·10·30분으로 바꿔도 KIS를 다시 부르지 않음. 일봉 첫 화면(1년)은 급등·급락 이력과 같은 캐시
  - 과거로 이어 받기: 화면은 가진 것 중 가장 옛날 날짜의 하루 전을 `to`로 보냄 (예 `?unit=day&to=2025-10-31`). 빈 `items`면 더 없음(상장일 이전). 분봉은 `date`로 하루씩
  - `400 INVALID_REQUEST`: 모르는 `unit`, 일·주·월·년봉에 `date`, 분봉·년봉에 `to`, 미래 날짜, 1년보다 이전 날짜(분봉)
- 급등·급락 이력 한 날:

  ```json
  { "date": "2026-10-29", "close": 61200, "changeAmount": 4300, "changeRate": 7.56, "direction": "UP", "volume": 31200000,
    "articleCount": 4,
    "articles": [ { "articleId": 579, "title": "...", "sourceType": "NEWS", "press": "...",
                    "publishedAt": "2026-10-29T10:00:00+09:00", "relevance": 92 } ] }
  ```

  응답 전체는 `{ stockCode, period, threshold, from, to, items: [위 모양] }`. 등락률은 KIS 일봉(수정주가) 종가로 `(그날 종가 − 전날 종가) ÷ 전날 종가`. 글은 **그날 0시~24시 작성**, `DONE`만, 관련도 높은 순 3개(`relevance`는 %, 없으면 `null`이고 뒤로)와 전체 수 `articleCount`. AI가 기사를 모으기 전 날짜는 글이 없는 게 정상. 일봉은 KIS 3번 조회 + 10분 캐시
- 오류: `503 QUOTE_DISABLED`(시세 꺼짐), `429 QUOTE_BUSY`(KIS 초당 호출 초과), `429 REPLAY_BUSY`(다시 보기 동시 5개 초과), `502 QUOTE_UPSTREAM_ERROR`·`QUOTE_UNREACHABLE`(KIS 오류·연결 실패)
- 개발 중 확인: `http://localhost:8080/demo.html` 종목 화면의 "시세" 칸

### 종합 요약 다시 생성 (F-08)

`POST /api/stocks/{stockCode}/summary` (로그인 필요, 본문 없음) → 최대 30초

```json
{ "regenerated": true,
  "summary": { "stockCode": "005930", "stockName": "삼성전자", "date": "2026-11-04", "newsSummary": "…",
               "snsSummary": null, "generatedAt": "2026-11-04T10:12:00+09:00", "sentiment": { … } } }
```

- `summary`는 `GET /api/stocks/{code}/summary`와 같은 모양 → 화면은 받은 값으로 그대로 다시 그리면 됨
- `regenerated: false`: 같은 종목을 10분 안에 또 눌렀거나 오늘 기사가 없어서 **저장된 요약 그대로** (LLM 비용 안 씀)
- 오류: `401` 로그인 필요, `404 STOCK_NOT_FOUND`, `429 AI_BUSY`(요청 많음), `503 AI_UNAVAILABLE`(AI 서버 꺼짐·30초 초과), `503 AI_NOT_CONFIGURED`(서버에 `AI_INTERNAL_TOKEN` 없음) → 화면은 기존 요약을 그대로 두고 "잠시 후 다시" 안내
- 백엔드가 AI 서버(`ai/hk_llm/api.py`)를 대신 부름. 브라우저는 AI 서버를 직접 부르지 않음 (비밀값 보호)

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
| 429 | `QUOTE_BUSY` / `REPLAY_BUSY` | KIS 초당 호출 초과 / 다시 보기 동시 실행 초과 (시세 확장) |
| 502 | `QUOTE_UPSTREAM_ERROR` / `QUOTE_UNREACHABLE` | KIS가 오류로 답함 / KIS에 연결 못 함 (시세 확장) |
| 503 | `QUOTE_DISABLED` | 이 서버에서 시세 기능이 꺼져 있음 (`KIS_ENABLED`) |
| 500 | `INTERNAL_ERROR` | 서버 오류 (백엔드에 알려 주세요) |

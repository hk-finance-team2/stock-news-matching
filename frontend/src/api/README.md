# 프론트 ↔ 백엔드 연결 (`src/api`)

화면(`DashboardPage.jsx`)은 **모든 데이터를 백엔드 API에서** 받습니다 (가짜 데이터 `mocks/` 없음).
이 폴더가 그 연결 부분이고, 목록·상세를 받는 도구는 `src/hooks/`에 있습니다.

## 파일

| 파일 | 하는 일 |
|---|---|
| `client.js` | 공용 호출 함수 (`apiGet`·`apiPost`·`apiDelete`), 오류(`ApiError`), 로그인 토큰 보관(`tokenStore`) |
| `index.js` | API 목록 (`stockApi`, `articleApi`, `searchApi`, `authApi`, `watchlistApi`, `boardApi`, `statusApi`, `quoteApi`). 주소·조건은 `docs/api.md`와 같음 |
| `adapters.js` | 백엔드 응답 → 화면 모양 (`toUiStock`, `toUiArticle`, `toUiSummary`, `toUiMentionSeries`) |

## 실행

1. 백엔드 켜기 (`docs/setup.md`). 진짜 뉴스·공시·종목 연결(AI 데이터, 본문 없음)이 기본으로 들어감 (setup.md 2절)
2. `cd frontend && npm run dev` → <http://localhost:5173>
3. `/api` 요청은 `vite.config.js` 프록시가 `localhost:8080`으로 넘김 (코드에 서버 주소를 쓰지 않음)
   - 배포할 때만 `frontend/.env`에 `VITE_API_BASE_URL=https://백엔드주소`

## 연결 현황 (모두 연결됨)

| 화면 | API | 메모 |
|---|---|---|
| 위쪽·홈 통합 검색 (종목 5 + 글 5) | `searchApi.all` | 출처 기본은 뉴스. 별칭("삼전")도 찾음 |
| 홈·종목·관심 종목 글 목록 | `articleApi.list` / `watchlistApi.articles` + `usePagedArticles` | 서버가 조건(출처·감성·기간·관련도·정렬)으로 걸러 20개씩, "더 보기". 출처 기본은 뉴스 |
| 글 상세 (연결 이유·근거 문장·가까운 SNS) | `articleApi.get` + `useArticleDetail` | 목록에는 이유·근거가 없어서 글을 누를 때 상세를 받음 |
| 홈 위쪽 카드 (오늘 뉴스·SNS 수, 마지막 수집) | `articleApi.list(size 1)`, `statusApi.get` | 시장 지수는 API가 없어 뺌 |
| 이슈 순위·종목 찾기 | `stockApi.issues`, `stockApi.search` | 급상승·급하락은 전 종목 시세가 필요해 뺌 |
| 종목 요약·감성 비율·다시 생성 | `stockApi.summary`, `stockApi.regenerate` | 감성은 뉴스 기준. 다시 생성은 로그인 필요 |
| 언급량 추이 | `stockApi.mentions` + `toUiMentionSeries` | 오늘(1시간)·7일·30일(1일) |
| 로그인·회원가입 | `authApi` | JWT를 `tokenStore`에. 가입 규칙은 서버와 같게 (아이디 영문 소문자·숫자 4~20자, 비밀번호 8~64자) |
| 관심 종목 | `watchlistApi` | 오늘 글 수·최근 매칭은 서버 값 |
| 종목 토론 | `boardApi` | 화면은 댓글형, 서버는 게시판: **의견 하나 = 게시판 글 하나(제목 칸, 200자)**. 공감은 서버가 준 값 |
| 데이터 상태 | `statusApi.get` | 1분마다. 15분 넘게 새 뉴스가 없으면 "수집 지연" |
| 현재가 | `quoteApi` | 서버에서 시세가 꺼져 있으면 503 → "-" |

**SNS 표시 규칙** (`docs/api.md` "뉴스·SNS 글"): SNS 카드는 네이버 검색 결과 그대로. 관련도·감성을 붙이지 않고, 누르면 원문(새 창).

## 지킬 것

- **화면마다 맞는 API를 부릅니다.** 종목 검색 API(`/api/stocks`)는 이름·코드·시장·업종만 줍니다.
  시세·매칭 수·감성은 다른 API에 있으니, 검색 결과로 다른 화면을 채우지 않습니다.
- **없는 값은 지어내지 않습니다.** 감성 %나 연결 이유를 기본값으로 채우면 진짜 결과처럼 보입니다.
  비워 두고 "준비 중"으로 표시합니다 (`adapters.js` 원칙).
- 전체 종목(2,655개)을 미리 받아 두지 않습니다. 검색어가 있을 때만 서버에 묻습니다.
- 목록 응답은 `{ items, totalCount }`입니다 (`docs/api.md` 1절).
- 화면 파일은 서준님(프론트) 담당입니다. 화면을 바꾸는 PR은 서준님 리뷰를 받고 합칩니다.
- 개발 서버는 **5173**에서 켭니다. 백엔드 CORS가 5173만 허용해서 다른 포트면 저장(POST) 요청이 403
- 실제로 눌러 보고 올립니다. 예: "삼전" → 삼성전자, "현대차" → 현대자동차, 이슈 순위가 그대로인지.
- 올리기 전에 `npm run lint`, `npm run build`. PR에서도 `frontend-ci`가 같은 검사를 돌려 ✅/❌를 보여 줍니다.
- 서버 주소(`http://localhost:8080`)를 코드에 쓰지 않습니다. `/api/...`로 부르면 개발 땐 프록시가, 배포 땐 `VITE_API_BASE_URL`이 맞춰 줍니다.

# 프론트 ↔ 백엔드 연결 (`src/api`)

화면(`pages/DashboardPageV6.jsx`)의 모든 데이터는 백엔드 API에서 옵니다. 가짜 데이터 파일(`mocks/mockData.js`)과
이전 화면 버전(V1~V5)은 2026-11-09에 정리했습니다 (Git 기록에서 볼 수 있음).

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

## 연결 현황 (2026-11-09, 모두 연결)

| 화면 | API |
|---|---|
| 홈 글 목록 (최근 100건)·글 상세 (연결 이유·근거 문장·가까운 SNS) | `articleApi.list` · `articleApi.get` + `toUiArticle` |
| 오늘의 이슈 종목 TOP 7, 종목 탐색 기본 목록 (1분마다) | `stockApi.issues` |
| 종목 탐색·관심 종목 추가 검색 | `stockApi.search` |
| 위쪽 통합 검색 (종목 5개 + 글 5개, 기간·출처) | `searchApi.all` |
| 종목 요약·감성 비율, 요약 다시 생성 (로그인) | `stockApi.summary` · `stockApi.regenerate` + `toUiSummary` |
| 언급량 추이, 오늘 뉴스·SNS 글 수 | `stockApi.mentions` |
| 종목 토론 (의견 하나 = 게시판 글 하나, 200자) | `boardApi.posts` · `write` · `toggleLike` · `removePost` + `toUiBoardComment` |
| 로그인·회원가입 | `authApi` |
| 관심 종목, 관심 종목 글 모아 보기 | `watchlistApi.list` · `add` · `remove` · `articles` |
| 데이터 상태 (마지막 갱신, 1분마다) | `statusApi.get` |
| 현재가·차트 | `quoteApi.get` · `quoteApi.chart` (서버에서 시세가 꺼져 있으면 503 → "시세 연동 전") |

- 종목 목록을 미리 받아 두지 않습니다. 이슈 순위·관심 종목·검색 결과·글의 연결 종목처럼 **API가 알려 준 종목만** 화면에 모읍니다 (`rememberStocks`)
- 값이 없으면 지어내지 않고 "준비 중"·"-"으로 둡니다 (감성 비율이 없으면 막대 대신 "오늘 감성을 판단한 기사가 없습니다")

## 지킬 것

- **화면마다 맞는 API를 부릅니다.** 종목 검색 API(`/api/stocks`)는 이름·코드·시장·업종만 줍니다.
  시세·매칭 수·감성은 다른 API에 있으니, 검색 결과로 다른 화면을 채우지 않습니다.
- **없는 값은 지어내지 않습니다.** 감성 %나 연결 이유를 기본값으로 채우면 진짜 결과처럼 보입니다.
  비워 두고 "준비 중"으로 표시합니다 (`adapters.js` 원칙).
- 전체 종목(2,655개)을 미리 받아 두지 않습니다. 검색어가 있을 때만 서버에 묻습니다.
- 목록 응답은 `{ items, totalCount }`입니다 (`docs/api.md` 1절).
- 화면 파일은 서준님(프론트) 담당입니다. 화면을 바꾸는 PR은 서준님 리뷰를 받고 합칩니다.
- 새 화면 버전을 만들 때도 가짜 데이터를 다시 넣지 말고, 지금 화면의 API 연결을 그대로 가져가 주세요.
- 실제로 눌러 보고 올립니다. 예: "삼전" → 삼성전자, "현대차" → 현대자동차, 이슈 순위가 그대로인지.
- 올리기 전에 `npm run lint`, `npm run build`. PR에서도 `frontend-ci`가 같은 검사를 돌려 ✅/❌를 보여 줍니다.
- 서버 주소(`http://localhost:8080`)를 코드에 쓰지 않습니다. `/api/...`로 부르면 개발 땐 프록시가, 배포 땐 `VITE_API_BASE_URL`이 맞춰 줍니다.

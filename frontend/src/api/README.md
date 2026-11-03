# 프론트 ↔ 백엔드 연결 (`src/api`)

화면(`DashboardPage.jsx`)은 아직 대부분 가짜 데이터(`mocks/mockData.js`)를 씁니다.
화면을 **하나씩** 실제 API로 바꿔 가는 중이고, 이 폴더가 그 연결 부분입니다.

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

## 연결 현황

| 화면 | API | 상태 |
|---|---|---|
| 위쪽·홈 검색의 **종목** 결과 | `stockApi.search` | ✅ 연결 (서버가 꺼져 있으면 가짜 데이터에서 찾음) |
| 검색으로 고른 실제 종목 선택·관심 종목 추가 | (위 결과 사용) | ✅ 연결. 시세·요약은 아직 없어서 "준비 중"으로 표시 |
| 검색의 **글** 결과 | `searchApi.all` 또는 `articleApi.list({ q })` | ⬜ |
| 홈·뉴스·SNS 글 목록 | `articleApi.list` + `toUiArticle` | ⬜ |
| 글 상세 (연결 이유·근거 문장·가까운 SNS) | `articleApi.get` + `toUiArticle` | ⬜ 목록에는 이유·근거가 없어서 글을 누를 때 상세를 불러야 함 |
| 이슈 순위 | `stockApi.issues` | ⬜ |
| 종목 요약·감성 비율 | `stockApi.summary` + `toUiSummary` | ⬜ |
| 언급량 추이 | `stockApi.mentions` + `toUiMentionSeries` | ⬜ |
| 로그인·회원가입 | `authApi` | ⬜ 지금은 브라우저 안 가짜 계정 |
| 관심 종목 | `watchlistApi` | ⬜ 로그인 연결 다음 |
| 종목 토론 | `boardApi` | ⬜ 화면은 댓글형, API는 글+댓글형이라 화면과 맞춰 정해야 함 |
| 마지막 갱신 시각 | `statusApi.get` | ⬜ |
| 현재가 | `quoteApi` | ⬜ 서버에서 시세가 꺼져 있으면 503 → "시세 준비 중" |

**추천 순서**: 홈 글 목록 → 글 상세 → 이슈 순위 → 종목 요약·언급량 → 로그인 → 관심 종목.
화면 하나를 바꿀 때마다 그 화면이 쓰는 가짜 데이터만 걷어 냅니다. 한 번에 전체를 바꾸지 않습니다.

## 지킬 것

- **화면마다 맞는 API를 부릅니다.** 종목 검색 API(`/api/stocks`)는 이름·코드·시장·업종만 줍니다.
  시세·매칭 수·감성은 다른 API에 있으니, 검색 결과로 다른 화면을 채우지 않습니다.
- **없는 값은 지어내지 않습니다.** 감성 %나 연결 이유를 기본값으로 채우면 진짜 결과처럼 보입니다.
  비워 두고 "준비 중"으로 표시합니다 (`adapters.js` 원칙).
- 전체 종목(2,655개)을 미리 받아 두지 않습니다. 검색어가 있을 때만 서버에 묻습니다.
- 목록 응답은 `{ items, totalCount }`입니다 (`docs/api.md` 1절).
- 화면 파일은 서준님(프론트) 담당입니다. 화면을 바꾸는 PR은 서준님 리뷰를 받고 합칩니다.
- 실제로 눌러 보고 올립니다. 예: "삼전" → 삼성전자, "현대차" → 현대자동차, 이슈 순위가 그대로인지.
- 올리기 전에 `npm run lint`, `npm run build`. PR에서도 `frontend-ci`가 같은 검사를 돌려 ✅/❌를 보여 줍니다.
- 서버 주소(`http://localhost:8080`)를 코드에 쓰지 않습니다. `/api/...`로 부르면 개발 땐 프록시가, 배포 땐 `VITE_API_BASE_URL`이 맞춰 줍니다.

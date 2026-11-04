# 시연 체크리스트

시연은 **백엔드1(김태경) PC**에서 [setup.md](setup.md) 4-3의 `--profile full`로 합니다.
키(OpenAI·DART·KIS)는 그 PC의 `.env`에만 있습니다. 다른 PC에서는 `--profile full`을 켜지 않습니다.

## 며칠 전

- [ ] main 최신으로 `git pull` 후 `docker compose --profile full up -d --build`
- [ ] **시연 2~3일 전부터 켜 둡니다.** 오늘의 이슈 종목·종목별 하루 요약·언급량 그래프가 그날그날 데이터로 채워집니다. 카페 글은 처음 켠 1시간은 기준점만 잡고 그다음부터 들어옵니다 (켜 두는 동안 OpenAI 하루 약 $1 추정)
- [ ] `.env` 확인 (값을 화면에 띄우지 말고 채워졌는지만): `OPENAI_API_KEY`, `DART_API_KEY`, `AI_INTERNAL_TOKEN`, `NAVER_CLIENT_ID`·`NAVER_CLIENT_SECRET`, `KIS_APP_KEY`·`KIS_APP_SECRET`·`KIS_ENABLED=true`
- [ ] `FLYWAY_LOCATIONS` 줄이 주석(`#`)인지 → 예시 기사가 섞이지 않음 (예전에 켰다면 setup.md 2절대로 지우기)

## 당일 아침 (장 시작 09:00 전)

- [ ] Docker Desktop이 켜져 있음 (PC를 다시 켰다면 Docker Desktop만 켜면 상자 5개가 다시 켜짐)
- [ ] `docker compose --profile full ps` → `db`, `backend`, `ai`, `ai-api`, `frontend` 모두 `running`
- [ ] http://localhost:5173 에서 아래를 한 번씩 눌러 봄

| 확인 | 정상 |
|---|---|
| 데이터 상태 (F-16) | 뉴스 수집 시각이 10분 안쪽 |
| 홈 글 목록 (F-10) | 오늘 기사가 맨 위 |
| 글 상세 (F-11) | 관련 종목·관련도·연결 이유·근거 문장 |
| SNS (F-01·F-10) | 홈에서 출처 `SNS` → 오늘 블로그·카페 글, "참고용 · 확인되지 않은 정보" 표시, 관련도 50%. 종목 화면의 SNS 반응 요약 |
| 종목별 조회 (F-12·F-14) | 이슈 종목 순위, 하루 요약, 감성 비율, 언급량 그래프 |
| 다시 생성 (F-08) | 로그인 후 버튼 → 몇 초 안에 요약 (오늘 글이 없는 종목은 "없음") |
| 검색 (F-13) | `삼성` → 종목과 글 |
| 로그인·관심 종목·게시판 (F-18~F-20) | 시연용 계정으로 |
| 현재가·차트·급등락 (①② F-17) | 장중에는 현재가가 1초마다 바뀜 |

- 프론트 화면에 문제가 있으면 백엔드 확인용 화면 http://localhost:8080/demo.html 로 같은 기능을 보여 줄 수 있습니다

## 문제가 생기면

| 증상 | 확인 | 해결 |
|---|---|---|
| 5173이 안 열림 | `docker compose --profile full ps` | `docker compose --profile full up -d` |
| 새 기사가 안 들어옴 | `docker compose logs --tail 50 ai` | OpenAI 오류면 키·잔액 확인. 언론사 RSS 한두 곳 실패는 정상 (그 언론사만 빠지고 계속 돎) |
| SNS 글이 안 늘어남 | `docker compose logs --tail 50 ai \| grep SNS` | "네이버 키 없음"이면 `.env`의 `NAVER_…` 확인 후 `docker compose --profile full up -d --force-recreate ai`. "검색 실패"가 몇 개면 인터넷이 잠깐 끊긴 것 (다음 시간에 다시) |
| "다시 생성"이 503 | `docker compose logs --tail 20 ai-api` | `AI_INTERNAL_TOKEN`이 비었는지, `ai-api`가 켜졌는지 |
| 현재가가 안 바뀜 | http://localhost:8080/api/quotes/status | 장 밖(15:30 이후·주말)에는 원래 멈춤 → 다시 보기로 시연 |
| 인터넷이 끊김 | - | 이미 모은 데이터는 내 PC DB에 있어 화면은 그대로. 새 기사·현재가만 멈춤 |

# Docker로 실행하기 (쉽게 보기)

> **한 줄 요약:** Docker Desktop을 켜 두고, 레포 맨 위 폴더에서 `docker compose up -d --build`를 치면 **DB와 백엔드 서버**가 켜집니다.

설치 방법은 [setup.md](setup.md) 1절, 문제가 생기면 [setup.md](setup.md) 7절을 보세요.

## 1. 지금 무엇이 켜지나

| | 켜지나 | 브라우저에서 |
|---|---|---|
| DB (MariaDB) | ✅ | 안 보임 (데이터 창고) |
| 백엔드 서버 (Spring) | ✅ | http://localhost:8080/swagger-ui.html (API 시험 화면) |
| 프론트 (React 화면) | ❌ 아직 | `frontend` 폴더에서 `npm run dev` 따로 → http://localhost:5173 |
| AI 서버 (Python) | ❌ 아직 | AI 파트가 따로 실행 |

나중에 프론트·AI도 합쳐서 **명령 한 줄로 전부** 켜지게 할 예정입니다.

## 2. 등장인물 (비유로 이해하기)

| 이름 | 하는 일 | 비유 |
|---|---|---|
| **Docker Desktop** (앱) | Docker 엔진을 켜 둠. 꺼져 있으면 아무것도 안 됨 | TV 본체 전원 |
| **`docker compose` 명령** | 상자를 만들고 켜고 끔 | 리모컨 |
| **`docker-compose.yml`** (레포 맨 위) | "DB는 MariaDB 11.8.9로, 백엔드는 `backend` 폴더로 만들어라" | 주문서 |
| **`backend/Dockerfile`** | "백엔드 코드를 이렇게 포장해라" | 밀키트 포장 설명서 |
| **`.env`** (레포 맨 위, 각자 PC에만) | 비밀번호·키. GitHub에 안 올라감 | 내 금고 비밀번호 메모 |
| **컨테이너** | 실제로 돌아가는 프로그램 하나 (DB 하나, 백엔드 하나) | 밀키트 상자 |
| **볼륨** `db-data` | DB 데이터를 보관하는 곳. 상자를 꺼도 남음 | 창고 |
| **Flyway** | 서버가 켜질 때 테이블·기본 데이터를 자동으로 만듦 | 공사 지시서 + 공사 일지 |

## 3. 명령 한 줄이 하는 일

```
레포 맨 위 폴더에서:  docker compose up -d --build
        │
        ▼
① 지금 폴더의 docker-compose.yml(주문서)를 읽음
② db 상자: MariaDB 11.8.9를 받아서 켬 (.env의 비밀번호 사용)
③ backend 상자: backend/Dockerfile(포장 설명서)대로 내 코드를 포장
     - Java 21이 든 상자에서 코드를 빌드 → app.jar 하나로
     - 실행용 작은 상자에 app.jar만 담음
④ DB가 준비될 때까지 기다린 뒤 백엔드를 켬
⑤ 백엔드가 켜지면서 Flyway가 공사 일지를 보고 안 한 V 파일만 실행
     - 처음이면 V1~V6 전부 → 테이블 13개 + 종목 2,655개
⑥ 내 PC의 8080 → 백엔드, 3308 → DB로 연결
```

**왜 꼭 레포 맨 위 폴더에서?** `docker compose`는 **명령을 친 폴더**의 `docker-compose.yml`을 읽기 때문입니다. 다른 폴더에서 치면 "파일 없음"이 나옵니다.

**프로젝트가 여러 개면?** 폴더 이름이 프로젝트 이름이 되어 상자·데이터가 따로 관리됩니다 (`stock-news-matching-db-1` 처럼). 단 **포트(8080, 3308)는 PC 전체가 같이 쓰므로** 같은 포트를 쓰는 다른 프로젝트와 동시에 켤 수 없습니다.

**왜 내 PC의 Java가 필요 없나?** 포장할 때 쓰는 Java가 **상자 안에** 들어 있기 때문입니다.

## 4. 명령 모음 (레포 맨 위 폴더에서)

| 언제 | 명령 |
|---|---|
| **처음 켤 때 / `git pull` 후** | `docker compose up -d --build` |
| 그냥 다시 켤 때 (코드 그대로) | `docker compose up -d` |
| 지금 켜진 상자 보기 | `docker compose ps` (STATUS에 `healthy`, `Up`이면 정상) |
| 백엔드 로그 보기 | `docker compose logs -f backend` (빠져나오기 `Ctrl + C`) |
| 끄기 (데이터 유지) | `docker compose stop` |
| DB만 켜기 (백엔드를 `gradlew`로 개발할 때) | `docker compose up -d db` |
| **처음부터 다시** (내 PC의 DB 데이터 **삭제**) | `docker compose down -v` 후 `docker compose up -d --build` |

- `-d`: 뒤에서 돌리기 (터미널을 닫아도 계속 켜져 있음)
- `--build`: 코드를 **다시 포장**. 새 코드를 받았는데 안 붙이면 **예전 백엔드**가 켜짐
- `-v`: 창고(볼륨)까지 지움. 다시 켜면 Flyway가 처음부터 다시 만듦

## 5. 버튼으로도 할 수 있는 것

처음 한 번 명령으로 상자를 만든 뒤에는, **Docker Desktop 앱**에서도 켜고 끌 수 있습니다.

- 왼쪽 **Containers** → `stock-news-matching` 옆 **▶ 실행 / ■ 정지**
- 상자 이름을 누르면 **로그**도 볼 수 있음
- 단, **새 코드로 다시 포장(`--build`)은 명령으로만** 됩니다

## 6. 매일 쓰는 순서

```
1. PC를 켰으면 Docker Desktop부터 실행 → "Engine running" 확인
2. 레포 맨 위 폴더에서 git pull
3. docker compose up -d --build
4. http://localhost:8080/swagger-ui.html 확인
5. 다 쓰면 docker compose stop (안 꺼도 됨, PC를 끄면 같이 꺼짐)
```

## 7. 자주 묻는 것

| 증상 | 해결 |
|---|---|
| `docker` 명령이 없음 | 설치 직후 열려 있던 터미널 → **터미널 새로 열기** |
| `failed to connect to the docker API` | **Docker Desktop이 꺼져 있음** → 켜고 Engine running 확인 |
| `no configuration file provided` | 레포 맨 위 폴더가 아님 → `cd`로 이동 |
| 백엔드가 안 켜짐 (`JWT_SECRET`) | `.env`의 `JWT_SECRET`을 32자 이상으로 |
| 새 기능이 안 보임 | `--build`를 안 붙임 |
| `8080` / `3308` 포트 오류 | 같은 포트를 쓰는 다른 프로그램이 켜져 있음 → 끄거나 [setup.md](setup.md) 7절 |

더 많은 문제는 [setup.md](setup.md) 7절에 있습니다.

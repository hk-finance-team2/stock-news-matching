# 개발 환경 설정

처음 한 번 순서대로 따라 하면 내 PC에서 DB와 백엔드 서버가 켜집니다.
AI 도구에게 "`docs/setup.md`대로 해줘"라고 시켜도 됩니다.

- 명령은 Windows **PowerShell** 기준입니다.
- 레포 내려받기와 `.env` 복사는 [Git 사용 가이드](git-guide.md) 1절을 먼저 따라 하세요.
- AI·프론트 부분은 각 파트가 아래 빈 절에 채웁니다.

## 0. 무엇을 설치하나

| 프로그램 | 누가 | 왜 |
|---|---|---|
| Git | 모두 | 코드 받기·올리기 |
| WSL 2 | 모두 (Windows) | Docker가 돌아가는 바탕(작은 리눅스) |
| Docker Desktop | 모두 | 팀 공용 DB와 백엔드 서버를 똑같이 켜기 |
| Java 21 (Eclipse Temurin) | 백엔드 코드를 고치는 사람만 | `gradlew`로 서버를 직접 빌드·실행 (Docker로 켜면 필요 없음) |
| IntelliJ IDEA | 백엔드 (권장) | 코드 편집 |

## 1. 설치 (처음 한 번)

### 1-1. WSL 2

**관리자 권한** PowerShell(시작 메뉴 → PowerShell 우클릭 → 관리자 권한으로 실행)에서:

```powershell
wsl --install
```

끝나면 **재부팅**합니다. 확인: `wsl --status`에 `기본 버전: 2`가 나오면 됩니다.

### 1-2. Docker Desktop

```powershell
winget install --id Docker.DockerDesktop -e --source winget
```

- 설치 중 "이 앱이 디바이스를 변경하도록 허용하시겠어요?" → **예**
- 설치 후 Docker Desktop을 한 번 실행합니다. 약관 **Accept**, 로그인은 해도 되고 건너뛰어도 됩니다.
- 창 왼쪽 아래 **Engine running**(초록)이면 준비 완료

확인 (새 터미널에서):

```powershell
docker --version
docker compose version
docker run --rm hello-world
```

`Hello from Docker!`가 나오면 성공입니다.

> Mac: Docker 공식 사이트에서 Docker Desktop for Mac을 받아 설치합니다.

### 1-3. Java 21 (백엔드만)

```powershell
winget install --id EclipseAdoptium.Temurin.21.JDK -e --source winget
```

확인 (새 터미널에서): `java -version`에 `21.`로 시작하는 버전이 나오면 됩니다.

> Mac: adoptium.net에서 Temurin 21을 받아 설치합니다.

## 2. `.env` 채우기

[Git 사용 가이드](git-guide.md) 1-5대로 `.env`를 만든 뒤, 아래 네 칸을 채웁니다.
내 PC에서만 쓰는 값이라 아무 값이나 정하면 됩니다. (다른 사람과 같을 필요 없음)

```
DB_USERNAME=stocknews_app
DB_PASSWORD=내가-정한-비밀번호
MARIADB_ROOT_PASSWORD=내가-정한-관리자-비밀번호
JWT_SECRET=영문과-숫자로-32자-이상-아무-값
```

- `DB_PORT=3308`은 그대로 둡니다. (수업용 MariaDB 3306과 겹치지 않게)
- **주의:** DB 값은 DB를 **처음 켤 때** 한 번만 적용됩니다. 나중에 바꾸려면 7절의 "DB 초기화"를 해야 합니다.
- `JWT_SECRET`은 로그인 토큰의 서명 키입니다. **32자보다 짧으면 백엔드 서버가 켜지지 않습니다.**

## 3. DB 켜기

Docker Desktop이 켜져 있는 상태에서, 저장소 최상위 폴더에서:

```powershell
docker compose up -d db
```

확인:

```powershell
docker compose ps
```

STATUS에 `(healthy)`가 보이면 됩니다. 처음에는 MariaDB 이미지를 내려받느라 1~2분 걸립니다.

| 하고 싶은 것 | 명령 |
|---|---|
| DB 끄기 (데이터 유지) | `docker compose stop db` |
| DB 다시 켜기 | `docker compose up -d db` |

PC를 껐다 켜면 **Docker Desktop을 먼저 실행**해야 DB가 뜹니다.

## 4. 백엔드 서버 켜기

방법이 두 가지입니다. **백엔드 코드를 고치지 않는다면 4-1(Docker)을 쓰세요.**
두 방법 모두 8080 포트를 쓰므로 **동시에 켜면 안 됩니다** (나중에 켠 쪽이 `8080 already in use`로 실패).

### 4-1. Docker로 켜기 (Java 필요 없음, 프론트·AI 추천)

저장소 최상위 폴더에서:

```powershell
docker compose up -d --build
```

- DB와 백엔드가 함께 켜집니다. 처음에는 상자를 만드느라 몇 분 걸립니다.
- 상자 안에 Java 21이 들어 있어서 내 PC의 Java 버전과 상관없습니다.
- **`git pull`로 백엔드 코드를 새로 받았다면 `--build`를 꼭 붙여** 상자를 다시 만듭니다. 붙이지 않으면 예전 백엔드가 켜집니다.

| 하고 싶은 것 | 명령 |
|---|---|
| 백엔드 로그 보기 | `docker compose logs -f backend` (끄기: `Ctrl + C`) |
| 백엔드만 끄기 | `docker compose stop backend` |
| DB·백엔드 모두 끄기 (데이터 유지) | `docker compose stop` |

### 4-2. gradlew로 켜기 (Java 21 필요, 백엔드 개발용)

코드를 고치면서 바로 확인할 때 씁니다. DB만 Docker로 켜고(3절), 백엔드는 내 PC에서 실행합니다.

```powershell
cd backend
.\gradlew.bat bootRun
```

(Mac: `./gradlew bootRun`)

- 처음에는 Gradle과 라이브러리를 내려받느라 몇 분 걸립니다.
- 로그에 `Started StocknewsApplication`이 나오면 성공입니다.
- 켜질 때 Flyway가 테이블과 예시 데이터를 자동으로 만듭니다.
- 끄기: `Ctrl + C`
- 4-1로 백엔드 상자를 켜 둔 상태라면 먼저 `docker compose stop backend`

## 5. 확인

| 주소 | 무엇이 보이나 |
|---|---|
| http://localhost:8080/swagger-ui.html | API 목록 화면. `GET /api/stocks` → **Try it out** → **Execute** |
| http://localhost:8080/api/stocks | 예시 종목 5개 JSON |

터미널에서 확인하려면 (PowerShell에서는 `curl`이 아니라 `curl.exe`):

```powershell
curl.exe http://localhost:8080/api/stocks
```

## 6. DB 클라이언트로 접속 (HeidiSQL, DBeaver 등)

| 항목 | 값 |
|---|---|
| 종류 | MariaDB |
| 호스트 | `localhost` |
| 포트 | `3308` |
| 사용자 | `.env`의 `DB_USERNAME` |
| 비밀번호 | `.env`의 `DB_PASSWORD` |
| 데이터베이스 | `stocknews` |

## 7. 자주 겪는 문제

| 증상 | 원인 | 해결 |
|---|---|---|
| `failed to connect to the docker API ... dockerDesktopLinuxEngine` | Docker Desktop이 꺼져 있음 | Docker Desktop 실행 후 Engine running 확인 |
| `docker` 명령을 찾을 수 없음 | 설치 직후 열려 있던 터미널 | 터미널을 새로 열기 |
| `Port 8080 was already in use` | 서버가 이미 다른 창이나 Docker 상자로 켜져 있음 | 그 창에서 `Ctrl + C`, 또는 `docker compose stop backend` 후 다시 실행 |
| `Cannot find a Java installation ... languageVersion=21` | `gradlew`로 켰는데 PC에 Java 21이 없음 | Java 21 설치(1-3), 또는 4-1 Docker로 켜기 |
| Docker로 켠 백엔드에 새 기능이 없음 | `git pull` 후 상자를 다시 안 만듦 | `docker compose up -d --build` |
| DB를 켤 때 3308 포트 오류 (`port is already allocated`, `ports are not available` 등) | 다른 프로그램이 3308을 씀 | `.env`의 `DB_PORT`를 다른 번호로 바꾸고 백엔드도 같은 값 사용 |
| `Validate failed: Migrations have failed validation` | 이미 실행된 V 파일 내용이 바뀜 | V 파일을 원래대로 되돌리고 새 V 파일로 추가. 내 PC에서만 실험 중이면 아래 "DB 초기화" |
| `Access denied for user` | `.env` 비밀번호를 DB를 만든 뒤에 바꿈 | 아래 "DB 초기화" |

**DB 초기화** (내 PC의 DB 데이터가 **모두 지워집니다**):

```powershell
docker compose down -v
docker compose up -d db
```

그다음 백엔드를 켜면 Flyway가 테이블과 예시 데이터를 처음부터 다시 만듭니다.

## 8. 버전 정리

| 항목 | 버전 |
|---|---|
| Java | 21 (Eclipse Temurin) |
| Spring Boot | 4.1.2 |
| Gradle | 9.8.2 (Wrapper가 자동 설치) |
| MariaDB | 11.8.9 (Docker) |
| Flyway | 12.4.0 (Spring Boot가 관리) |
| MyBatis Spring Boot Starter | 4.1.0 |
| springdoc-openapi | 3.2.0 |

버전을 고른 이유는 [결정 기록](decisions.md)에 있습니다.

## 9. AI 파트 (Python · FastAPI)

AI 파트가 채웁니다. (Python 버전, 가상환경, 패키지 설치, 실행 방법)

## 10. 프론트엔드 (React · Vite)

프론트 파트가 채웁니다. (Node.js 버전, 패키지 설치, 실행 방법)

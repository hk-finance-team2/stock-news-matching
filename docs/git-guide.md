# Git 사용 가이드 (처음 쓰는 사람용)

이 문서만 보고 순서대로 따라 하면 됩니다.
AI 도구(Claude Code, Codex, Antigravity 등)에게 "`docs/git-guide.md`대로 해줘"라고 시켜도 됩니다.

명령어는 Windows **PowerShell** 기준입니다. Mac은 터미널에서 같은 명령을 쓰면 되고, 다른 부분만 따로 적었습니다.

## 0. 용어 5개

| 용어 | 뜻 |
|---|---|
| 레포(Repository) | 프로젝트 폴더. GitHub에 있는 원본과 내 컴퓨터에 받은 사본이 있음 |
| 브랜치(Branch) | 작업용 복사본. 여기서 작업하면 원본(`main`)은 안전함 |
| 커밋(Commit) | "여기까지 저장". 메시지를 붙여 무엇을 바꿨는지 기록 |
| push / pull | push = 내 컴퓨터 → GitHub에 올리기 / pull = GitHub → 내 컴퓨터로 받기 |
| PR(Pull Request) | "내 브랜치를 main에 합쳐주세요" 요청서. main은 PR로만 바뀜 |

## 1. 처음 한 번만

### 1-1. 조직 초대 수락
GitHub 가입 이메일 또는 GitHub 오른쪽 위 🔔 알림에서 `hk-finance-team2` 초대를 수락합니다. (7일 지나면 만료)

### 1-2. Git 설치 확인
```powershell
git --version
```
`git version 2.xx` 처럼 나오면 설치된 것입니다.
안 나오면 https://git-scm.com 에서 설치합니다 (설치 화면은 전부 기본값으로 Next).

### 1-3. 이름·이메일 설정
커밋에 기록되는 이름입니다. 이메일은 **GitHub 계정에 등록된 이메일**을 써야 내 프로필에 기여로 표시됩니다.
```powershell
git config --global user.name "내GitHub아이디"
git config --global user.email "GitHub에-등록된-이메일"
```

### 1-4. 레포 내려받기
`C:\dev` 폴더에 받는 예시입니다. (Mac은 `cd ~` 후 `mkdir dev`)
```powershell
mkdir C:\dev
cd C:\dev
git clone https://github.com/hk-finance-team2/stock-news-matching.git
cd stock-news-matching
```
이제 `C:\dev\stock-news-matching`이 내 작업 폴더입니다.

### 1-5. `.env` 만들기
키 이름만 적힌 견본을 복사해서 내 키를 채웁니다. `.env`는 GitHub에 올라가지 않게 막혀 있습니다.
```powershell
Copy-Item .env.example .env
```
(Mac: `cp .env.example .env`)
메모장이나 IDE로 `.env`를 열어 내 파트에 필요한 값만 채웁니다.

### 1-6. 첫 push 때 로그인
처음 push하면 GitHub 로그인 창이 뜹니다. 로그인하면 다음부터는 뜨지 않습니다.

## 2. 내 작업 위치

| 역할 | 작업 폴더 | 브랜치 이름 예시 |
|---|---|---|
| 백엔드1, 백엔드2 | `backend/` (패키지 단위로 담당 나눔) | `feature/be-kis-collect` |
| AI | `ai/` | `feature/ai-news-summary` |
| 프론트 | `frontend/` | `feature/fe-news-chart` |
| 공용 문서 | `docs/` (고치기 전에 Slack에 알림) | `feature/docs-api-spec` |

- 브랜치 이름: `feature/파트-기능`, 버그 수정은 `fix/파트-내용`
- 공용 파일(`backend/build.gradle`, `application*.yml`, `common` 패키지, `docs/`, `AGENTS.md`)은 고치기 전에 Slack에 알립니다.

## 3. 매일 하는 흐름

작업 폴더(`C:\dev\stock-news-matching`)에서 순서대로 실행합니다.

### ① 최신 코드 받기
```powershell
git switch main
git pull
```

### ② 내 브랜치 만들기
```powershell
git switch -c feature/be-kis-collect
```
`-c`는 새로 만들 때만 붙입니다. 이미 있는 내 브랜치로 돌아갈 때는 `git switch feature/be-kis-collect`

### ③ 작업하고 저장(커밋)
```powershell
git status
git add .
git commit -m "feat: KIS 실시간 체결 수집 추가"
```
- `git status`: 무엇이 바뀌었는지 확인. `.env`나 `data/` 파일이 목록에 없어야 정상입니다.
- 커밋 메시지는 `타입: 내용`
  - `feat` 기능 / `fix` 버그 / `docs` 문서 / `refactor` 구조 개선 / `test` 테스트 / `chore` 설정·기타
- 작업 중간에 커밋을 여러 번 해도 됩니다.

### ④ GitHub에 올리기(push)
처음 올릴 때:
```powershell
git push -u origin feature/be-kis-collect
```
두 번째부터는:
```powershell
git push
```
push하면 GitHub에 백업도 됩니다.

### ⑤ PR 만들고 합치기
GitHub 화면에서 합니다. → 4번 참고

### ⑥ 합친 뒤 정리
```powershell
git switch main
git pull
git branch -d feature/be-kis-collect
```
마지막 줄은 내 컴퓨터에 남은 다 쓴 브랜치를 지우는 것입니다. 다음 작업은 다시 ①부터.

## 4. PR 만들고 합치기 (GitHub 화면)

1. 레포 페이지(`github.com/hk-finance-team2/stock-news-matching`)에 들어가면 노란 줄에 **Compare & pull request** 버튼이 보입니다. 누릅니다.
   - 안 보이면 **Pull requests** 탭 → **New pull request** → compare에서 내 브랜치 선택
2. 맨 위 방향이 **base: main ← compare: 내 브랜치**인지 확인합니다.
3. 자동으로 나온 양식(무엇을 / 왜 / 확인 방법 / 체크)을 채웁니다.
4. **Create pull request**를 누릅니다.
5. **Files changed** 탭에서 바뀐 내용을 한 번 봅니다. (초록 = 추가, 빨강 = 삭제)
6. **Conversation** 탭 아래 초록 버튼 옆 **▼** → **Squash and merge** → **Confirm squash and merge**
7. 합쳐지면 GitHub의 브랜치는 자동으로 지워집니다. 내 컴퓨터는 3-⑥으로 정리합니다.

공용 파일을 고친 PR은 Slack에 PR 링크를 올립니다.

## 5. 이럴 땐 이렇게

### main에 push했더니 거부됐다 (`protected branch`, `rejected`)
main은 PR로만 바뀌게 잠겨 있습니다. 지금 작업을 브랜치로 옮겨서 올립니다.
```powershell
git switch -c feature/파트-기능
git push -u origin feature/파트-기능
```
그다음 4번대로 PR을 만듭니다. 내 컴퓨터의 main은 PR이 합쳐진 뒤 정리합니다.
```powershell
git switch main
git fetch origin
git reset --hard origin/main
```
마지막 줄은 내 main을 GitHub의 main과 똑같이 맞춥니다. **브랜치로 옮겨 push한 다음에만** 실행하세요.

### 커밋 전에 main에서 작업하고 있었다는 걸 알았다
바뀐 내용은 그대로 둔 채 브랜치만 새로 만들면 됩니다. 변경 내용이 새 브랜치로 따라갑니다.
```powershell
git switch -c feature/파트-기능
```

### PR에 "conflicts"(충돌)가 표시된다
다른 사람이 같은 파일의 같은 부분을 먼저 고친 경우입니다.
```powershell
git switch main
git pull
git switch 내브랜치
git merge main
```
충돌 난 파일을 열면 이런 표시가 있습니다.
```
<<<<<<< HEAD
내가 쓴 내용
=======
main에 있던 내용
>>>>>>> main
```
남길 내용만 남기고 `<<<<<<<`, `=======`, `>>>>>>>` 줄을 지운 뒤 저장합니다.
```powershell
git add .
git commit -m "fix: main과 충돌 해결"
git push
```
어느 쪽을 남길지 애매하면 그 부분을 쓴 팀원에게 Slack으로 물어봅니다.

### 무엇을 바꿨는지 보고 싶다
```powershell
git status
git diff
```

### 아직 커밋 안 한 변경을 버리고 싶다
```powershell
git restore 파일이름
```
되돌릴 수 없으니 주의합니다.

### 실수로 API 키나 비밀번호를 올렸다
커밋을 지워도 이미 GitHub 기록에 남습니다. **해당 키를 바로 폐기하고 새로 발급**한 뒤 Slack에 알립니다.

## 6. AI 에이전트와 함께 쓰기

팀 규칙은 `AGENTS.md`에 있고, 각 도구가 자동으로 읽습니다.

| 도구 | 읽는 파일 |
|---|---|
| Codex, Antigravity(1.20.5 이상), Cursor, GitHub Copilot 등 | `AGENTS.md` |
| Claude Code | `CLAUDE.md` → `AGENTS.md`를 불러옴 |

AI에게 이렇게 시킬 수 있습니다.
- "`docs/git-guide.md` 3번대로 `feature/be-kis-collect` 브랜치를 만들어줘"
- "지금 바뀐 내용을 보여주고, 커밋 메시지 규칙에 맞게 커밋해줘"
- "push해도 되는지 확인할게. 올라갈 파일 목록을 먼저 보여줘"
- "PR에 충돌이 났어. 어느 부분이 왜 충돌인지 설명해줘"

AI는 `AGENTS.md` 규칙에 따라 사람의 확인 없이 push하거나 PR을 merge하지 않습니다.

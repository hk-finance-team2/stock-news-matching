# Docker 감시 (2026-11-11): 수집기 바깥에서 5분마다 Docker 엔진이 살아 있는지 확인
#
# 왜: 11/10 17:50, 11/11 10:12 두 번 Docker Desktop 이 종료 기록 없이 죽었는데 알림이 없었음.
#     수집 점검·Slack 알림은 컨테이너 안(수집기)에서 보내서, Docker 가 죽으면 알림도 같이 죽음.
#     → 감시는 감시 대상 바깥에 둔다 (Google SRE 책 6장 "black-box monitoring": 밖에서 사용자처럼 확인)
#
# 하는 일
#   1. docker 엔진 응답 없음 → Docker Desktop 이 꺼져 있으면 다시 켬, Slack 에 "꺼짐 감지" 한 번
#   2. 15분 넘게 계속 안 살아남 → Slack 에 "직접 확인 필요" 한 번
#   3. 다시 살아남 → Slack 에 "복구, 멈춘 시간 N분" (RSS 가장 짧은 보관 시간 약 1.4시간 안이면 손실 거의 없음)
#   4. 엔진은 살아 있는데 수집기 컨테이너(ai)가 안 돌면 → Slack 에 알림만 (사람이 일부러 멈췄을 수 있어서 켜지 않음)
# 못 하는 일: PC 자체가 꺼지거나 잠들면 이 감시도 멈춤 → 그건 바깥 서비스(healthchecks.io 등)나 클라우드가 필요
#
# 실행: powershell -NoProfile -ExecutionPolicy Bypass -File ai\ops\docker-watchdog.ps1 [-DryRun]
#   -DryRun: Slack 에 안 보내고 Docker 도 안 켬, 할 일만 화면에 출력
# 5분마다 자동 실행 등록·해제 방법은 ai/docs/수집-장애-대응.md "Docker 감시" 절

param([switch]$DryRun)

$ErrorActionPreference = "Stop"
$Repo = Resolve-Path (Join-Path $PSScriptRoot "..\..")
$StateDir = if ($env:HK_WATCHDOG_DIR) { $env:HK_WATCHDOG_DIR } else { Join-Path $env:LOCALAPPDATA "hk-stocknews" }  # 시험할 때는 다른 폴더
$StateFile = Join-Path $StateDir "docker-watchdog.json"
$LogFile = Join-Path $StateDir "docker-watchdog.log"
$DockerExe = "C:\Program Files\Docker\Docker\Docker Desktop.exe"
$Collector = "stock-news-matching-ai-1"
$GiveUpMinutes = 15
New-Item -ItemType Directory -Force -Path $StateDir | Out-Null

function Log($msg) {
    $line = "{0} {1}" -f (Get-Date -Format "yyyy-MM-dd HH:mm:ss"), $msg
    Write-Output $line
    Add-Content -Path $LogFile -Value $line -Encoding UTF8
}

function Read-Env($name) {
    $envFile = Join-Path $Repo ".env"
    if (-not (Test-Path $envFile)) { return $null }
    foreach ($l in Get-Content $envFile -Encoding UTF8) {
        if ($l -match "^\s*$name\s*=\s*(.*)\s*$") { return $Matches[1].Trim('"', "'", " ") }
    }
    return $null
}

function Send-Slack($text) {
    if ($DryRun) { Log "[DryRun] Slack: $text"; return }
    $url = Read-Env "SLACK_WEBHOOK_URL"
    if (-not $url) { Log "SLACK_WEBHOOK_URL 없음: 알림 못 보냄 ($text)"; return }
    $body = [Text.Encoding]::UTF8.GetBytes((@{ text = "[Docker 감시] $text" } | ConvertTo-Json -Compress))
    try {
        Invoke-RestMethod -Uri $url -Method Post -Body $body -ContentType "application/json; charset=utf-8" -TimeoutSec 15 | Out-Null
        Log "Slack 보냄: $text"
    } catch {
        Log "Slack 실패 ($($_.Exception.GetType().Name)): $text"  # 주소에 비밀값이 있어 오류 문구는 남기지 않음
    }
}

function Engine-Up {
    # docker 명령이 엔진을 기다리며 멈출 수 있어서 30초 제한
    # docker 명령이 없거나(설치·PATH 문제, 켜지는 중) 오류를 내면 "응답 없음"으로 봄. 오류로 감시가 멈추면 알림을 못 보냄
    # (2026-11-11 시험에서 확인: ErrorActionPreference=Stop 이라 Receive-Job 이 오류를 다시 던져 스크립트가 끝났음)
    try {
        $job = Start-Job { try { & docker info --format "{{.ServerVersion}}" 2>$null; $LASTEXITCODE } catch { 1 } }
        if (-not (Wait-Job $job -Timeout 30)) { Stop-Job $job; Remove-Job $job -Force; return $false }
        $out = Receive-Job $job -ErrorAction SilentlyContinue; Remove-Job $job -Force
        return ($out -and $out[-1] -eq 0)
    } catch { return $false }
}

$state = @{ down_since = $null; alerted_down = $false; alerted_giveup = $false; alerted_collector = $false }
if (Test-Path $StateFile) {
    $saved = Get-Content $StateFile -Raw -Encoding UTF8 | ConvertFrom-Json
    foreach ($k in @("down_since", "alerted_down", "alerted_giveup", "alerted_collector")) { $state[$k] = $saved.$k }
}
$now = Get-Date

if (Engine-Up) {
    if ($state.down_since) {
        $mins = [int](($now - [datetime]$state.down_since).TotalMinutes)
        Send-Slack ("복구: Docker 가 다시 응답함. 멈춘 시간 약 {0}분 ({1}부터). RSS 가장 짧은 보관 시간(약 84분)보다 짧으면 놓친 기사는 거의 없음" -f $mins, ([datetime]$state.down_since).ToString("MM-dd HH:mm"))
        $state.down_since = $null; $state.alerted_down = $false; $state.alerted_giveup = $false
    }
    $running = & docker ps --filter "name=^$Collector$" --filter "status=running" -q 2>$null
    if (-not $running) {
        if (-not $state.alerted_collector) { Send-Slack "수집기 컨테이너($Collector)가 돌고 있지 않음. 일부러 멈춘 게 아니면: docker compose up -d"; $state.alerted_collector = $true }
    } else {
        if ($state.alerted_collector) { Log "수집기 다시 돎" }
        $state.alerted_collector = $false
    }
    Log "정상"
} else {
    if (-not $state.down_since) { $state.down_since = $now.ToString("o") }
    $since = [datetime]$state.down_since
    $desktop = Get-Process -Name "Docker Desktop" -ErrorAction SilentlyContinue
    if (-not $desktop) {
        if ($DryRun) { Log "[DryRun] Docker Desktop 켜기" }
        elseif (Test-Path $DockerExe) { Start-Process $DockerExe; Log "Docker Desktop 다시 켬" }
        else { Log "Docker Desktop 실행 파일 없음: $DockerExe" }
    }
    if (-not $state.alerted_down) {
        Send-Slack ("꺼짐 감지 ({0}). 수집 멈춤. Docker Desktop 을 다시 켜는 중 (켜지면 수집기는 자동으로 다시 돎)" -f $since.ToString("MM-dd HH:mm"))
        $state.alerted_down = $true
    } elseif (-not $state.alerted_giveup -and ($now - $since).TotalMinutes -ge $GiveUpMinutes) {
        Send-Slack ("{0}분 넘게 안 살아남. PC 에서 Docker Desktop 을 직접 확인해 주세요" -f $GiveUpMinutes)
        $state.alerted_giveup = $true
    }
    Log ("엔진 응답 없음 ({0}부터)" -f $since.ToString("HH:mm"))
}

# DryRun 은 진짜 상태를 안 바꿈. 시험 폴더(HK_WATCHDOG_DIR)를 줬을 때만 저장해서 "꺼짐 → 복구" 순서를 시험할 수 있게
if (-not $DryRun -or $env:HK_WATCHDOG_DIR) { $state | ConvertTo-Json | Set-Content -Path $StateFile -Encoding UTF8 }

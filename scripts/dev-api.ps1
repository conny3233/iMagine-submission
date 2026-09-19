# API 개발 서버 실행 — 반드시 레포 루트에서 uvicorn 을 띄운다 (api 패키지 import 를 위해)
$ErrorActionPreference = "Stop"
$root = Split-Path $PSScriptRoot -Parent
Set-Location $root

$py = Join-Path $root ".venv\Scripts\python.exe"
if (-not (Test-Path $py)) {
    Write-Error "venv 가 없습니다. 먼저 실행:  py -3 -m venv .venv;  .\.venv\Scripts\python.exe -m pip install -r requirements.txt"
    exit 1
}

& $py -m uvicorn api.main:app --reload --host 127.0.0.1 --port 8000

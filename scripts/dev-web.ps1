# 프론트엔드 개발 서버 실행 (Vite, http://localhost:5173)
$ErrorActionPreference = "Stop"
$root = Split-Path $PSScriptRoot -Parent
Set-Location (Join-Path $root "web")

if (-not (Test-Path "node_modules")) {
    Write-Host "node_modules 가 없습니다. npm install 실행..." -ForegroundColor Yellow
    npm install
}

if (-not (Test-Path ".env.local")) {
    Write-Host ".env.local 이 없어 .env.example 을 복사합니다." -ForegroundColor Yellow
    Copy-Item ".env.example" ".env.local"
}

npm run dev

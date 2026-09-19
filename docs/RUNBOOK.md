# 런북

클론부터 실행·배포까지. 처음 세팅하는 팀원은 [README](../README.md) → 이 문서 순서로.

> **⚠️ 일부 낡았습니다 (2026-09-18 기준).**
> 배포 주소·시연 데이터 절차·체인 설정은 최신입니다. 다만 **API(FastAPI) 관련 장(2·4장 일부)은 이전 주제(상권분석) 기준**입니다 —
> 지금 두 앱은 서버 없이 동작하고 API 는 쓰지 않습니다. 계획은 [0918-team-plan.md](../0918-team-plan.md) 를 따릅니다.

## 배포 주소

| | URL | 비고 |
|---|---|---|
| 앱 ① iM Docent | https://i-magine-yzla.vercel.app/consent.html | 설치 없음 (은행 앱 안의 화면) · `?product=isa-discretionary\|ssdam-loan` 으로 상품 지정 |
| 앱 ② iMprint | https://i-magine-yzla.vercel.app/vault.html | PWA — 아이폰은 **Safari** 공유 → 홈 화면에 추가 (Chrome 은 설치 메뉴 없음) |
| 컨트랙트 | [0x83c8…BAEe](https://sepolia.etherscan.io/address/0x83c8B1AF7A0D215Bcd9c744F16Bf05B9AFCBBAEe) | Sepolia · `ConsentRegistry` |
| API (Render) | (미배포) | 이번 제품 범위 밖 — 앱은 서버 없이 동작한다 |

Vercel 설정은 Root Directory = `web`. 푸시하면 자동 배포된다.

## 시연 데이터 만드는 순서 (새 문서 추가할 때)

```powershell
# 1. 원문 PDF 를 data/raw/documents/<문서id>/원문.pdf 로 둔다
py scripts/render-pdf-pages.py <문서id> v1      # 쪽 이미지 → web/public/documents/
py scripts/locate-clauses.py <문서id> v1        # 글자층 있는 PDF: 핵심조항 좌표
py scripts/locate-clauses-scan.py <문서id> v1 --preview   # 스캔본: 영역 지정 후 좌표 (clause-ranges.json)
# 2. data/documents/<문서id>/v1.json(조항·content) · data/content/<문서id>/v1.json(카드·문항) 작성
# 3. 앱 ① scenarios.ts 에 한 줄 추가
node scripts/seal-receipts.mjs <초안이름>        # data/receipts-drafts → data/receipts (해시 봉인)
cd contract; ONLY=<이름> DRY_RUN=1 npm run record:sepolia   # 점검
cd contract; ONLY=<이름> npm run record:sepolia             # 체인 기록
```

> 이미 체인에 기록된 영수증의 **문서 content 나 답변 경로를 바꾸면 해시가 달라져** 대조가 깨진다.
> 바꿔야 하면 `receiptId` 를 새로 발급한다. 조항 `marks`·`sourcePages` 는 해시 대상이 아니라 바꿔도 안전하다.

---

## 1. 로컬 실행

### 사전 조건

| 도구 | 버전 | 확인 |
|------|------|------|
| Node | 24.x | `node -v` |
| Python | 3.12+ (이 PC는 `py -3` = 3.13.7) | `py -3 --version` |

> ⚠️ 이 PC의 `python` 명령은 Microsoft Store 스텁이라 동작하지 않는다. **`py -3`** 를 쓰고, venv 생성 후에는 `.venv\Scripts\python.exe` 를 직접 호출한다.

### 백엔드 (API :8000)

```powershell
cd "C:\Users\User\Desktop\ai 블록체인"
py -3 -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
Copy-Item .env.example .env          # 값 비어 있어도 fixture 모드로 동작
.\scripts\dev-api.ps1                # http://127.0.0.1:8000/docs
```

### 프론트 (Vite :5173)

```powershell
.\scripts\dev-web.ps1                # npm install → .env.local 생성 → npm run dev
```

### 테스트

```powershell
.\.venv\Scripts\python.exe -m pytest -q          # 백엔드 + 해시 + 계약 + 교차검증 (node 필요)
cd web; npm run build; npm run lint              # 프론트 타입·빌드·린트
cd contract; npx hardhat test                    # 스마트컨트랙트 8건
```

핵심 테스트: `tests/test_canonical_hash.py` — Python 해시 == Node 해시. 이게 깨지면
프론트 [검증] 버튼이 "변경됨"을 띄운다.

### e2e 스모크 (선택, 시스템 Chrome 필요)

세 터미널: `dev-api.ps1` / `dev-web.ps1` / 아래

```powershell
cd web; npm run e2e
```

입력 → 지도 타일 → [분석하기] → 시나리오 3행 → [검증] "원본 그대로" 까지 자동 확인.

---

## 2. 환경변수 전체 목록

### `.env` (백엔드, 루트)

| 키 | 기본값 | 설명 |
|----|--------|------|
| `ANTHROPIC_API_KEY` | (없음) | console.anthropic.com. `LLM_MODE=live` 일 때만 필요 |
| `LLM_MODEL` | `claude-sonnet-5` | |
| `LLM_MODE` | `fixture` | `fixture` = 저장된 응답, `live` = 실제 API 호출 |
| `API_HOST` / `API_PORT` | `127.0.0.1` / `8000` | |
| `CORS_ORIGINS` | `http://localhost:5173,http://127.0.0.1:5173` | 배포 시 Vercel 도메인 콤마로 추가 |
| `SEPOLIA_RPC_URL` | `https://ethereum-sepolia-rpc.publicnode.com` | 배포·기록 스크립트가 쓰는 RPC |
| `DEPLOYER_PRIVATE_KEY` | (없음) | 테스트넷 전용 지갑. `cd contract; npm run wallet` 이 채운다. **커밋 절대 금지** |
| `DEPLOYER_ADDRESS` | (없음) | 위 지갑 주소 (공개 정보, 참고용) |
| `ETHERSCAN_API_KEY` | (없음) | (선택) Etherscan 소스 공개. 없으면 Sourcify 로만 공개 |
| `RECORDER_PRIVATE_KEY` | (없음) | 앱 기록 서버 지갑. **Vercel 환경변수에도 같은 값**을 넣는다(3-2). 로컬에서 기록까지 보려면 이 값을 준 채 `npm run preview`. **커밋 절대 금지** |
| `RECORDER_ADDRESS` | (없음) | 위 지갑 주소 (공개 정보) |

계약 주소는 환경변수가 아니라 `contract/deployments/sepolia.json` 에 남는다 (배포 스크립트가 쓰고, 앱이 읽는다).

### `web/.env.local` (프론트)

| 키 | 기본값 | 설명 |
|----|--------|------|
| `VITE_API_BASE_URL` | `http://127.0.0.1:8000` | 배포 시 Render API 주소 |
| `VITE_SEPOLIA_RPC_URL` | publicnode Sepolia | 읽기 전용 대조용. CORS 허용 RPC 여야 한다 |
| `VITE_ALLOW_LOCAL_CHAIN` | (없음) | `1` 이면 로컬 hardhat 노드(31337) 기록도 믿는다. 개발용 |


---

## 3. 배포

### 3-1. Render (API) — 사용자(U3)

`render.yaml` Blueprint 가 레포에 있다.

1. render.com → **New → Blueprint** → `conny3233/iMagine` 선택
2. `render.yaml` 자동 인식 → `consent-receipt-api` 서비스 생성
3. **Environment** 탭에서 `sync: false` 항목 직접 입력:
   - `CORS_ORIGINS` = Vercel 도메인 (아래 3-2 먼저 하거나, 나중에 추가 후 재배포)
   - `ANTHROPIC_API_KEY` = (있으면. 없으면 fixture 모드 유지)
   - 블록체인 키들은 B5 이후
4. 첫 배포 후 URL 확인 (Render 가 발급한 주소)
5. `<API URL>/health` 가 200 인지 확인

Blueprint 대신 수동 생성 시:
- Root Directory: 비움
- Build: `pip install -r requirements.txt`
- Start: `uvicorn api.main:app --host 0.0.0.0 --port $PORT`

### 3-2. Vercel (프론트) — 사용자(U2)

`web/` 은 `consent.html`·`vault.html` 두 페이지를 함께 빌드한다 (vite.config.ts 의
`build.rollupOptions.input`). 하나의 Vercel 프로젝트로 배포하면 둘 다 같은 도메인 아래에 놓인다.

1. vercel.com → **Add New → Project** → `conny3233/iMagine` import
2. **Root Directory = `web`** ← 빠뜨리면 빌드 실패
3. Framework Preset: **Vite** (자동 감지) — Build Command·Output Directory 는 `web/vercel.json` 이 지정
4. **Environment Variables**:
   - `VITE_API_BASE_URL` = 3-1 에서 확인한 API URL
   - `RECORDER_PRIVATE_KEY` = 루트 `.env` 의 같은 이름 값 — **앱 ①에서 받은 영수증을 블록체인에 적는 열쇠**.
     없으면 앱은 그대로 뜨지만 완료 화면에 "아직 적지 못했어요"가 나온다. Production·Preview 둘 다 체크.
     배포 지갑(`DEPLOYER_`)과 다른 지갑이다 — 새도 이 지갑 잔액(0.01 ETH)만 잃는다.
   - (선택) `SEPOLIA_RPC_URL` = 기록 서버가 쓸 RPC. 없으면 publicnode
   - 환경변수를 바꾼 뒤에는 **Redeploy** 해야 함수가 새 값을 읽는다.
   - 확인: `<도메인>/api/record` 를 열어 `"ready":true` 와 `"issuer":"0x7aFa…"` 이 보이면 끝.
5. Deploy → Vercel 이 발급한 도메인 확인
6. 이 도메인을 Render 의 `CORS_ORIGINS` 에 추가하고 Render 재배포
7. **`<도메인>/vault.html` 을 폰으로 열어 실제로 설치되는지 확인** — 이게 시연 영상 장면 4·5·6의 전제조건이다.
   - Android/Chrome: 주소창 오른쪽 설치 아이콘 또는 메뉴의 "앱 설치"
   - iOS/Safari: 공유 → "홈 화면에 추가" (Safari 는 `beforeinstallprompt` 없이 이 경로로만 설치됨)
   - 설치 후 아이콘을 눌러 주소창 없이 전체 화면으로 뜨는지, 오프라인(비행기 모드)에서 이미 본 화면이 다시 열리는지 확인
8. **`<도메인>/consent.html` 에는 설치 유도가 없어야 한다** — 있다면 `vault-sw.js` 의 scope 가 넓어진 것이니
   [`src/vault/registerSW.ts`](../web/src/vault/registerSW.ts) 의 `scope: "/vault.html"` 을 확인한다.

임시 아이콘([`web/scripts/gen-icons.mjs`](../web/scripts/gen-icons.mjs) 생성)을 D 의 디자인으로
바꿀 땐 `web/public/vault/icons/` 의 같은 파일명에 덮어쓰면 된다 — manifest 수정이 필요 없다.

### 3-3. 스마트컨트랙트 배포와 영수증 기록 (Sepolia)

**원칙** — 화면은 서명하지 않는다. 기록은 두 길이다.
- 앱 ①에서 방금 끝난 동의·거부: **기록 서버** `web/api/record.js` (Vercel 함수, `RECORDER_PRIVATE_KEY`) — 2026-09-18 부터.
  서버는 영수증 모양·문서 지문(앱의 두 문서만)·결정 시각(15분 안)을 보고, 지문을 직접 다시 계산해 적는다. 화면은 공개 RPC 로 블록만 확인한다.
- 미리 적어 둘 영수증(`data/receipts/`): 아래 **기록 스크립트** (`DEPLOYER_PRIVATE_KEY`).

기록 서버 지갑 잔액 확인: `https://sepolia.etherscan.io/address/0x7aFa76B704ACa2e351c31181D63b18d37fD4354B` —
기록 1건에 약 0.0002 ETH. 모자라면 배포 지갑에서 보내 준다.

**① 지갑** — 이미 만들었으면 건너뛴다. 개인키는 화면에 출력되지 않고 루트 `.env` 에만 저장된다.

```powershell
cd contract
npm run wallet            # 주소만 출력. 이미 있으면 새로 만들지 않는다
```

**② 테스트 ETH 받기 — 사람이 해야 한다 (로그인·캡차)**. 필요한 양은 약 0.002 ETH (배포 1회 + 기록 수 건).
아래 중 하나에 `.env` 의 `DEPLOYER_ADDRESS` 를 넣는다.

| faucet | 조건 |
|---|---|
| [Google Cloud Web3 Faucet](https://cloud.google.com/application/web3/faucet/ethereum/sepolia) | Google 로그인. 가장 간단 |
| [Sepolia PoW Faucet](https://sepolia-faucet.pk910.de/) | 로그인 없음. 브라우저에서 몇 분 채굴 |
| [Alchemy](https://www.alchemy.com/faucets/ethereum-sepolia) · [Infura](https://www.infura.io/faucet/sepolia) | 계정 필요. 메인넷 잔액을 요구할 수 있음 |

```powershell
npm run balance:sepolia   # "✔ 충분합니다" 가 나오면 다음
```

**③ 배포 → 소스 공개 → 기록**

```powershell
npm run deploy:sepolia    # deployments/sepolia.json 생성 → 이 파일은 커밋한다 (앱이 읽음)
npm run verify:sepolia    # Sourcify (+ ETHERSCAN_API_KEY 있으면 Etherscan) 소스 공개
npm run record:sepolia    # data/receipts/*.json 을 기록하고 각 파일에 chainAttachment 를 채움
```

- `record-receipts.js` 는 payload 를 다시 해시해서 `recordHash` 와 같을 때만 보낸다. 다르면 중단.
- 같은 영수증을 다시 실행해도 안전하다 (체인에 같은 해시로 있으면 거래 정보만 채우고 건너뜀).
- 점검만: `$env:DRY_RUN="1"; npm run record:sepolia` · 일부만: `$env:ONLY="privacy"`.
- Etherscan 에서 `https://sepolia.etherscan.io/address/<계약주소>` → Events 탭에 `ConsentRecorded` 가 보이면 끝.

**로컬에서 전 과정 점검 (faucet 없이)**

```powershell
# 터미널1
cd contract; npx hardhat node
# 터미널2 — 원본 영수증에 로컬 기록이 섞이지 않게 사본 폴더에 기록한다
cd contract
npx hardhat run scripts/deploy.js --network localhost
Copy-Item -Recurse ..\data\receipts ..\tmp-receipts
$env:RECEIPTS_DIR="tmp-receipts"; npx hardhat run scripts/record-receipts.js --network localhost
```

### API 엔드포인트 (배포 후 확인용)

| 메서드 | 경로 | 용도 |
|--------|------|------|
| GET | `/health` | 상태 + 서비스 버전 |
| POST | `/chat` | SSE 스트림 — **자리표시자**, 도메인 로직 없음 |
| GET | `/docs` | Swagger UI |

상권분석 엔드포인트(`/events`·`/analyze`·`/record`)는 주제 전환으로 삭제했습니다.
새 엔드포인트는 0918-team-plan.md §10(시작·답변·재확인·최종 선택·영수증 조회)에 따라 추가합니다.

### 3-4. 순환 의존 해결 순서

CORS(Render는 Vercel 도메인 필요) ↔ API 주소(Vercel은 Render URL 필요) 가 서로 물려 있다.

```
1) Render 먼저 배포 (CORS_ORIGINS 는 일단 localhost 만) → API URL 확보
2) Vercel 배포 (VITE_API_BASE_URL = 그 API URL) → Vercel 도메인 확보
3) Render 의 CORS_ORIGINS 에 Vercel 도메인 추가 → Render 재배포(Manual Deploy)
4) Vercel URL 을 휴대폰(다른 네트워크)에서 열어 분석 요청 성공 확인
```

---

## 4. 시연 전 체크리스트

발표·시연·영상 녹화 **직전** 마다:

- [ ] **Render 깨우기** — `curl <API URL>/health` 를 미리 1회. 무료 티어는 15분 유휴 후 잠들고 첫 요청에 ~50초 걸린다.
- [ ] `LLM_MODE` 확인 — 시연은 `fixture` 권장 (네트워크·크레딧 비의존). `live` 라면 크레딧 잔액 확인.
- [ ] 계약 주소 — `contract/deployments/sepolia.json` 이 커밋돼 있고, 촬영할 영수증 파일마다 `chainAttachment` 가 채워졌는지.
- [ ] 기록 서버 — `<도메인>/api/record` 가 `"ready":true`, 기록 지갑 잔액이 0.002 ETH 이상인지.
- [ ] Vercel URL 을 발표용 노트북 + 백업 기기 양쪽에서 열어본다.
- [ ] [검증] 버튼이 "원본 그대로" 를 띄우는지 (해시 교차검증).
- [ ] 백업 3분 영상 파일 위치 확인 (배포가 시연 중 죽을 때).

---

## 5. 자주 나오는 문제

| 증상 | 원인 | 해결 |
|------|------|------|
| 배포 API 첫 요청이 50초 | Render 무료 콜드스타트 | 시연 전 미리 깨우기 (§4) |
| 브라우저 콘솔 CORS 오류 | `CORS_ORIGINS` 에 Vercel 도메인 없음 | Render Environment 에 추가 → 재배포 |
| Vercel 빌드 실패 | Root Directory 가 `web` 아님 | 프로젝트 Settings → Root Directory = `web` |
| `ModuleNotFoundError: api` | 레포 루트 아닌 곳에서 uvicorn | Start Command 가 `uvicorn api.main:app` 인지, rootDir 비었는지 |
| `python --version` 빈 줄 | Store 스텁 | `py -3` |
| [검증] 항상 "변경됨" | float 직렬화 불일치 | `npm test`(web) / `pytest tests/test_canonical_hash.py` |

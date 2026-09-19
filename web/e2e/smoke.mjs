// 두 앱 클릭 점검 — 0918-team-plan.md §15 점검표를 사람 대신 눌러 본다.
//
//   npm run preview  (다른 터미널)   → npm run e2e
//   npm run e2e -- --offline          → npm run build:offline 결과를 file:// 로 연다 (제출본 점검)
//   npm run e2e -- --url http://localhost:4190   → 주소 지정 (vite dev 등)
//   npm run e2e -- --shots            → e2e/shots/ 에 화면 저장
//   npm run e2e -- --record           → 앱 ①에서 받은 영수증을 진짜로 블록체인에 적고 iM Print 대조까지 본다
//                                        (Sepolia 가스를 쓴다. 기록 서버에 RECORDER_PRIVATE_KEY 가 있어야 한다)
//   기본은 기록 요청을 가로채 "서버 준비 안 됨"으로 답한다 — 점검할 때마다 가스를 쓰지 않게.
//
// 시스템 크롬을 쓴다(puppeteer-core). 크롬 경로가 다르면 CHROME 환경변수로 준다.
// 체인 대조는 인터넷이 필요하다 — 안 되면 그 항목만 건너뛰고 나머지는 계속한다.

import { existsSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import puppeteer from "puppeteer-core";

const HERE = dirname(fileURLToPath(import.meta.url));
const argv = process.argv.slice(2);
const flag = (name) => argv.includes(`--${name}`);
const value = (name, fallback) => {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 ? argv[i + 1] : fallback;
};

const OFFLINE = flag("offline");
const SHOTS = flag("shots");
const RECORD = flag("record");
const BASE = OFFLINE
  ? pathToFileURL(join(HERE, "..", "dist-offline") + "/").href
  : value("url", "http://localhost:4173").replace(/\/$/, "") + "/";

const CHROME =
  process.env.CHROME ??
  (process.platform === "win32"
    ? "C:/Program Files/Google/Chrome/Application/chrome.exe"
    : process.platform === "darwin"
      ? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
      : "/usr/bin/google-chrome");

if (OFFLINE && !existsSync(join(HERE, "..", "dist-offline", "consent.html"))) {
  throw new Error("dist-offline 이 없습니다 — 먼저 npm run build:offline 을 하세요.");
}
if (SHOTS) mkdirSync(join(HERE, "shots"), { recursive: true });

const results = [];
const check = (name, ok, detail = "") => {
  results.push({ name, ok, detail });
  console.log(`${ok ? "✔" : "✖"} ${name}${detail ? "  — " + detail : ""}`);
};

const browser = await puppeteer.launch({ executablePath: CHROME, headless: true });
const consoleErrors = [];

async function open(path, { width = 393, height = 852, context = browser } = {}) {
  const page = await context.newPage();
  if (!RECORD) {
    await page.setRequestInterception(true);
    page.on("request", (r) =>
      r.url().includes("/api/record") && r.method() !== "GET"
        ? r.respond({
            status: 503,
            contentType: "application/json",
            headers: { "access-control-allow-origin": "*" },
            body: JSON.stringify({ error: "(점검용) 기록 서버 준비 안 됨" }),
          })
        : r.continue(),
    );
  }
  await page.setViewport({ width, height, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  page.on("console", (m) => {
    // 가로챈 503 은 브라우저가 콘솔 오류로 찍는다 — 일부러 만든 것이라 뺀다.
    if (m.type() === "error" && !(!RECORD && m.text().includes("503"))) consoleErrors.push(m.text());
  });
  page.on("pageerror", (e) => consoleErrors.push(String(e)));
  page.on("dialog", (d) => d.accept());
  await page.goto(path.startsWith("http") || path.startsWith("file:") ? path : BASE + path, { waitUntil: "networkidle0" });
  return page;
}

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

function tools(page) {
  const shot = async (name) => {
    if (!SHOTS) return;
    await wait(300);
    await page.screenshot({ path: join(HERE, "shots", `${name}.png`) });
  };
  const click = async (selector, text) => {
    const ok = await page.evaluate(
      (selector, text) => {
        const el = [...document.querySelectorAll(selector)].find((e) => !text || e.textContent.includes(text));
        if (!el) return false;
        el.click();
        return true;
      },
      selector,
      text,
    );
    if (!ok) throw new Error(`누를 수 없음: ${selector} ${text ?? ""}`);
    await wait(220);
  };
  const pick = async (id) => {
    await page.evaluate((id) => {
      const el = [...document.querySelectorAll(".d-choice")].find(
        (b) => b.querySelector(".d-choice-id").textContent === id,
      );
      if (!el) throw new Error("보기 없음: " + id);
      el.click();
    }, id);
    await wait(120);
  };
  const text = () => page.evaluate(() => document.body.innerText);
  const receipt = () =>
    page.evaluate(() =>
      Object.fromEntries(
        [...document.querySelectorAll(".d-receipt dt")].map((dt) => [dt.textContent, dt.nextElementSibling.textContent]),
      ),
    );
  /** 문항을 정답으로 끝까지 푼다. wrongFirst 면 첫 개념만 일부러 틀린다. */
  const answerAll = async (answers, { wrongFirst = false } = {}) => {
    for (let i = 0; i < answers.length; i++) {
      if (wrongFirst && i === 0) {
        const wrong = ["A", "B", "C"].find((c) => c !== answers[0]);
        await pick(wrong);
        await click("button", "정답 확인");
        await click("button", "다른 문제로");
      }
      await pick(answers[i]);
      await click("button", "정답 확인");
      await click("button", i === answers.length - 1 ? "확인 마치기" : "다음 문제");
    }
  };
  return { shot, click, pick, text, receipt, answerAll };
}

// ── 1. 두 번 오답해도 끝까지 → 거부 (대출) — 뒤의 동의가 이 거부를 보관함에서 대신한다 ───────────────────────────────────────────────────
{
  const page = await open("consent.html?product=ssdam-loan");
  const { shot, click, pick, text, receipt } = tools(page);
  await click(".d-agree", "동의");
  await pick("B");
  await click("button", "정답 확인");
  const remedial = await text();
  check("오답이면 그 개념만 다시 설명한다", remedial.includes("이 부분을 다시 볼게요"));
  // 대출 1번은 오답 쇼츠 영상(web/public/shorts/ssdam-loan-L1.mp4)이 재설명 화면에서 재생된다.
  await page.waitForFunction(() => (document.querySelector(".d-shorts video")?.readyState ?? 0) >= 2, { timeout: 8000 }).catch(() => null);
  const shorts = await page.evaluate(() => {
    const v = document.querySelector(".d-shorts video");
    return v ? (v.readyState >= 2 ? "재생 준비됨" : "깨진 플레이어") : "영상 없음";
  });
  check("대출 1번 오답: 쇼츠 영상이 나온다", shorts === "재생 준비됨", shorts);
  await shot("remedial");
  await click("button", "다른 문제로");
  await pick("A");
  await click("button", "정답 확인");
  check("재확인도 오답이면 멈추지 않고 정답·근거를 보여 준다", (await text()).includes("정답은 B예요"));
  await click("button", "다음 문제");
  for (const [i, id] of ["B", "B", "C"].entries()) {
    await pick(id);
    await click("button", "정답 확인");
    await click("button", i === 2 ? "확인 마치기" : "다음 문제");
  }
  const decideText = await text();
  const canAgree = await page.evaluate(
    () => [...document.querySelectorAll(".d-choose")].some((b) => b.textContent.includes("동의함") && !b.disabled),
  );
  check(
    "끝까지 풀면 틀린 개수를 보여 주고, 동의 여부는 이용자가 고른다",
    decideText.includes("5문제 중 2문제를 틀렸어요") && canAgree,
    decideText.match(/\d+문제 중 \d+문제를 틀렸어요/)?.[0] ?? "",
  );
  await shot("decide-with-wrong");
  await click(".d-choose", "동의하지 않음");
  await wait(900);
  const r = await receipt();
  check("거부도 영수증이 나온다", (await text()).includes("동의하지 않음으로 마쳤어요") && !!r["영수증 번호"], r["결정"] ?? "");
  if (RECORD) {
    await page.waitForSelector(".d-chain-status.done", { timeout: 180_000 }).catch(() => null);
    const status = await page.evaluate(() => document.querySelector(".d-chain-status")?.textContent ?? "");
    check("거부 영수증도 블록체인에 적었어요", status.includes("적었어요"), status);
  }
  await page.close();
}

let loanReceiptId = null;
let importHref = "";

// ── 2. 대출: 원문 강조 → 쉬운 설명 → 계산 → 문항 → 동의 → 영수증 ──────────────
{
  const page = await open("consent.html?product=ssdam-loan");
  const { shot, click, text, receipt, answerAll } = tools(page);
  await click(".d-key");
  await wait(900);
  const marks = await page.evaluate(() => ({
    pages: document.querySelectorAll(".d-page").length,
    marks: document.querySelectorAll(".d-pages.key-on .d-mark").length,
    loaded: document.querySelector(".d-page img")?.naturalWidth ?? 0,
  }));
  check("대출 원문 14쪽 + 핵심조항 강조", marks.pages === 14 && marks.marks > 20 && marks.loaded > 0, JSON.stringify(marks));
  await shot("loan-original");
  await click(".d-level");
  const cards = await page.evaluate(() => document.querySelectorAll(".d-card").length);
  check("쉬운 설명 카드 9장", cards === 9, `카드 ${cards}장`);
  await page.evaluate(() => document.querySelector(".d-card[data-clause='floating-rate']").scrollIntoView({ block: "center" }));
  await wait(400);
  const calc = await page.evaluate(() => document.querySelector(".d-calc-diff dd").textContent);
  check("금리 비교 +1%p = 30만 원", calc.includes("30만"), calc);
  await shot("loan-calc");
  await click(".d-agree", "동의");
  await answerAll(["A", "B", "B", "C"]);
  await click(".d-choose", "동의함");
  await wait(900);
  const r = await receipt();
  check(
    "동의 영수증에 문항·계산이 남는다",
    r["확인 문제"]?.includes("4번 풀어 4번") && r["금리 비교(가상)"]?.includes("300,000"),
    JSON.stringify(r["금리 비교(가상)"] ?? ""),
  );
  await shot("loan-done");
  loanReceiptId = r["영수증 번호"];
  check("앱에서 받은 영수증 번호", /^rcpt_app_[0-9a-f]{16}$/.test(loanReceiptId ?? ""), loanReceiptId);
  if (RECORD) {
    await page.waitForSelector(".d-chain-status.done", { timeout: 180_000 }).catch(() => null);
    const status = await page.evaluate(() => document.querySelector(".d-chain-status")?.textContent ?? "");
    check("블록체인에 적었어요 (블록 확인)", status.includes("적었어요"), status);
  } else {
    await page.waitForSelector(".d-chain-status.failed", { timeout: 10_000 }).catch(() => null);
    const status = await page.evaluate(() => document.querySelector(".d-chain-status")?.textContent ?? "");
    check("기록 서버가 없으면 실패를 알리고 다시 적기를 준다", status.includes("다시 적기") && status.includes("iM Print에 보관"), status);
  }
  importHref = await page.evaluate(() => [...document.querySelectorAll("a")].find((a) => a.textContent.includes("iM Print에서 보기"))?.href ?? "");
  await shot("loan-recorded");
  await click(".d-agree", "확인");
  check("완료 후 메인에 '동의함'이 보인다", (await text()).includes("동의함"));
  await page.close();
}

// ── 3. ISA: 오답 → 재설명 → 재확인 정답 (기록된 rcpt_isa_0001 과 같은 길) ─────
{
  const page = await open("consent.html?product=isa-discretionary");
  const { shot, click, receipt, answerAll } = tools(page);
  await click(".d-agree", "동의");
  await answerAll(["C", "B"], { wrongFirst: true });
  await click(".d-choose", "동의함");
  await wait(900);
  const r = await receipt();
  check("ISA 영수증 = 3번 풀어 2번 맞힘 (기록된 영수증과 같은 길)", r["확인 문제"]?.includes("3번 풀어 2번"), r["확인 문제"] ?? "");
  await shot("isa-done");
  await page.close();
}

// ── 4. 큰 글씨 · 작은 화면(360×640) ────────────────────────────────────────
{
  const page = await open("consent.html?product=ssdam-loan", { width: 360, height: 640 });
  const { shot, click } = tools(page);
  await page.evaluate(() => {
    const r = document.querySelector('input[type="range"]');
    const set = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set;
    set.call(r, "4");
    r.dispatchEvent(new Event("input", { bubbles: true }));
  });
  await click(".d-level");
  await click(".d-agree", "동의");
  const overflow = await page.evaluate(() => {
    const bad = [];
    for (const el of document.querySelectorAll(".d-choice, .d-question, .d-agree, .d-card-headline, .d-calc-step")) {
      if (el.scrollWidth > el.clientWidth + 2) bad.push(el.className);
    }
    return { bad, sideways: document.documentElement.scrollWidth > document.documentElement.clientWidth };
  });
  check("큰 글씨에서도 글자·버튼이 잘리지 않는다", overflow.bad.length === 0 && !overflow.sideways, JSON.stringify(overflow));
  await shot("large-text");
  await page.close();
}

// ── 4-2. 대출 서식: 신용정보 조회 동의서 (간편대출 신청 때 함께 동의하는 서식 6종 중 하나) ──────────
{
  const page = await open("consent.html?product=credit-inquiry");
  const { shot, click, text, answerAll } = tools(page);
  await click(".d-key");
  await wait(900);
  const marks = await page.evaluate(() => document.querySelectorAll(".d-pages.key-on .d-mark").length);
  check("서식 원문 2쪽 + 핵심조항 강조", marks > 10, `강조 ${marks}줄`);
  await click(".d-level");
  const cards = await page.evaluate(() => document.querySelectorAll(".d-card").length);
  check("서식 쉬운 설명 카드 7장", cards === 7, `카드 ${cards}장`);
  await click(".d-agree", "동의");
  await answerAll(["B", "C"]);
  await click(".d-choose", "동의함");
  await wait(900);
  check("서식도 동의 영수증이 나온다", (await text()).includes("동의를 마쳤어요"));
  await shot("form-done");
  await page.close();
}

// ── 5. iM Print: 홈(알림 · 보관함) · 상세 탭 4개 · 체인 대조 ───────────────────
{
  const page = await open("vault.html");
  const { shot, text } = tools(page);
  const tiles = await page.evaluate(() => [...document.querySelectorAll(".im-tile-name")].map((e) => e.textContent));
  // 대출은 거부 → 동의 순으로 두 번 했다. 약관마다 최근 결정 하나만, 칸 하나로 보인다.
  check(
    "보관함 = 받은 영수증의 문서만 (간편대출 · ISA · 신용정보 조회 동의서)",
    tiles.length === 3 && ["쓰담쓰담 간편대출", "일임형 ISA", "신용정보 조회 동의서"].every((t) => tiles.includes(t)),
    tiles.join(" | "),
  );
  const notices = await page.evaluate(() => document.querySelectorAll(".im-notices li").length);
  check("중요 알림은 영수증에서 나온다", notices >= 1 && notices <= 4, `${notices}줄`);
  await shot("vault-home");
  if (RECORD) {
    // 대출 동의만 완료 화면에서 기다렸다 — 나머지(ISA 동의 · 거부 · 서식)도 보관함이 이어서 확인해 적혀야 한다.
    await page
      .waitForFunction(
        () => JSON.parse(localStorage.getItem("imprint.receipts.v1") ?? "[]").every((x) => x.receipt.chainAttachment),
        { timeout: 180_000 },
      )
      .catch(() => null);
    const left = await page.evaluate(() =>
      JSON.parse(localStorage.getItem("imprint.receipts.v1") ?? "[]")
        .filter((x) => !x.receipt.chainAttachment)
        .map((x) => `${x.receipt.payload.receiptId}: ${x.status} ${x.error ?? ""}`),
    );
    check("보관함 영수증 모두 블록체인에 적혔다", left.length === 0, left.join(", "));
  }
  const tab = (label) =>
    page.evaluate((label) => [...document.querySelectorAll(".im-tab")].find((e) => e.textContent.includes(label)).click(), label);
  await page.evaluate(() => [...document.querySelectorAll(".im-tile")].find((e) => e.textContent.includes("쓰담쓰담")).click());
  await wait(1500);
  const tabs = await page.evaluate(() => [...document.querySelectorAll(".im-tab")].map((e) => e.textContent));
  check("상세 탭 4개", tabs.length === 4, tabs.join(" / "));
  const receiptBody = await text();
  check("영수증에 문서·핵심조항 표와 계산 결과", receiptBody.includes("핵심조항") && receiptBody.includes("4.2% → 5.2%") && receiptBody.includes("300,000원"));
  await shot("vault-receipt");
  await tab("PDF");
  await wait(600);
  const pages = await page.evaluate(() => document.querySelectorAll(".original-pages img").length);
  check("약관 PDF 원본 탭에 원문 스캔", pages >= 14, `${pages}쪽`);
  await tab("블록체인");
  await wait(RECORD ? 7000 : 1200);
  const verifyBody = await text();
  const red = await page.evaluate(() => getComputedStyle(document.querySelector(".im-tab.on")).backgroundColor);
  check("블록체인 탭만 빨간색", red === "rgb(158, 0, 0)", red);
  if (RECORD) {
    const verdict = /원본 일치|원본 불일치|기록 없음|연결 실패|적는 중|적지 못했습니다/.exec(verifyBody)?.[0] ?? "?";
    check("블록체인 원본 검증서 '원본 일치'", verdict === "원본 일치", verdict);
  } else {
    check("기록 서버가 없으면 검증서도 '다시 적기'를 준다", verifyBody.includes("적지 못했습니다") && verifyBody.includes("다시 적기"));
  }
  await shot("vault-verify");
  await page.close();
}

// ── 6. 처음 여는 iM Print: 미리 기록한 영수증(간편대출 · ISA) 두 칸 ─────────────────────
{
  const fresh = await browser.createBrowserContext();
  const page = await open("vault.html", { context: fresh });
  const tiles = await page.evaluate(() => [...document.querySelectorAll(".im-tile-name")].map((e) => e.textContent));
  check("처음 연 iM Print 는 미리 기록한 두 영수증만", tiles.length === 2 && tiles.includes("일임형 ISA"), tiles.join(" | "));
  await page.evaluate(() => [...document.querySelectorAll(".im-tile")].find((e) => e.textContent.includes("ISA")).click());
  await page.evaluate(() => [...document.querySelectorAll(".im-tab")].find((e) => e.textContent.includes("블록체인")).click());
  await page.waitForFunction(() => /원본 일치|원본 불일치|기록 없음|연결 실패/.test(document.body.innerText), { timeout: 20_000 }).catch(() => null);
  const verdict = /원본 일치|원본 불일치|기록 없음|연결 실패/.exec(await page.evaluate(() => document.body.innerText))?.[0] ?? "?";
  if (verdict === "연결 실패" || verdict === "?") console.log("  (인터넷 없음 — 체인 대조 건너뜀)");
  else check("미리 기록한 ISA 영수증 = 원본 일치", verdict === "원본 일치", verdict);
  await fresh.close();
}

// ── 7. 다른 브라우저로 넘기기: 앱 ①의 링크만으로 영수증이 따라가고, 체인과 대조된다 ─────
{
  const fresh = await browser.createBrowserContext();
  const page = await open(importHref, { context: fresh });
  const { shot } = tools(page);
  await wait(RECORD ? 9000 : 1500);
  const body = await page.evaluate(() => document.body.innerText);
  check("링크로 연 iM Print 에 방금 영수증이 담긴다", body.includes("가계대출") && body.includes(loanReceiptId ?? "?"), loanReceiptId);
  if (RECORD) {
    const verdict = /대조 일치|내용이 다릅니다|확인 못했습니다|적는 중/.exec(body)?.[0] ?? "?";
    check("방금 적은 영수증도 블록체인 대조 '일치'", verdict === "대조 일치", verdict);
  }
  await shot("vault-imported");
  await fresh.close();
}

check("콘솔 오류 없음", consoleErrors.length === 0, consoleErrors.slice(0, 3).join(" | "));

await browser.close();
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} 통과 (${OFFLINE ? "제출본 file://" : BASE})`);
process.exit(failed.length === 0 ? 0 : 1);

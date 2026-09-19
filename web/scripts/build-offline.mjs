// 제출용 빌드 — 두 앱을 "더블클릭하면 열리는 HTML" 로 굽는다 (계획서 §19 "다른 컴퓨터에서도 열어 본다").
//
//   npm run build:offline      → web/dist-offline/{consent.html, vault.html, documents/…}
//
// 서버 없이 여는 파일이라 다음이 달라진다:
//   - 자바스크립트·CSS 는 HTML 안에 들어간다 (file:// 은 따로 있는 .js 를 못 불러온다)
//   - 원문 이미지·PDF 는 용량이 커서 파일로 두고 상대 경로로 부른다 → 폴더째 옮겨야 열린다
//   - 서비스워커·설치(PWA)는 동작하지 않는다 (브라우저가 https 나 localhost 에서만 허용)
//   - 블록체인 조회는 인터넷이 있으면 되지만, 브라우저가 file:// 요청을 막으면 "확인 못함"으로 보인다

import { cpSync, mkdirSync, readdirSync, renameSync, rmSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";

const WEB = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = join(WEB, "dist-offline");
rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });

// vite 를 .cmd 가 아니라 node 로 직접 부른다 (윈도우에서 .cmd 실행은 spawn 이 막는다)
const viteBin = join(WEB, "node_modules", "vite", "bin", "vite.js");
for (const page of ["consent", "vault"]) {
  execFileSync(process.execPath, [viteBin, "build"], {
    cwd: WEB,
    stdio: "inherit",
    env: { ...process.env, OFFLINE: "1", PAGE: page },
  });
  // 페이지마다 임시 폴더에 굽고 결과만 합친다 (공용 폴더에 vault/ 가 있어서 페이지 이름과 겹치면 안 된다)
  const built = join(OUT, `.build-${page}`);
  for (const name of readdirSync(built)) {
    const from = join(built, name);
    const to = join(OUT, name);
    if (name === `${page}.html`) renameSync(from, to);
    else cpSync(from, to, { recursive: true });
  }
  rmSync(built, { recursive: true, force: true });
}

const size = (p) =>
  readdirSync(p, { withFileTypes: true }).reduce(
    (sum, e) => sum + (e.isDirectory() ? size(join(p, e.name)) : statSync(join(p, e.name)).size),
    0,
  );
console.log(`\n✔ ${OUT}`);
for (const name of readdirSync(OUT)) {
  const p = join(OUT, name);
  const bytes = statSync(p).isDirectory() ? size(p) : statSync(p).size;
  console.log(`   ${name}${statSync(p).isDirectory() ? "/" : ""}  ${(bytes / 1024).toFixed(0)} KB`);
}
console.log("\nconsent.html 또는 vault.html 을 더블클릭하면 열립니다 (폴더째 옮기세요).");

// ⚠️ 이 스크립트는 더 이상 쓰지 않는다 (2026-09-18).
// 아래 D1/P1 시안은 피그마 확정본(빨간 박스, "05-말풍선 1" · "C-색반전 1")과 색이 달라서 폐기했다.
// 지금 산출물(public/docent.svg · public/vault.svg · public/vault/icons/*.png)은
// data/content/앱아이콘.png (피그마 확정 스크린샷) 에서 직접 잘라 넣은 것 — 이 스크립트를 다시 돌리면
// 옛 D1/P1 시안으로 되돌아가니 실행하지 말 것.
//
//   앱① : public/docent.svg                      — consent.html 탭 아이콘
//   앱② : public/vault/icons/*.png + vault.svg   — 홈 화면 설치 아이콘

import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import sharp from "sharp";

const PUBLIC = join(dirname(fileURLToPath(import.meta.url)), "..", "public");
const ICONS = join(PUBLIC, "vault", "icons");
mkdirSync(ICONS, { recursive: true });

const TEAL_GRADIENT = `
  <linearGradient id="teal" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0" stop-color="#1dd6b6"/>
    <stop offset="1" stop-color="#00998a"/>
  </linearGradient>`;

/** 앱 ① iM Docent — "iM"이 말을 건네는 말풍선. 약관을 대신 설명해 주는 안내자. 은행 로고는 쓰지 않고 글자만 그렸다. */
const DOCENT = `
  <rect width="100" height="100" fill="url(#teal)"/>
  <path d="M24 26h52a10 10 0 0 1 10 10v26a10 10 0 0 1-10 10H48L34 83V72H24a10 10 0 0 1-10-10V36a10 10 0 0 1 10-10z" fill="#fff"/>
  <circle cx="37" cy="39" r="4.6" fill="#00a18e"/>
  <rect x="33.3" y="46" width="7.4" height="17" rx="3.7" fill="#00a18e"/>
  <path d="M50 62V43.5l8.5 10 8.5-10V62" fill="none" stroke="#00a18e" stroke-width="7.4" stroke-linecap="round" stroke-linejoin="round"/>`;

/** 앱 ② iMprint — 영수증에 찍힌 지문. 앱이 말하는 "지문(해시)"과 "내가 한 동의"를 한 번에. 은행 색은 쓰지 않는다. */
const IMPRINT = `
  <rect width="100" height="100" fill="#13202e"/>
  <path d="M26 14H74V80l-4 4-4-4-4 4-4-4-4 4-4-4-4 4-4-4-4 4-4-4-4 4-4-4Z" fill="#fff"/>
  <g fill="none" stroke="#00b39e" stroke-width="3" stroke-linecap="round">
    <path d="M44 50a6 6 0 0 1 12 0v6"/>
    <path d="M38 52v-2a12 12 0 0 1 24 0v4"/>
    <path d="M33 48a17 17 0 0 1 34 0"/>
    <path d="M50 49v12"/>
    <path d="M44 56v6"/>
  </g>
  <rect x="34" y="24" width="32" height="4" rx="2" fill="#c8d0d8"/>
  <rect x="40" y="70" width="20" height="3.5" rx="1.75" fill="#c8d0d8"/>`;

/** safePad: 마스커블 아이콘은 중앙 80% 밖이 원형으로 잘려도 되게 여백을 둔다. */
function svg(art, { size = 100, safePad = 0, bg = null } = {}) {
  const inner = (size - safePad * 2) / 100;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <defs>${TEAL_GRADIENT}</defs>
  ${bg ? `<rect width="${size}" height="${size}" fill="${bg}"/>` : ""}
  <g transform="translate(${safePad} ${safePad}) scale(${inner})">${art}</g>
</svg>`;
}

writeFileSync(join(PUBLIC, "docent.svg"), svg(DOCENT));
writeFileSync(join(PUBLIC, "vault.svg"), svg(IMPRINT));
console.log("✔ docent.svg · vault.svg");

const targets = [
  { file: "icon-192.png", size: 192, safePad: 0 },
  { file: "icon-512.png", size: 512, safePad: 0 },
  { file: "icon-maskable-512.png", size: 512, safePad: 51, bg: "#13202e" },
  { file: "apple-touch-icon.png", size: 180, safePad: 14, bg: "#13202e" },
];

for (const t of targets) {
  await sharp(Buffer.from(svg(IMPRINT, t))).png().toFile(join(ICONS, t.file));
  console.log(`✔ vault/icons/${t.file}`);
}

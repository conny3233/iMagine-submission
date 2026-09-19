import { fileURLToPath, pathToFileURL } from "node:url";

import type { IncomingMessage, ServerResponse } from "node:http";

import react from "@vitejs/plugin-react";
import { type Connect, defineConfig } from "vite";
import { viteSingleFile } from "vite-plugin-singlefile";

const here = (p: string) => fileURLToPath(new URL(p, import.meta.url));

// 두 앱(consent.html · vault.html)을 한 프로젝트에서 따로 빌드한다.
// 이유: 해시·체인 코드(src/lib)를 한 벌만 유지하기 위해서다 (두 앱이 서로 다른 해시를
// 계산하면 검증 장면이 깨진다). index.html 은 로컬 개발용 안내일 뿐 배포 대상이 아니다.
// 제출용(OFFLINE=1): 자바스크립트·CSS 를 HTML 한 장에 넣어 굽는다 — 서버 없이 더블클릭으로 열린다.
// file:// 에서는 따로 있는 .js 파일을 못 불러오기 때문이다. 페이지마다 한 번씩 굽는다(PAGE=consent|vault).
// 원문 이미지·PDF 는 용량이 커서 HTML 밖에 두고 상대 경로로 부른다 (src/lib/paths.ts).
const offline = process.env.OFFLINE === "1";

// file:// 에서는 매니페스트를 읽을 수 없다(브라우저가 막는다). 설치도 어차피 안 되므로 링크를 뺀다.
const dropManifest = () => ({
  name: "drop-manifest-offline",
  transformIndexHtml: (html: string) => html.replace(/\s*<link rel="manifest"[^>]*>/, ""),
});
const page = process.env.PAGE ?? "consent";

// 로컬(npm run dev / preview)에서도 기록 서버 api/record.js 를 같은 주소로 돌린다 — Vercel 과 같은 함수.
// 기록하려면 RECORDER_PRIVATE_KEY 환경변수를 주고 띄운다. 없으면 "열쇠가 없다"(503)로 답한다.
const recordApi = () => {
  const handle: Connect.NextHandleFunction = (req, res, next) => {
    if (!req.url?.startsWith("/api/record")) return next();
    void serveRecord(req, res).catch(next);
  };
  return {
    name: "record-api-local",
    configureServer: (server: { middlewares: Connect.Server }) => void server.middlewares.use(handle),
    configurePreviewServer: (server: { middlewares: Connect.Server }) => void server.middlewares.use(handle),
  };
};

async function serveRecord(req: IncomingMessage, res: ServerResponse) {
  const api = (await import(pathToFileURL(here("api/record.js")).href)) as Record<string, (r: Request) => Response | Promise<Response>>;
  const handler = api[req.method ?? "GET"];
  const chunks: Buffer[] = [];
  for await (const c of req) chunks.push(c as Buffer);
  const headers = new Headers();
  for (const [k, v] of Object.entries(req.headers)) if (typeof v === "string") headers.set(k, v);
  const response = handler
    ? await handler(new Request("http://localhost" + req.url, {
        method: req.method,
        headers,
        body: chunks.length > 0 ? Buffer.concat(chunks) : undefined,
      }))
    : new Response(null, { status: 405 });
  res.statusCode = response.status;
  response.headers.forEach((v, k) => res.setHeader(k, v));
  res.end(Buffer.from(await response.arrayBuffer()));
}

// https://vite.dev/config/
export default defineConfig(
  offline
    ? {
        base: "./",
        plugins: [react(), viteSingleFile(), dropManifest()],
        build: {
          outDir: `dist-offline/.build-${page}`,
          emptyOutDir: true,
          copyPublicDir: page === "consent", // 공용 폴더(원문 이미지 등)는 한 번만 복사한다
          rollupOptions: { input: here(`${page}.html`) },
        },
      }
    : {
        plugins: [react(), recordApi()],
        build: {
          rollupOptions: {
            input: {
              index: here("index.html"),
              consent: here("consent.html"),
              vault: here("vault.html"),
            },
          },
        },
      },
)

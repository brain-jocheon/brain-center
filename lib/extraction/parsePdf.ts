/**
 * PDF 텍스트 추출 — 서버 전용(브라우저에서 import 금지). `pdf-parse` 2.x가 내부적으로 쓰는
 * pdfjs-dist는 자기 모듈이 로드되는 시점에 `globalThis.DOMMatrix`가 있는지 딱 한 번 확인하고,
 * 없으면 `@napi-rs/canvas`(네이티브 의존성)로 채우려 시도한다 — Vercel 서버리스 런타임에서는
 * 이 네이티브 의존성이 번들에 없어서 실패하고, DOMMatrix가 끝내 안 채워진 채로 넘어간다.
 *
 * [중요] `globalThis.DOMMatrix`를 채우는 코드는 pdf-parse를 import하기 **전에 실제로 실행**돼야
 * 한다 — ES 모듈은 import 대상을 전부 먼저 평가(evaluate)한 뒤에야 이 파일 자신의 최상단
 * 코드를 실행하므로, `import { PDFParse } from "pdf-parse"` 정적 import를 이 파일 위쪽에 그냥
 * 적어두면(코드 순서와 무관하게) pdfjs-dist의 DOMMatrix 확인이 항상 먼저 끝나버려서 폴리필이
 * 소용없어짐(실제로 이렇게 배포했다가 프로덕션에서 재현됨). 그래서 pdf-parse는 동적 import로
 * 미루고, 순수 JS DOMMatrix 폴리필(dommatrix 패키지)을 그 앞에서 먼저 확실히 실행한다.
 */
import { pathToFileURL } from "url";
import path from "path";
import type { RawExtracted } from "./types";

async function ensureDomMatrixPolyfill(): Promise<void> {
  if (typeof (globalThis as { DOMMatrix?: unknown }).DOMMatrix !== "undefined") return;
  const { default: DOMMatrixPolyfill } = await import("dommatrix");
  (globalThis as { DOMMatrix?: unknown }).DOMMatrix = DOMMatrixPolyfill;
}

/** pdfjs-dist는 "./pdf.worker.mjs"라는 상대경로로 워커 파일을 찾는데, Vercel 서버리스
 * 번들에서는 이 상대경로가 실제 파일 위치와 안 맞아 "Cannot find module"로 실패한다
 * (프로덕션에서 확인됨) — 절대경로를 직접 계산해 지정한다.
 * [주의] `createRequire(import.meta.url).resolve(...)`로 계산하면 이 파일 자신이
 * webpack에 번들링되면서 import.meta.url이 원래 소스 위치가 아닌 번들 결과물 위치를
 * 가리키게 돼 실패한다(확인됨) — 대신 `process.cwd()`를 기준으로 잡는다. Next.js 앱은
 * 로컬/Vercel 둘 다 프로젝트 루트(= node_modules가 있는 위치)에서 실행되므로 안정적이다.
 * [주의] 문자열 리터럴 `require.resolve("pdfjs-dist/...")`를 그대로 쓰면 webpack이
 * 정적 분석해서 순수 ESM 파일을 직접 번들링하려다 빌드가 깨짐(확인됨) — 그래서 require
 * 자체를 아예 안 쓰고 path.join으로 직접 조립한다. */
async function ensureWorkerSrc(): Promise<void> {
  const { PDFParse } = await import("pdf-parse");
  const workerPath = path.join(process.cwd(), "node_modules", "pdfjs-dist", "legacy", "build", "pdf.worker.mjs");
  // [주의] Node의 동적 import()는 절대경로를 그대로 받지 않고 file:// URL을 요구함
  // (Windows에서 "C:\..." 형태를 그대로 넘기면 프로토콜 오류로 실패 — 로컬에서 확인됨).
  PDFParse.setWorker(pathToFileURL(workerPath).href);
}

export async function parsePdfBuffer(buffer: Buffer): Promise<RawExtracted> {
  await ensureDomMatrixPolyfill();
  await ensureWorkerSrc();
  const { PDFParse } = await import("pdf-parse");
  const parser = new PDFParse({ data: buffer });
  try {
    const result = await parser.getText();
    return { type: "pdf", text: result.text, pageCount: result.total };
  } finally {
    await parser.destroy();
  }
}

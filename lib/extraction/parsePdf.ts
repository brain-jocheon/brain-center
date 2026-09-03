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
import type { RawExtracted } from "./types";

async function ensureDomMatrixPolyfill(): Promise<void> {
  if (typeof (globalThis as { DOMMatrix?: unknown }).DOMMatrix !== "undefined") return;
  const { default: DOMMatrixPolyfill } = await import("dommatrix");
  (globalThis as { DOMMatrix?: unknown }).DOMMatrix = DOMMatrixPolyfill;
}

export async function parsePdfBuffer(buffer: Buffer): Promise<RawExtracted> {
  await ensureDomMatrixPolyfill();
  const { PDFParse } = await import("pdf-parse");
  const parser = new PDFParse({ data: buffer });
  try {
    const result = await parser.getText();
    return { type: "pdf", text: result.text, pageCount: result.total };
  } finally {
    await parser.destroy();
  }
}

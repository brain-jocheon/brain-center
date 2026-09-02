/**
 * PDF 텍스트 추출 — 서버 전용(브라우저에서 import 금지). `pdf-parse` 2.x가 내부적으로 쓰는
 * pdfjs-dist는 텍스트만 뽑을 때도 브라우저 전용 전역 `DOMMatrix`를 참조한다. 로컬에선
 * pdf-parse의 네이티브 캔버스 의존성(@napi-rs/canvas)이 이를 대신 채워주지만, Vercel
 * 서버리스 런타임에서는 그 네이티브 의존성이 로드에 실패해(플랫폼 바이너리 번들링 문제로
 * 추정) "DOMMatrix is not defined"로 실제로 죽는 걸 프로덕션에서 확인함 — 순수 JS
 * 폴리필(dommatrix 패키지)을 직접 전역에 채워 네이티브 의존성 없이도 동작하게 함.
 */
import DOMMatrixPolyfill from "dommatrix";
import { PDFParse } from "pdf-parse";
import type { RawExtracted } from "./types";

if (typeof (globalThis as { DOMMatrix?: unknown }).DOMMatrix === "undefined") {
  (globalThis as { DOMMatrix?: unknown }).DOMMatrix = DOMMatrixPolyfill;
}

export async function parsePdfBuffer(buffer: Buffer): Promise<RawExtracted> {
  const parser = new PDFParse({ data: buffer });
  try {
    const result = await parser.getText();
    return { type: "pdf", text: result.text, pageCount: result.total };
  } finally {
    await parser.destroy();
  }
}

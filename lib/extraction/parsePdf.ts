/**
 * PDF 텍스트 추출 — 서버 전용(브라우저에서 import 금지). `pdf-parse` 2.x의 `PDFParse` 클래스는
 * 텍스트만 뽑을 때는 이미지 렌더링용 네이티브 의존성(@napi-rs/canvas)을 건드리지 않는다
 * (그 패키지 내부적으로 try/catch로 지연 로드 — getText()만 쓰면 영향 없음, 확인 완료).
 */
import { PDFParse } from "pdf-parse";
import type { RawExtracted } from "./types";

export async function parsePdfBuffer(buffer: Buffer): Promise<RawExtracted> {
  const parser = new PDFParse({ data: buffer });
  try {
    const result = await parser.getText();
    return { type: "pdf", text: result.text, pageCount: result.total };
  } finally {
    await parser.destroy();
  }
}

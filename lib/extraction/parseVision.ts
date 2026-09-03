/**
 * 이미지/스캔PDF 인식 — 서버 전용. Claude Vision에 파일 바이트를 직접 보내고 결과를 받아온다
 * (로컬 렌더링 없음 — 11단계에서 겪은 @napi-rs/canvas 네이티브 의존성 문제를 다시 안 밟음).
 */
import { extractViaVision } from "../ai/anthropicProvider";
import type { RawExtracted } from "./types";

const IMAGE_MEDIA_TYPE: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
};

export type VisionParseResult =
  | { status: "ok"; rawExtracted: RawExtracted }
  | { status: "error"; message: string }
  | { status: "not_configured" };

export async function parseViaVision(buffer: Buffer, ext: string): Promise<VisionParseResult> {
  const normalizedExt = ext.toLowerCase();
  const isPdf = normalizedExt === "pdf";
  const mediaType = isPdf ? "application/pdf" : IMAGE_MEDIA_TYPE[normalizedExt];
  if (!mediaType) {
    return { status: "error", message: `지원하지 않는 파일 형식입니다. (${ext})` };
  }

  const result = await extractViaVision({
    base64: buffer.toString("base64"),
    mediaType,
    kind: isPdf ? "pdf" : "image",
  });

  if (result.status !== "ok") return result;

  return {
    status: "ok",
    rawExtracted: { type: "vision", text: result.text, candidates: result.candidates, model: result.model },
  };
}

/**
 * 검사파일 추출 진입점 — 확장자로 PDF/스프레드시트/이미지 파서에 분기. 서버 전용.
 * [12단계] 이미지 확장자는 무조건 Vision(대안이 없음), PDF는 기본 텍스트 추출이지만
 * mode:"vision"을 주면 강제로 Vision 경로로 보냄(텍스트 레이어 없는 스캔본 재시도용).
 */
import { parsePdfBuffer } from "./parsePdf";
import { parseSpreadsheetBuffer } from "./parseSpreadsheet";
import { parseViaVision } from "./parseVision";
import { deriveCandidateIndicators, scoreConfidence } from "./heuristics";
import type { ExtractionResult } from "./types";

const SPREADSHEET_EXTS = new Set(["xlsx", "xls", "csv"]);
const IMAGE_EXTS = new Set(["jpg", "jpeg", "png", "webp"]);

export async function extractFromFile(
  buffer: Buffer,
  ext: string,
  opts?: { mode?: "vision" }
): Promise<ExtractionResult> {
  const normalizedExt = ext.toLowerCase();

  if (IMAGE_EXTS.has(normalizedExt) || (normalizedExt === "pdf" && opts?.mode === "vision")) {
    const visionResult = await parseViaVision(buffer, normalizedExt);
    if (visionResult.status !== "ok") return visionResult;
    const candidateCount = deriveCandidateIndicators(visionResult.rawExtracted).length;
    return { status: "ok", rawExtracted: visionResult.rawExtracted, confidence: scoreConfidence(candidateCount) };
  }

  try {
    const rawExtracted =
      normalizedExt === "pdf"
        ? await parsePdfBuffer(buffer)
        : SPREADSHEET_EXTS.has(normalizedExt)
        ? parseSpreadsheetBuffer(buffer, normalizedExt)
        : null;

    if (!rawExtracted) {
      return { status: "error", message: `지원하지 않는 파일 형식입니다. (${ext})` };
    }

    const candidateCount = deriveCandidateIndicators(rawExtracted).length;
    return { status: "ok", rawExtracted, confidence: scoreConfidence(candidateCount) };
  } catch (e) {
    console.error("[extraction] extractFromFile failed:", e);
    const message = e instanceof Error ? e.message : "알 수 없는 오류";
    return { status: "error", message: `파일을 읽는 중 문제가 발생했습니다: ${message}` };
  }
}

export { deriveCandidateIndicators, scoreConfidence, textContainsName } from "./heuristics";
export type { RawExtracted, ExtractionResult, ExtractionConfidence, CandidateIndicator } from "./types";

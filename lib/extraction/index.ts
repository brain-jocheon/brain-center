/**
 * 검사파일 추출 진입점 — 확장자로 PDF/스프레드시트 파서에 분기. 서버 전용.
 */
import { parsePdfBuffer } from "./parsePdf";
import { parseSpreadsheetBuffer } from "./parseSpreadsheet";
import { deriveCandidateIndicators, scoreConfidence } from "./heuristics";
import type { ExtractionResult } from "./types";

const SPREADSHEET_EXTS = new Set(["xlsx", "xls", "csv"]);

export async function extractFromFile(buffer: Buffer, ext: string): Promise<ExtractionResult> {
  try {
    const normalizedExt = ext.toLowerCase();
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
    const message = e instanceof Error ? e.message : "알 수 없는 오류";
    return { status: "error", message: `파일을 읽는 중 문제가 발생했습니다: ${message}` };
  }
}

export { deriveCandidateIndicators, scoreConfidence, textContainsName } from "./heuristics";
export type { RawExtracted, ExtractionResult, ExtractionConfidence, CandidateIndicator } from "./types";

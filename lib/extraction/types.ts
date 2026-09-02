/**
 * 검사파일 텍스트 추출 공용 타입 — 11단계.
 */

export type RawExtracted =
  | { type: "pdf"; text: string; pageCount: number }
  | { type: "spreadsheet"; sheets: Record<string, unknown[][]> };

export type ExtractionConfidence = "none" | "low" | "high";

export type ExtractionResult =
  | { status: "ok"; rawExtracted: RawExtracted; confidence: ExtractionConfidence }
  | { status: "error"; message: string };

export interface CandidateIndicator {
  label: string;
  value: string;
}

/**
 * 검사파일 텍스트 추출 공용 타입 — 11단계(PDF/스프레드시트), 12단계(이미지/스캔PDF).
 */

export interface CandidateIndicator {
  label: string;
  value: string;
}

export type RawExtracted =
  | { type: "pdf"; text: string; pageCount: number }
  | { type: "spreadsheet"; sheets: Record<string, unknown[][]> }
  /** [12단계] Claude Vision이 직접 읽은 결과 — candidates는 정규식 추론이 아니라 AI가 직접
   * 뽑아준 것이라 deriveCandidateIndicators()가 다시 추론하지 않고 그대로 씀 */
  | { type: "vision"; text: string; candidates: CandidateIndicator[]; model: string };

export type ExtractionConfidence = "none" | "low" | "high";

export type ExtractionResult =
  | { status: "ok"; rawExtracted: RawExtracted; confidence: ExtractionConfidence }
  | { status: "error"; message: string }
  /** [12단계] Vision 경로에서만 발생 — ANTHROPIC_API_KEY 없을 때(10/13단계와 동일한 폴백) */
  | { status: "not_configured" };

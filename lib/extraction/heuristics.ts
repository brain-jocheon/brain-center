/**
 * 검사파일에서 뽑은 원본 데이터(raw_extracted)로부터 "지표 후보(라벨/값)"를 추정하는
 * 순수 함수 모음 — 서버/클라이언트 어디서든 import 가능(I/O 없음).
 * [주의] 이건 AI/ML이 아니라 아주 단순한 규칙(콜론/탭/공백 구분 + 값에 숫자 포함) 기반
 * 추정일 뿐이라, 후보가 틀리거나 놓칠 수 있다는 전제로 만들어졌다. 그래서 이 함수의 결과는
 * 절대 자동으로 indicators에 반영되지 않고, 사람이 화면에서 골라야만 반영된다.
 */
import type { RawExtracted, ExtractionConfidence, CandidateIndicator } from "./types";

const LABEL_MAX_LEN = 40;
const VALUE_MAX_LEN = 60;

function tryLine(line: string): CandidateIndicator | null {
  const trimmed = line.trim();
  if (!trimmed) return null;

  const patterns = [
    /^(.{1,40}?)\s*[:：]\s*(.+)$/, // "라벨: 값" / "라벨： 값"
    /^(.{1,40}?)\t+(.+)$/, // "라벨\t값"
    /^(.{1,40}?)\s{2,}(.+)$/, // "라벨    값" (공백 2칸 이상)
  ];

  for (const pattern of patterns) {
    const match = trimmed.match(pattern);
    if (!match) continue;
    const label = match[1].trim();
    const value = match[2].trim();
    if (!label || !value) continue;
    if (label.length > LABEL_MAX_LEN || value.length > VALUE_MAX_LEN) continue;
    if (!/\d/.test(value)) continue; // 값에 숫자가 없으면 지표가 아닐 가능성이 높음(설명 문장 등)
    return { label, value };
  }
  return null;
}

function isTextish(cell: unknown): cell is string {
  return typeof cell === "string" && cell.trim().length > 0 && cell.trim().length <= LABEL_MAX_LEN;
}

function isNumberish(cell: unknown): boolean {
  if (typeof cell === "number" && Number.isFinite(cell)) return true;
  if (typeof cell === "string") {
    const trimmed = cell.trim();
    return trimmed !== "" && /\d/.test(trimmed) && trimmed.length <= VALUE_MAX_LEN;
  }
  return false;
}

function candidatesFromRow(row: unknown[]): CandidateIndicator[] {
  const found: CandidateIndicator[] = [];
  for (let i = 0; i < row.length - 1; i++) {
    const label = row[i];
    const value = row[i + 1];
    if (isTextish(label) && isNumberish(value)) {
      found.push({ label: label.trim(), value: String(value).trim() });
    }
  }
  return found;
}

export function deriveCandidateIndicators(rawExtracted: RawExtracted | null | undefined): CandidateIndicator[] {
  if (!rawExtracted) return [];

  if (rawExtracted.type === "pdf") {
    const lines = rawExtracted.text.split(/\r?\n/);
    const candidates: CandidateIndicator[] = [];
    for (const line of lines) {
      const candidate = tryLine(line);
      if (candidate) candidates.push(candidate);
    }
    return candidates;
  }

  if (rawExtracted.type === "spreadsheet") {
    const candidates: CandidateIndicator[] = [];
    for (const rows of Object.values(rawExtracted.sheets)) {
      for (const row of rows) {
        candidates.push(...candidatesFromRow(row));
      }
    }
    return candidates;
  }

  if (rawExtracted.type === "vision") {
    // [12단계] Claude Vision이 이미 라벨/값을 직접 뽑아준 결과라 정규식 재추론을 안 함(더 정확함)
    return rawExtracted.candidates;
  }

  return [];
}

/** 단순 규칙 — 0개면 "none", 1~2개면 "low", 3개 이상이면 "high". ML 기반 확신도가 아님. */
export function scoreConfidence(candidateCount: number): ExtractionConfidence {
  if (candidateCount === 0) return "none";
  if (candidateCount <= 2) return "low";
  return "high";
}

/** 추출된 텍스트/셀 전체에서 아이 이름이 한 번도 안 나오면 다른 아이 검사지일 가능성 경고용 */
export function textContainsName(rawExtracted: RawExtracted | null | undefined, name: string): boolean {
  if (!rawExtracted || !name.trim()) return true; // 판단 불가 시 경고를 띄우지 않음(오탐 방지)
  const haystack =
    rawExtracted.type === "pdf" || rawExtracted.type === "vision"
      ? rawExtracted.text
      : Object.values(rawExtracted.sheets)
          .flat()
          .flat()
          .map((c) => String(c ?? ""))
          .join(" ");
  return haystack.includes(name.trim());
}

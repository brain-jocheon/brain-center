/**
 * Excel/CSV 텍스트 추출 — 서버 전용. `xlsx`(SheetJS)는 npm 공식 배포판에 알려진 취약점이
 * 패치 안 된 채로 남아있어 SheetJS 자체 CDN에서 패치판을 받아 설치했다(package.json 확인).
 * [주의] CSV는 바이너리 포맷이 아니라 인코딩을 스스로 알 수 없어 buffer를 그대로 넘기면
 * SheetJS가 잘못된 코드페이지로 추측해 한글이 깨진다(직접 확인됨) — UTF-8로 직접 디코딩한
 * 문자열을 넘겨야 함. xlsx/xls는 바이너리 포맷 자체에 인코딩 정보가 있어 buffer 그대로 사용.
 */
import * as XLSX from "xlsx";
import type { RawExtracted } from "./types";

export function parseSpreadsheetBuffer(buffer: Buffer, ext: string): RawExtracted {
  const workbook = ext === "csv" ? XLSX.read(buffer.toString("utf-8"), { type: "string" }) : XLSX.read(buffer, { type: "buffer" });

  const sheets: Record<string, unknown[][]> = {};
  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    sheets[sheetName] = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as unknown[][];
  }
  return { type: "spreadsheet", sheets };
}

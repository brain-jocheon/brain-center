/**
 * "수업 요일" 자유 입력 텍스트(예: "월,수", "화/목요일")에서 요일을 뽑아냅니다.
 * 정확한 형식을 강제하지 않고, 문자열에 포함된 요일 글자를 그냥 찾습니다.
 */

const WEEKDAY_CHARS = ["일", "월", "화", "수", "목", "금", "토"];

/** 0(일)~6(토) 형태의 요일 인덱스 배열 (Date.getDay()와 동일한 규칙) */
export function parseClassDays(classDay?: string): number[] {
  if (!classDay) return [];
  const found = new Set<number>();
  for (let i = 0; i < WEEKDAY_CHARS.length; i++) {
    if (classDay.includes(WEEKDAY_CHARS[i])) found.add(i);
  }
  return Array.from(found).sort();
}

/** 형제자매 색 구분용 — 자기 자신은 항상 sage, 그 외는 순서대로 고정 배정 */
export const CHILD_DOT_COLORS = ["bg-sage-600", "bg-sky-500", "bg-amber-500", "bg-violet-500", "bg-rose-500"] as const;

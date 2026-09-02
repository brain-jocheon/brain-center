/**
 * AI 서비스 계층 공용 타입 — 10단계.
 * [설계] 업체(Anthropic 등)에 종속되지 않는 입출력 모양만 정의. 실제 호출은 anthropicProvider.ts가 담당.
 */

export interface ClassRecordDraftInput {
  childName: string;
  activityName: string;
  activityType: string;
  classDate: string;
  lessonGoal?: string;
  participation?: string;
  strengthsNote?: string;
  difficultiesNote?: string;
  teacherMemo: string;
  /** 9단계 child_traits.ai_include_fields로 화이트리스트된 항목만 "라벨: 값" 형태로 합친 텍스트 */
  traitsContext?: string;
}

export type ClassRecordDraftResult =
  | { status: "not_configured" }
  | { status: "error"; message: string }
  | { status: "ok"; detail: string; parent: string; guidance: string; model: string; tokensUsed?: number };

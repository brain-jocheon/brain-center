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

/** 13단계 — AI 검사해석 입력. 템플릿(eeg_test_templates) 매칭 결과까지 포함해서 넘김 */
export interface EegInterpretationIndicator {
  label: string;
  value: string;
  normalRangeMin?: number;
  normalRangeMax?: number;
  /** 'none'이면 이 지표는 좋다/나쁘다 판단 근거가 없다는 뜻 — AI에게도 그렇게 명시해서 넘김 */
  direction: "higher_better" | "lower_better" | "none";
  aiInstruction?: string;
}

export interface EegInterpretationInput {
  childName: string;
  testType: string;
  testName?: string;
  indicators: EegInterpretationIndicator[];
}

export type EegInterpretationResult =
  | { status: "not_configured" }
  | { status: "error"; message: string }
  | {
      status: "ok";
      summary: string;
      strengths: string;
      attentionAreas: string;
      parentSummary: string;
      model: string;
      tokensUsed?: number;
    };

/** 16단계 — 수업기록(15단계 단계형 관찰지표+내부메모) 기반 학부모 코멘트 5분할 초안.
 * BQ2/다원재능 검사 결과는 이번 단계에서 의도적으로 포함하지 않음(다음 단계로 분리). */
export interface ParentCommentDraftInput {
  childName: string;
  activityName: string;
  activityType: string;
  classDate: string;
  participationLevel?: number;
  concentrationLevel?: number;
  understandingLevel?: number;
  emotionalStateLevel?: number;
  interactionLevel?: number;
  strengthsNote?: string;
  difficultiesNote?: string;
  specialNote?: string;
  nextSessionGoal?: string;
  /** 최근 3~5회 수업기록을 짧게 요약한 텍스트(선택) */
  recentSessionsContext?: string;
  /** 현재 이용 중인 프로그램(children.serviceType, 선택) */
  programContext?: string;
}

export type ParentCommentDraftResult =
  | { status: "not_configured" }
  | { status: "error"; message: string }
  | {
      status: "ok";
      activitySummary: string;
      positiveMoment: string;
      observedChange: string;
      nextGoal: string;
      homeTip: string;
      model: string;
      tokensUsed?: number;
    };

/** 12단계 — 이미지/스캔PDF를 Claude Vision으로 직접 읽음(로컬 렌더링 없음) */
export interface VisionExtractionInput {
  base64: string;
  mediaType: string;
  /** "image"면 image 콘텐츠 블록, "pdf"면 document 콘텐츠 블록으로 전송 */
  kind: "image" | "pdf";
}

export type VisionExtractionResult =
  | { status: "not_configured" }
  | { status: "error"; message: string }
  | {
      status: "ok";
      text: string;
      candidates: { label: string; value: string }[];
      model: string;
      tokensUsed?: number;
    };

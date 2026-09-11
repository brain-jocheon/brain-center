/**
 * AI 기능 공통 진입점 — 센터 기능(API 라우트 등)은 항상 이 파일에서만 import하고,
 * 구체적인 Provider 파일(anthropicProvider.ts)을 직접 가리키지 않습니다.
 *
 * [설계] 지금은 재수출(re-export)만 하는 얇은 계층입니다 — 기존 함수 이름/시그니처/동작은
 * 전혀 바뀌지 않았습니다. 나중에 다른 업체(OpenAI 등)를 추가할 때, 같은 함수 이름으로
 * 구현한 lib/ai/openaiProvider.ts를 만들고 여기서 내보내는 대상만 바꾸면 됩니다
 * (예: 환경변수 AI_PROVIDER로 분기) — API 라우트 쪽은 전혀 안 건드립니다.
 *
 * 센터 기능 → lib/ai/index.ts → Provider(anthropicProvider.ts 등) → 실제 AI API
 */
export {
  generateClassRecordDraft,
  generateParentCommentDraft,
  generateEegInterpretation,
  extractViaVision,
} from "./anthropicProvider";

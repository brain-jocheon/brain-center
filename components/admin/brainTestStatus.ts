/**
 * 뇌기능검사 처리상태 라벨 — BrainTestForm/BrainTestList가 공유.
 * [주의] status는 내부 진행상황 표시 전용이며 학부모 공개 여부(is_public_to_parent)와는
 * 무관합니다 — 여기 값을 바꿔도 공개 조건에는 절대 영향 없음(lib/data.ts updateBrainTest 참고).
 */
import type { BrainTest } from "@/lib/types";

export const STATUS_LABEL: Record<NonNullable<BrainTest["status"]>, string> = {
  draft: "작성 중",
  uploaded: "파일 업로드 완료",
  extracting: "추출 중",
  needs_review: "추출값 확인 필요",
  confirmed: "수치 확인 완료",
  ai_processing: "AI 해석 생성 중",
  ai_drafted: "AI 초안 완료",
  teacher_reviewed: "선생님 검토 완료",
  pending_approval: "승인 대기",
  approved: "승인 완료",
  published: "학부모 공개됨",
  failed: "처리 실패",
};

export const STATUS_ORDER = Object.keys(STATUS_LABEL) as NonNullable<BrainTest["status"]>[];

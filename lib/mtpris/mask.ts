/**
 * [보안] 학부모용 MT-PRIS 콘텐츠 마스킹
 * ---------------------------------------------------------------------
 * generateMtprisContent()의 결과에서 상담사 전용 정보를 제거합니다.
 * - counselorAppendix (원자료 세계관/두려움/분노, 다짐 문장, 상담 질문) 전체 제거
 * - memo는 memoPublic이 아니면 이미 undefined (generate.ts에서 처리됨)
 * 이 함수를 거치지 않은 MtprisContent를 학부모 API 응답에 절대 포함하지 마세요.
 */
import type { MtprisContent } from "./types";

export type ParentMtprisContent = Omit<MtprisContent, "counselorAppendix">;

export function maskMtprisContentForParent(content: MtprisContent): ParentMtprisContent {
  const { counselorAppendix, ...rest } = content;
  return rest;
}

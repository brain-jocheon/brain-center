/**
 * MT-PRIS 콘텐츠 공통 타입
 * ---------------------------------------------------------------------
 * [기질명 기준 — 절대 변경 금지]
 * P1 개척형 · P2 지휘형 · P3 진취형
 * R1 성취형 · R2 유지형 · R3 봉사형
 * I1 절충형 · I2 혁신형 · I3 재치형
 * S1 양육형 · S2 충실형 · S3 상상형
 *
 * 금지 명칭(과거 오기): P3 구도형, I3 전달형, S2 통찰형, S3 초월형
 * → index.ts의 assertCanonicalNames()가 빌드 시점에 이 규칙을 검증합니다.
 */

export type PrisCode = "P" | "R" | "I" | "S";

export type MainCode =
  | "P1" | "P2" | "P3"
  | "R1" | "R2" | "R3"
  | "I1" | "I2" | "I3"
  | "S1" | "S2" | "S3";

export type SubCode =
  | "p1" | "p2" | "p3"
  | "r1" | "r2" | "r3"
  | "i1" | "i2" | "i3"
  | "s1" | "s2" | "s3";

export const MAIN_CODES: MainCode[] = ["P1","P2","P3","R1","R2","R3","I1","I2","I3","S1","S2","S3"];
export const SUB_CODES: SubCode[] = ["p1","p2","p3","r1","r2","r3","i1","i2","i3","s1","s2","s3"];
export const PRIS_CODES: PrisCode[] = ["P", "R", "I", "S"];

/** 기질명 기준표 — 다른 곳에서 이름을 하드코딩하지 말고 항상 이 표를 참조 */
export const CANONICAL_NAMES: Record<MainCode, string> = {
  P1: "개척형", P2: "지휘형", P3: "진취형",
  R1: "성취형", R2: "유지형", R3: "봉사형",
  I1: "절충형", I2: "혁신형", I3: "재치형",
  S1: "양육형", S2: "충실형", S3: "상상형",
};

/** 과거에 잘못 쓰인 적 있는 금지 명칭 — 콘텐츠 문자열에 나타나면 안 됨 */
export const FORBIDDEN_NAMES = ["구도형", "전달형", "통찰형", "초월형"];

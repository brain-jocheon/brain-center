/**
 * MT-PRIS 리포트의 "저장되는 값"과 "생성되는 콘텐츠"를 구분합니다.
 * ---------------------------------------------------------------------
 * - MtprisRawInput: DB(JSON)에 저장되는 유일한 값. 이것만 있으면 전체 리포트를 재생성할 수 있습니다.
 * - MtprisContent: rawInput + 콘텐츠 템플릿을 조합해 매 요청마다 만들어지는 값 (저장하지 않음).
 */
import type { MainCode, SubCode, PrisCode } from "@/lib/content/mtpris/types";

export interface MtprisScores {
  P: number; R: number; I: number; S: number;
}

/** DB에 저장되는 원본 입력값 — 문장은 저장하지 않고 이 값들로 매번 재생성 */
export interface MtprisRawInput {
  id: string;
  childId: string;
  testType: "mtpris";
  testDate: string;
  counselor: string;
  status: "draft" | "published";

  mainType: MainCode;   // 대표기능
  subType: SubCode;     // 바탕기능
  scores: MtprisScores;  // 현재성 점수 (0~100)

  /** 상담 메모 — [보안] 기본 비공개. memoPublic이 true일 때만 학부모에게 노출 */
  memo?: string;
  memoPublic: boolean;
}

/** 학부모 모바일 + 인쇄본 공용으로 쓰이는 핵심 요약 블록 */
export interface MtprisSummaryBlock {
  mainName: string;       // "P1 개척형"
  mainLabel: string;      // "순진 용맹한 개척자" (인쇄본/부록 성격 — 모바일 노출 최소화)
  subName: string;        // "p1 자랑/몰입"
  learningName: string;   // "G 놀이형 Game"
  careerTitle: string;    // "개척형"
  topEnergy: { code: PrisCode; name: string; score: number };
  headline: string;       // 대표기능+바탕기능+최고 현재성 요약 문장
}

/** 서버에서 조립하는 전체 콘텐츠 (마스킹 전) */
export interface MtprisContent {
  summary: MtprisSummaryBlock;
  scores: MtprisScores;
  scoreRows: { code: PrisCode; name: string; score: number; comment: string }[];
  /** PRIS 네 가지 에너지 설명 카드 (점수와 무관한 고정 설명) */
  prisOverview: { code: PrisCode; name: string; desc: string }[];

  /** 선천(대표기질) vs 현재(최고 현재성) 비교 해석 */
  comparison: { isSame: boolean; text: string };
  readerCurrent: string;

  /** 기질 해석 (학부모 공개용, TRAIT_BRIEF 기반) */
  trait: {
    summary: string;
    features: string[];
    psych: string[];
    one: string;
    behavior: string;
    relation: string;
    stress: string;
    growth: string;
    counsel: string;
    good: string[];
    bad: string[];
  };

  /** 바탕기능(쉼) */
  rest: {
    name: string;
    conditions: string[];
    block: string;
    coach: string;
    charge: string[];
    drain: string[];
  };

  /** 인품재능 (모바일: 이름만 / 인쇄: 설명 포함) */
  talents: {
    intro: string;
    performance: { name: string; desc: string }[];
    virtues: { name: string; desc: string; reward: string }[];
  };

  /** 학습스타일 */
  learning: {
    name: string; tone: string; summary: string;
    environment: string[]; coaching: string[]; motivation: string[]; caution: string;
    charge: string[]; drain: string[];
  };

  /** 직무적합성 (모바일: 요약만) */
  career: {
    title: string; identity: string; summary: string; fields: string[];
    strengths: string[]; roles: string[]; caution: string; growth: string;
  };

  closingQuote: string;
  memo?: string;      // memoPublic이 true일 때만 채워짐 (학부모용 조립 시)
  memoPublic: boolean;

  /** ⚠️ 상담사용 부록 전용 — 학부모 화면(모바일/인쇄)에서는 절대 사용 금지 */
  counselorAppendix: {
    mainRaw: {
      keywords: string[]; self: string[]; focus: string[]; world: string;
      vital: string; slogan: string; fear: string; desire: string; anger: string;
      strengths: string[]; risks: string[];
    };
    questions: string[];
    performancePledges: { name: string; pledges: string[] }[];
    virtuePledges: { name: string; pledges: string[] }[];
  };
}

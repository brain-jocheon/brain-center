/**
 * 추출된 mtpris-raw.json → lib/content/mtpris/*.ts 콘텐츠 파일 생성
 * 파일을 도메인별로 분리해 상담사가 문장을 쉽게 찾고 수정할 수 있게 함
 */
const fs = require('fs');
const raw = require('./mtpris-raw.json');
const DIR = '/home/claude/brain-center/lib/content/mtpris';

const j = (obj) => JSON.stringify(obj, null, 2);

function write(file, header, body) {
  fs.writeFileSync(`${DIR}/${file}`, header + '\n' + body + '\n', 'utf-8');
  console.log('wrote', file);
}

// 1. PRIS 4에너지 + 점수 해석
write('pris.ts',
`/**
 * PRIS 네 가지 에너지 설명과 현재성 점수(0~100) 해석 문장
 * - high: 70점 이상 / mid: 40~69점 / low: 39점 이하
 * 문장을 수정하려면 이 파일만 고치면 됩니다. 모든 리포트에 즉시 반영됩니다.
 */
import type { PrisCode } from "./types";

export const PRIS: Record<PrisCode, {
  name: string; color: string; desc: string;
  high: string; mid: string; low: string;
}> =`,
j(raw.PRIS) + ';');

// 2. 기질 특성 (학부모 공개용 순화본)
write('traits.ts',
`/**
 * 대표기질 12유형 특성 문장 (TRAIT_BRIEF — 학부모·아이에게 보여주는 순화본)
 * [문장 원칙] 단정·낙인 표현 금지, 강점 먼저, "~연습이 도움이 됩니다" 형태 유지
 * [기질명 기준] P1 개척형 ~ S3 상상형. index.ts의 검증을 통과해야 빌드됩니다.
 */
import type { MainCode } from "./types";

export interface TraitBrief {
  summary: string;      // 한 문단 요약
  features: string[];   // 대표기질 특성
  psych: string[];      // 심리적 특징
  one: string;          // 이해하면 좋은 한 문장
  behavior: string;     // 행동 방식
  relation: string;     // 관계 방식
  stress: string;       // 힘들 때 나타날 수 있는 모습
  growth: string;       // 성장 포인트
  counsel: string;      // 지도 안내 (부모/교사)
  growthTips?: string[];// 성장 팁 (없으면 생략)
  good: string[];       // 힘이 되는 방법
  bad: string[];        // 힘들게 하는 자극
  questions: string[];  // 스스로 생각해볼 질문 (인쇄본·상담용)
}

export const TRAIT_BRIEF: Record<MainCode, TraitBrief> =`,
j(raw.TRAIT_BRIEF) + ';');

// 3. 원자료 (상담사용 부록 전용!)
write('main-raw.ts',
`/**
 * =====================================================================
 * ⚠️ 대표기능 12유형 원자료 (MAIN + DEEP)
 * ---------------------------------------------------------------------
 * [사용 범위 제한 — 매우 중요]
 * 이 파일의 내용(세계관, 두려움, 욕망/분노 등)은 유형론 원문 언어로,
 * "상담사용 부록"에만 사용합니다.
 *  - 학부모 모바일 화면: 절대 사용 금지
 *  - 학부모에게 주는 인쇄본 본문: 사용 금지
 *  - 인쇄본 맨 뒤 "상담사용 부록" 페이지: 사용 가능
 * 학부모에게 보여줄 문장은 traits.ts(TRAIT_BRIEF)를 사용하세요.
 * =====================================================================
 */
import type { MainCode } from "./types";

export interface MainRaw {
  name: string; label: string; keywords: string[];
  self: string[]; focus: string[]; world: string; vital: string;
  slogan: string; fear: string; desire: string; anger: string;
  strengths: string[]; risks: string[];
  good: string[]; bad: string[]; questions: string[];
}

export const MAIN_RAW: Record<MainCode, MainRaw> =`,
j(raw.MAIN) + ';\n\n/** 심층 해석 (TRAIT_BRIEF에 없을 때의 예비 문장) */\nexport const DEEP: Record<MainCode, { behavior: string; relation: string; stress: string; growth: string; counsel: string }> = ' + j(raw.DEEP) + ';');

// 4. 바탕기능(쉼)
write('rest.ts',
`/**
 * 바탕기능 12유형 (p1~s3): 회복·쉼의 조건
 * REST_ENERGY: 기질군(P/R/I/S)별 충전/방전 요약
 */
import type { SubCode, PrisCode } from "./types";

export const REST: Record<SubCode, {
  name: string; keywords: string[]; conditions: string[]; block: string; coach: string;
}> =`,
j(raw.REST) + ';\n\nexport const REST_ENERGY: Record<PrisCode, { name: string; charge: string[]; drain: string[] }> = ' + j(raw.REST_ENERGY) + ';');

// 5. 학습스타일
write('learning.ts',
`/**
 * 기질별 학습스타일 (매칭 공식: P=G 놀이형, R=N 규범형, I=Q 질문형, S=C 화목형)
 * 부모 코칭·의욕을 살리는 말 등 학부모 화면의 핵심 콘텐츠
 */
import type { PrisCode } from "./types";

export const LEARNING: Record<PrisCode, {
  code: string; name: string; tone: string; summary: string;
  traits: string[]; environment: string[]; coaching: string[];
  conversation: string[]; motivation: string[]; caution: string;
}> =`,
j(raw.LEARNING) + ';');

// 6. 인품재능
write('talents.ts',
`/**
 * 인품재능: 수행능력 12개 + 덕성능력 32개 + 대표기능별 매칭표
 * pledges(나의 다짐)는 인쇄본 부록에만 사용 (모바일 제외)
 */
import type { MainCode } from "./types";

export const TALENT_INTRO = ${JSON.stringify(raw.TALENT_INTRO)};

export const PERFORMANCE: Record<string, { desc: string; pledges: string[] }> =`,
j(raw.PERFORMANCE) + ';\n\nexport const VIRTUE_DETAIL: Record<string, { desc: string; reward: string; pledges: string[] }> = ' + j(raw.VIRTUE_DETAIL) + ';\n\nexport const TALENT_MAP: Record<MainCode, { label: string; performance: string[]; virtues: string[] }> = ' + j(raw.TALENT_MAP) + ';');

// 7. 직무적합성
write('career.ts',
`/**
 * 직무적합성 12유형
 * 학부모 모바일: title/identity/summary/fields만 (미래 힌트 카드)
 * 인쇄본: 전체 사용
 */
import type { MainCode } from "./types";

export const CAREER_DETAIL: Record<MainCode, {
  title: string; identity: string; summary: string;
  strengths: string[]; roles: string[]; fields: string[];
  caution: string; growth: string;
}> =`,
j(raw.CAREER_DETAIL) + ';');

// 8. 선천 vs 현재 비교
write('comparison.ts',
`/**
 * "타고난 모습(대표기질)과 지금의 모습(현재성 최고 영역)" 비교 해석
 * 12가지 불일치 조합 + 일치 시 문장
 */
import type { PrisCode } from "./types";

export type ComparisonKey = \`\${PrisCode}>\${PrisCode}\`;

export const DIFFERENCE_MAP: Partial<Record<ComparisonKey, string>> =`,
j(raw.DIFFERENCE_MAP) + `;

/** 선천성과 현재성이 일치할 때 */
export const SAME_TYPE_TEXT = (prisName: string) =>
  prisName + "의 고유한 방식이 현재 생활에서도 비교적 자연스럽게 발현되고 있습니다. 이럴 때는 강점을 더 자신 있게 사용하되, 강점이 과해질 때의 긴장 신호와 나에게 필요한 쉼의 조건을 함께 살피면 좋습니다.";

/** 기질 해석 페이지: 선천/현재가 같을 때의 긴 해석 */
export const READER_SAME = "선천적으로 타고난 기질과 현재 드러나는 모습이 같은 방향입니다. 즉, 원래 가진 방식이 지금의 생활에서도 비교적 자연스럽게 표현되고 있다는 뜻입니다. 이 경우에는 강점을 더 자신 있게 사용하되, 같은 에너지가 지나치게 강해질 때 주변과 부딪히는 지점만 살피면 좋습니다.";

/** 기질 해석 페이지: 선천/현재가 다를 때의 긴 해석 (이름 없이 사용) */
export const readerDifferent = (nativeName: string, currentName: string) =>
  "선천적으로 타고난 대표기질은 " + nativeName + "인데, 현재 가장 많이 드러나는 모습은 " + currentName + "입니다. 이것은 잘못 변했다는 뜻이 아닙니다. 지금의 환경, 역할, 관계 안에서 적응하고 있거나 스스로를 보호하기 위해 다른 에너지를 많이 쓰고 있다는 뜻일 수 있습니다. 현재성으로 높게 나온 영역은 지금 많이 쓰고 있는 에너지이고, 대표기질은 가장 자연스럽게 돌아가고 싶어 하는 중심축입니다.";`);

// 9. 마무리 글귀
write('closing.ts',
`/**
 * 기질별 마무리 글귀 + 리포트 공통 고지문
 */
import type { MainCode } from "./types";

export const CLOSING_QUOTES: Record<MainCode, string> =`,
j(raw.CLOSING_QUOTES) + `;

export const REPORT_NOTICE =
  "이 리포트는 한 사람을 단정하기보다, 그 사람이 더 편안하게 성장할 수 있는 방향을 함께 찾기 위한 상담 자료입니다.";`);

console.log('done');

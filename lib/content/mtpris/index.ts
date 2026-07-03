/**
 * MT-PRIS 콘텐츠 통합 진입점
 * ---------------------------------------------------------------------
 * 다른 코드는 이 파일(또는 하위 파일)만 import합니다.
 * 모듈이 로드되는 시점에 기질명 검증을 자동 실행하여,
 * 잘못된 이름이 섞이면 즉시(개발 서버 기동 시) 에러로 드러나게 합니다.
 */
import {
  MAIN_CODES, CANONICAL_NAMES, FORBIDDEN_NAMES,
  type MainCode, type SubCode, type PrisCode,
} from "./types";
import { PRIS } from "./pris";
import { TRAIT_BRIEF } from "./traits";
import { MAIN_RAW, DEEP } from "./main-raw";
import { REST, REST_ENERGY } from "./rest";
import { LEARNING } from "./learning";
import { TALENT_INTRO, PERFORMANCE, VIRTUE_DETAIL, TALENT_MAP } from "./talents";
import { CAREER_DETAIL } from "./career";
import { DIFFERENCE_MAP, SAME_TYPE_TEXT, READER_SAME, readerDifferent, type ComparisonKey } from "./comparison";
import { CLOSING_QUOTES, REPORT_NOTICE } from "./closing";

/**
 * 기질명 검증
 * - MAIN_RAW.name / CAREER_DETAIL.title이 CANONICAL_NAMES와 일치하는지
 * - 콘텐츠 전체 문자열에 금지 명칭이 섞여 있지 않은지
 * 검증 실패 시 즉시 예외를 던져 잘못된 데이터로 리포트가 만들어지는 것을 막습니다.
 */
function assertCanonicalNames() {
  for (const code of MAIN_CODES) {
    const expected = CANONICAL_NAMES[code];
    if (!MAIN_RAW[code].name.includes(expected)) {
      throw new Error(`[기질명 오류] MAIN_RAW.${code}.name이 "${expected}"를 포함하지 않습니다: ${MAIN_RAW[code].name}`);
    }
    if (CAREER_DETAIL[code].title !== expected) {
      throw new Error(`[기질명 오류] CAREER_DETAIL.${code}.title이 "${expected}"가 아닙니다: ${CAREER_DETAIL[code].title}`);
    }
  }
  const blob = JSON.stringify({ MAIN_RAW, TRAIT_BRIEF, CAREER_DETAIL, CLOSING_QUOTES });
  for (const forbidden of FORBIDDEN_NAMES) {
    if (blob.includes(forbidden)) {
      throw new Error(`[기질명 오류] 금지된 명칭이 콘텐츠에 포함되어 있습니다: "${forbidden}"`);
    }
  }
}
assertCanonicalNames();

export {
  PRIS, TRAIT_BRIEF, MAIN_RAW, DEEP, REST, REST_ENERGY, LEARNING,
  TALENT_INTRO, PERFORMANCE, VIRTUE_DETAIL, TALENT_MAP, CAREER_DETAIL,
  DIFFERENCE_MAP, SAME_TYPE_TEXT, READER_SAME, readerDifferent,
  CLOSING_QUOTES, REPORT_NOTICE,
};
export { MAIN_CODES, SUB_CODES, PRIS_CODES, CANONICAL_NAMES } from "./types";
export type { MainCode, SubCode, PrisCode, ComparisonKey };

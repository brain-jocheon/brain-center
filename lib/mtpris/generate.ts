/**
 * MT-PRIS 리포트 생성 엔진
 * ---------------------------------------------------------------------
 * 입력값(rawInput) + 콘텐츠 템플릿(lib/content/mtpris) → 전체 리포트 콘텐츠
 * 저장하지 않고 조회할 때마다 생성하므로, 템플릿 문장을 고치면
 * 이미 만들어진 모든 아이의 리포트에 즉시 반영됩니다.
 */
import {
  PRIS, TRAIT_BRIEF, MAIN_RAW, REST, REST_ENERGY, LEARNING,
  TALENT_INTRO, PERFORMANCE, VIRTUE_DETAIL, TALENT_MAP, CAREER_DETAIL,
  DIFFERENCE_MAP, SAME_TYPE_TEXT, readerDifferent,
  CLOSING_QUOTES, REPORT_NOTICE,
} from "@/lib/content/mtpris";
import type { MainCode, SubCode, PrisCode } from "@/lib/content/mtpris/types";
import type { MtprisRawInput, MtprisContent, MtprisScores } from "./types";

function clampScore(v: number): number {
  if (Number.isNaN(v)) return 0;
  return Math.max(0, Math.min(100, v));
}

function scoreComment(code: PrisCode, score: number): string {
  const p = PRIS[code];
  if (score >= 70) return p.high;
  if (score >= 40) return p.mid;
  return p.low;
}

function topEnergy(scores: MtprisScores): { code: PrisCode; score: number } {
  const entries = Object.entries(scores) as [PrisCode, number][];
  return entries.sort((a, b) => b[1] - a[1])
    .map(([code, score]) => ({ code, score }))[0];
}

export function generateMtprisContent(input: MtprisRawInput): MtprisContent {
  const mainCode = input.mainType;
  const subCode = input.subType;
  const nativePris = mainCode.charAt(0) as PrisCode;
  const subPris = subCode.charAt(0).toUpperCase() as PrisCode;

  const scores: MtprisScores = {
    P: clampScore(input.scores.P),
    R: clampScore(input.scores.R),
    I: clampScore(input.scores.I),
    S: clampScore(input.scores.S),
  };

  const m = MAIN_RAW[mainCode];
  const r = REST[subCode];
  const brief = TRAIT_BRIEF[mainCode];
  const l = LEARNING[nativePris];
  const restEnergy = REST_ENERGY[subPris] ?? REST_ENERGY[nativePris];
  const career = CAREER_DETAIL[mainCode];
  const talent = TALENT_MAP[mainCode];
  const top = topEnergy(scores);

  const scoreRows = (["P", "R", "I", "S"] as PrisCode[]).map((code) => ({
    code,
    name: PRIS[code].name,
    score: scores[code],
    comment: scoreComment(code, scores[code]),
  }));

  // 선천(대표기질) vs 현재(최고 현재성) 비교
  const isSame = nativePris === top.code;
  const comparisonText = isSame
    ? SAME_TYPE_TEXT(PRIS[nativePris].name)
    : (DIFFERENCE_MAP[`${nativePris}>${top.code}`] ??
       readerDifferent(PRIS[nativePris].name, PRIS[top.code].name));

  const readerCurrent = isSame
    ? "선천적으로 타고난 기질과 현재 드러나는 모습이 같은 방향입니다. 원래 가진 방식이 지금의 생활에서도 비교적 자연스럽게 표현되고 있다는 뜻입니다. 강점을 더 자신 있게 사용하되, 같은 에너지가 지나치게 강해질 때 주변과 부딪히는 지점만 살피면 좋습니다."
    : readerDifferent(PRIS[nativePris].name, PRIS[top.code].name);

  const headline =
    `대표기능은 ${m.name}, 바탕기능은 ${r.name}입니다. ` +
    `현재성 에너지는 ${PRIS[top.code].name}이(가) ${top.score}점으로 가장 높게 나타났습니다.`;

  return {
    summary: {
      mainName: m.name,
      mainLabel: m.label,
      subName: r.name,
      learningName: l.name,
      careerTitle: career.title,
      topEnergy: { code: top.code, name: PRIS[top.code].name, score: top.score },
      headline,
    },
    scores,
    scoreRows,
    prisOverview: (["P", "R", "I", "S"] as PrisCode[]).map((code) => ({
      code, name: PRIS[code].name, desc: PRIS[code].desc,
    })),
    comparison: { isSame, text: comparisonText },
    readerCurrent,
    trait: {
      summary: brief.summary,
      features: brief.features,
      psych: brief.psych,
      one: brief.one,
      behavior: brief.behavior,
      relation: brief.relation,
      stress: brief.stress,
      growth: brief.growth,
      counsel: brief.counsel,
      good: brief.good,
      bad: brief.bad,
    },
    rest: {
      name: r.name,
      conditions: r.conditions,
      block: r.block,
      coach: r.coach,
      charge: restEnergy.charge,
      drain: restEnergy.drain,
    },
    talents: {
      intro: TALENT_INTRO,
      performance: talent.performance.map((name) => ({ name, desc: PERFORMANCE[name].desc })),
      virtues: talent.virtues.map((name) => ({
        name, desc: VIRTUE_DETAIL[name].desc, reward: VIRTUE_DETAIL[name].reward,
      })),
    },
    learning: {
      name: l.name,
      tone: l.tone,
      summary: l.summary,
      environment: l.environment,
      coaching: l.coaching,
      motivation: l.motivation,
      caution: l.caution,
      charge: restEnergy.charge,
      drain: restEnergy.drain,
    },
    career: {
      title: career.title,
      identity: career.identity,
      summary: career.summary,
      fields: career.fields,
      strengths: career.strengths,
      roles: career.roles,
      caution: career.caution,
      growth: career.growth,
    },
    closingQuote: CLOSING_QUOTES[mainCode] + " " + REPORT_NOTICE,
    memo: input.memoPublic ? input.memo : undefined,
    memoPublic: input.memoPublic,
    counselorAppendix: {
      mainRaw: {
        keywords: m.keywords, self: m.self, focus: m.focus, world: m.world,
        vital: m.vital, slogan: m.slogan, fear: m.fear, desire: m.desire, anger: m.anger,
        strengths: m.strengths, risks: m.risks,
      },
      questions: brief.questions,
      performancePledges: talent.performance.map((name) => ({ name, pledges: PERFORMANCE[name].pledges })),
      virtuePledges: talent.virtues.map((name) => ({ name, pledges: VIRTUE_DETAIL[name].pledges })),
    },
  };
}

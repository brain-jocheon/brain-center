/**
 * 파낙토스 뇌기능검사(BQ) 기준 주요 지표·뇌파 이름과 쉬운 설명.
 * ---------------------------------------------------------------------
 * [주의] 관리자가 지표를 입력할 때 자동완성으로 추천하고, 학부모 화면에서는
 * 지표 이름 옆에 이 설명을 함께 보여줍니다. 검사 파일 자체를 자동으로
 * 해석하는 것이 아니라, 상담사가 값을 직접 입력하면 이름에 맞는 설명을
 * 사전에서 찾아 붙여주는 용도입니다 (사전에 없는 이름을 넣어도 값만 표시됨).
 */

export const BRAIN_INDICATOR_DESCRIPTIONS: Record<string, string> = {
  기초율동: "뇌의 기본적인 안정 상태와 기초 뇌파 리듬을 보는 지표예요.",
  자기조절능력: "뇌가 상황에 맞게 이완, 주의집중, 각성 상태를 조절하는 능력이에요.",
  주의지수: "집중력, 주의 유지, 산만함 정도와 관련된 지표예요.",
  활성지수: "뇌의 활성 수준과 에너지 상태를 보는 지표예요.",
  정서지수: "정서적 안정감, 감정 조절 상태와 관련된 지표예요.",
  항스트레스지수: "스트레스에 대한 저항력과 긴장·피로 상태를 보는 지표예요.",
  좌우뇌균형: "좌뇌와 우뇌의 활성 균형을 확인하는 지표예요.",
  브레인지수: "여러 뇌기능 지표를 종합해 전반적인 뇌기능 상태를 보여주는 종합 지표예요.",
};

export const BRAIN_WAVE_DESCRIPTIONS: Record<string, string> = {
  델타파: "깊은 수면이나 매우 느린 뇌 활동과 관련된 뇌파예요.",
  세타파: "졸림, 멍한 상태, 공상, 주의 저하와 관련될 수 있는 뇌파예요.",
  알파파: "안정, 이완, 편안한 각성 상태와 관련된 뇌파예요.",
  SMR파: "차분한 집중, 신체적 안정, 주의 조절과 관련된 뇌파예요.",
  저베타파: "학습, 문제해결, 집중 활동과 관련된 뇌파예요.",
  고베타파: "긴장, 불안, 과각성, 스트레스 반응과 관련될 수 있는 뇌파예요.",
};

export const BRAIN_INDICATOR_LABEL_SUGGESTIONS: string[] = [
  ...Object.keys(BRAIN_INDICATOR_DESCRIPTIONS),
  ...Object.keys(BRAIN_WAVE_DESCRIPTIONS),
];

export function findBrainIndicatorDescription(label: string): string | undefined {
  return BRAIN_INDICATOR_DESCRIPTIONS[label] ?? BRAIN_WAVE_DESCRIPTIONS[label];
}

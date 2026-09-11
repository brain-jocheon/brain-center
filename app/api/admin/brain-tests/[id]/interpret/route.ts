/**
 * 뇌기능검사 AI 해석 생성 API — 13단계, 관리자 전용(뇌기능검사는 8단계부터 관리자 전용).
 * [안전] 확정된 indicators만 근거로 씀(raw_extracted는 절대 안 씀 — 미확인 데이터가 해석에
 * 섞이면 안 됨). 성공해도 parentSummary/opinion/finalInterpretation은 절대 안 건드림 — 사람이
 * 화면에서 버튼을 눌러야만 반영됨(8/11단계와 동일한 안전원칙).
 */
import { NextResponse } from "next/server";
import { isFullAdmin, getCurrentActor } from "@/lib/auth";
import { getBrainTest, getChild, getEegTestTemplatesByType, updateBrainTest, logAiGeneration, countRecentAiGenerationsByStaff, hashAiInputSummary } from "@/lib/data";
import { generateEegInterpretation } from "@/lib/ai";
import type { EegInterpretationIndicator } from "@/lib/ai/types";

const RATE_LIMIT_WINDOW_MINUTES = 60;
const RATE_LIMIT_MAX = 40;

export async function POST(_req: Request, { params }: { params: { id: string } }) {
  const actor = getCurrentActor();
  if (!isFullAdmin(actor)) {
    return NextResponse.json({ message: "권한이 없습니다." }, { status: 403 });
  }

  const test = await getBrainTest(params.id);
  if (!test) {
    return NextResponse.json({ message: "뇌기능검사를 찾을 수 없습니다." }, { status: 404 });
  }
  if (test.indicators.length === 0) {
    return NextResponse.json({ message: "확정된 지표가 없습니다. 먼저 지표를 입력해 주세요." }, { status: 400 });
  }

  const staffId = actor?.kind === "staff" ? actor.staffId : undefined;
  if (staffId) {
    const recent = await countRecentAiGenerationsByStaff(staffId, RATE_LIMIT_WINDOW_MINUTES);
    if (recent >= RATE_LIMIT_MAX) {
      return NextResponse.json({ message: "AI 요청이 너무 많습니다. 잠시 후 다시 시도해 주세요." }, { status: 429 });
    }
  }

  const child = await getChild(test.childId);
  if (!child) {
    return NextResponse.json({ message: "아이를 찾을 수 없습니다." }, { status: 404 });
  }

  let templates: Awaited<ReturnType<typeof getEegTestTemplatesByType>> = [];
  try {
    templates = test.testType ? await getEegTestTemplatesByType(test.testType) : [];
  } catch {
    // eeg_test_templates 조회 실패는 해석 자체를 막지 않음(기준 없이 진행)
  }
  const templateByLabel = new Map(templates.map((t) => [t.indicatorKey, t]));

  const indicators: EegInterpretationIndicator[] = test.indicators.map((i) => {
    const matched = templateByLabel.get(i.label);
    return {
      label: i.label,
      value: i.value,
      normalRangeMin: matched?.normalRangeMin,
      normalRangeMax: matched?.normalRangeMax,
      direction: matched?.direction ?? "none",
      aiInstruction: matched?.aiInstruction,
    };
  });

  const result = await generateEegInterpretation({
    childName: child.name,
    testType: test.testType || "미지정",
    testName: test.testName,
    indicators,
  });

  const inputSummaryHash = hashAiInputSummary([test.testType, test.testDate, String(indicators.length)]);

  if (result.status === "not_configured") {
    return NextResponse.json({ ok: false, reason: "not_configured", message: "AI 기능이 아직 설정되지 않았습니다. 직접 입력해 주세요." });
  }

  if (result.status === "error") {
    await logAiGeneration({
      feature: "eeg_interpretation",
      targetId: params.id,
      staffId,
      inputSummaryHash,
      status: "failed",
      errorMessage: result.message,
    });
    return NextResponse.json({ ok: false, reason: "error", message: result.message });
  }

  const interpretation = {
    summary: result.summary,
    strengths: result.strengths,
    attentionAreas: result.attentionAreas,
    parentSummary: result.parentSummary,
    generatedAt: new Date().toISOString(),
    model: result.model,
  };

  await updateBrainTest(params.id, { aiInterpretation: interpretation, status: "ai_drafted" });

  await logAiGeneration({
    feature: "eeg_interpretation",
    targetId: params.id,
    staffId,
    model: result.model,
    inputSummaryHash,
    status: "success",
    tokensUsed: result.tokensUsed,
  });

  return NextResponse.json({ ok: true, interpretation });
}

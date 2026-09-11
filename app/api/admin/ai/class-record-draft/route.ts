/**
 * 수업기록 AI 초안 생성 API — 10단계.
 * [보안] middleware.ts는 /api/admin/*을 보호하지 않으므로 이 세션 확인이 유일한 인증 게이트입니다.
 * [주의] 키가 없으면(lib/ai/anthropicProvider.ts) not_configured로 조용히 응답 — 에러가 아님.
 * AI 실패도 "AI가 실패했다"는 정상적으로 처리된 결과이지 서버 오류가 아니므로 200으로 응답하고,
 * 화면은 어느 경우든 수동 입력을 계속할 수 있어야 합니다.
 */
import { NextResponse } from "next/server";
import { getCurrentActor } from "@/lib/auth";
import { actorCanAccessChild, getChild, getChildTraits, logAiGeneration, countRecentAiGenerationsByStaff, hashAiInputSummary } from "@/lib/data";
import { generateClassRecordDraft } from "@/lib/ai";

const RATE_LIMIT_WINDOW_MINUTES = 60;
const RATE_LIMIT_MAX = 40;

const TRAIT_LABELS: Record<string, string> = {
  temperament: "기질",
  strengths: "강점",
  weaknesses: "보완점",
  cautions: "주의사항",
  learningStyle: "학습특성",
  emotionalBehavior: "정서행동특성",
  counselingGoal: "상담목표",
  teacherMemo: "선생님 메모",
  aiGuidanceNote: "AI 작성지침",
};

export async function POST(req: Request) {
  const actor = getCurrentActor();
  if (!actor) {
    return NextResponse.json({ message: "로그인이 필요합니다." }, { status: 401 });
  }

  const body = (await req.json().catch(() => null)) as
    | {
        childId?: string;
        activityName?: string;
        activityType?: string;
        classDate?: string;
        lessonGoal?: string;
        participation?: string;
        strengthsNote?: string;
        difficultiesNote?: string;
        teacherMemo?: string;
      }
    | null;

  const childId = body?.childId?.trim();
  const teacherMemo = body?.teacherMemo?.trim();
  if (!childId || !teacherMemo) {
    return NextResponse.json({ message: "짧은 메모를 먼저 입력해 주세요." }, { status: 400 });
  }
  if (!(await actorCanAccessChild(actor, childId))) {
    return NextResponse.json({ message: "권한이 없습니다." }, { status: 403 });
  }

  const staffId = actor.kind === "staff" ? actor.staffId : undefined;
  if (staffId) {
    const recent = await countRecentAiGenerationsByStaff(staffId, RATE_LIMIT_WINDOW_MINUTES);
    if (recent >= RATE_LIMIT_MAX) {
      return NextResponse.json({ message: "AI 초안 생성 요청이 너무 많습니다. 잠시 후 다시 시도해 주세요." }, { status: 429 });
    }
  }

  const child = await getChild(childId);
  if (!child) {
    return NextResponse.json({ message: "아이를 찾을 수 없습니다." }, { status: 404 });
  }

  let traitsContext: string | undefined;
  try {
    const traits = await getChildTraits(childId);
    if (traits && traits.aiIncludeFields.length > 0) {
      const parts = traits.aiIncludeFields
        .map((key) => {
          const value = (traits as unknown as Record<string, string | undefined>)[key];
          if (!value) return null;
          return `${TRAIT_LABELS[key] ?? key}: ${value}`;
        })
        .filter((v): v is string => v !== null);
      if (parts.length > 0) traitsContext = parts.join(", ");
    }
  } catch {
    // child_traits 조회 실패는 AI 초안 자체를 막지 않음(맥락 없이 진행)
  }

  const draftInput = {
    childName: child.name,
    activityName: body?.activityName?.trim() || "",
    activityType: body?.activityType?.trim() || "",
    classDate: body?.classDate?.trim() || "",
    lessonGoal: body?.lessonGoal?.trim() || undefined,
    participation: body?.participation?.trim() || undefined,
    strengthsNote: body?.strengthsNote?.trim() || undefined,
    difficultiesNote: body?.difficultiesNote?.trim() || undefined,
    teacherMemo,
    traitsContext,
  };

  const result = await generateClassRecordDraft(draftInput);

  const inputSummaryHash = hashAiInputSummary([
    draftInput.activityName,
    draftInput.activityType,
    draftInput.classDate,
    String(teacherMemo.length),
  ]);

  if (result.status === "not_configured") {
    return NextResponse.json({ ok: false, reason: "not_configured", message: "AI 기능이 아직 설정되지 않았습니다. 직접 입력해 주세요." });
  }

  if (result.status === "error") {
    await logAiGeneration({
      feature: "class_record",
      targetId: childId,
      staffId,
      inputSummaryHash,
      status: "failed",
      errorMessage: result.message,
    });
    return NextResponse.json({ ok: false, reason: "error", message: result.message });
  }

  await logAiGeneration({
    feature: "class_record",
    targetId: childId,
    staffId,
    model: result.model,
    inputSummaryHash,
    status: "success",
    tokensUsed: result.tokensUsed,
  });

  return NextResponse.json({
    ok: true,
    draft: { detail: result.detail, parent: result.parent, guidance: result.guidance },
    model: result.model,
  });
}

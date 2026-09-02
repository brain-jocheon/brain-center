/**
 * 뇌파훈련 세션 기록 생성 API — 담당 아동이면 선생님도 등록 가능(뇌기능검사와 다름).
 * [보안] middleware.ts는 /api/admin/*을 보호하지 않으므로 이 세션 확인이 유일한 인증 게이트입니다.
 */
import { NextResponse } from "next/server";
import { getCurrentActor } from "@/lib/auth";
import { createEegTrainingSession, actorCanAccessChild } from "@/lib/data";

export async function POST(req: Request) {
  const actor = getCurrentActor();
  if (!actor) {
    return NextResponse.json({ message: "로그인이 필요합니다." }, { status: 401 });
  }

  const body = (await req.json().catch(() => null)) as
    | {
        childId?: string;
        sessionDate?: string;
        durationMinutes?: number | string | null;
        trainingMode?: string;
        trainingStage?: string;
        equipment?: string;
        keyMetrics?: Record<string, number | string | null>;
        conditionNote?: string;
        engagementNote?: string;
        observation?: string;
        specialNote?: string;
        parentComment?: string;
        isPublicToParent?: boolean;
      }
    | null;

  const childId = body?.childId?.trim();
  const sessionDate = body?.sessionDate?.trim();
  if (!childId || !sessionDate) {
    return NextResponse.json({ message: "세션 일자를 입력해 주세요." }, { status: 400 });
  }
  if (!(await actorCanAccessChild(actor, childId))) {
    return NextResponse.json({ message: "권한이 없습니다." }, { status: 403 });
  }

  // [주의] 소요시간은 빈 값이면 null 유지 — 0으로 대체하지 않음
  const durationMinutes =
    body?.durationMinutes === "" || body?.durationMinutes === null || body?.durationMinutes === undefined
      ? null
      : Number(body.durationMinutes);

  const session = await createEegTrainingSession({
    childId,
    sessionDate,
    durationMinutes: durationMinutes !== null && Number.isFinite(durationMinutes) ? durationMinutes : null,
    trainingMode: body?.trainingMode,
    trainingStage: body?.trainingStage,
    equipment: body?.equipment,
    keyMetrics: body?.keyMetrics,
    conditionNote: body?.conditionNote,
    engagementNote: body?.engagementNote,
    observation: body?.observation,
    specialNote: body?.specialNote,
    staffId: actor.kind === "staff" ? actor.staffId : undefined,
    parentComment: body?.parentComment,
    isPublicToParent: !!body?.isPublicToParent,
  });

  return NextResponse.json({ ok: true, session });
}

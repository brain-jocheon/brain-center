/**
 * 뇌파훈련 세션 기록 수정(PATCH)/삭제(DELETE, 소프트삭제) API
 * [보안] middleware.ts는 /api/admin/*을 보호하지 않으므로 이 세션 확인이 유일한 인증 게이트입니다.
 */
import { NextResponse } from "next/server";
import { getCurrentActor } from "@/lib/auth";
import { updateEegTrainingSession, softDeleteEegTrainingSession, getEegTrainingSessionOwner, actorCanAccessChild } from "@/lib/data";

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const actor = getCurrentActor();
  if (!actor) {
    return NextResponse.json({ message: "로그인이 필요합니다." }, { status: 401 });
  }
  const childId = await getEegTrainingSessionOwner(params.id);
  if (!childId || !(await actorCanAccessChild(actor, childId))) {
    return NextResponse.json({ message: "권한이 없습니다." }, { status: 403 });
  }

  const body = (await req.json().catch(() => null)) as
    | {
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
  if (!body || Object.keys(body).length === 0) {
    return NextResponse.json({ message: "잘못된 요청입니다." }, { status: 400 });
  }

  const durationMinutes =
    body.durationMinutes === undefined
      ? undefined
      : body.durationMinutes === "" || body.durationMinutes === null
      ? null
      : Number(body.durationMinutes);

  const found = await updateEegTrainingSession(params.id, {
    sessionDate: body.sessionDate,
    durationMinutes:
      durationMinutes === undefined ? undefined : Number.isFinite(durationMinutes) ? durationMinutes : null,
    trainingMode: body.trainingMode,
    trainingStage: body.trainingStage,
    equipment: body.equipment,
    keyMetrics: body.keyMetrics,
    conditionNote: body.conditionNote,
    engagementNote: body.engagementNote,
    observation: body.observation,
    specialNote: body.specialNote,
    parentComment: body.parentComment,
    isPublicToParent: body.isPublicToParent,
  });
  if (!found) {
    return NextResponse.json({ message: "훈련기록을 찾을 수 없습니다." }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}

/** 소프트삭제 — deleted_at만 세팅, 행 자체는 남아있어 관리자 실수 삭제도 복구 가능 */
export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const actor = getCurrentActor();
  if (!actor) {
    return NextResponse.json({ message: "로그인이 필요합니다." }, { status: 401 });
  }
  const childId = await getEegTrainingSessionOwner(params.id);
  if (!childId || !(await actorCanAccessChild(actor, childId))) {
    return NextResponse.json({ message: "권한이 없습니다." }, { status: 403 });
  }

  const found = await softDeleteEegTrainingSession(params.id);
  if (!found) {
    return NextResponse.json({ message: "훈련기록을 찾을 수 없습니다." }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}

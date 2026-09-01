/**
 * 월간 성장 리포트 수정(PATCH)/삭제(DELETE, 소프트삭제) API (관리자 전용)
 * [보안] middleware.ts는 /api/admin/*을 보호하지 않으므로 이 세션 확인이 유일한 인증 게이트입니다.
 */
import { NextResponse } from "next/server";
import { getCurrentActor } from "@/lib/auth";
import { updateMonthlyReport, softDeleteMonthlyReport, getMonthlyReportOwner, actorCanAccessChild } from "@/lib/data";

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const actor = getCurrentActor();
  if (!actor) {
    return NextResponse.json({ message: "로그인이 필요합니다." }, { status: 401 });
  }
  const childId = await getMonthlyReportOwner(params.id);
  if (!childId || !(await actorCanAccessChild(actor, childId))) {
    return NextResponse.json({ message: "권한이 없습니다." }, { status: 403 });
  }

  const body = (await req.json().catch(() => null)) as
    | {
        participation?: string;
        strengths?: string;
        improvements?: string;
        homeGuidance?: string;
        nextMonthGoals?: string;
        counselor?: string;
        isPublicToParent?: boolean;
      }
    | null;
  if (!body || Object.keys(body).length === 0) {
    return NextResponse.json({ message: "잘못된 요청입니다." }, { status: 400 });
  }

  const found = await updateMonthlyReport(params.id, body);
  if (!found) {
    return NextResponse.json({ message: "리포트를 찾을 수 없습니다." }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}

/** 소프트삭제 — deleted_at만 세팅, 행 자체는 남아있어 관리자 실수 삭제도 복구 가능 */
export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const actor = getCurrentActor();
  if (!actor) {
    return NextResponse.json({ message: "로그인이 필요합니다." }, { status: 401 });
  }
  const childId = await getMonthlyReportOwner(params.id);
  if (!childId || !(await actorCanAccessChild(actor, childId))) {
    return NextResponse.json({ message: "권한이 없습니다." }, { status: 403 });
  }

  const found = await softDeleteMonthlyReport(params.id);
  if (!found) {
    return NextResponse.json({ message: "리포트를 찾을 수 없습니다." }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}

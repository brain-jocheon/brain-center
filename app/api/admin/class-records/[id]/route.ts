/**
 * 수업기록 수정(PATCH, 전체 공용 코멘트)/삭제(DELETE, 소프트삭제) API (관리자 전용)
 * [보안] middleware.ts는 /api/admin/*을 보호하지 않으므로 이 세션 확인이 유일한 인증 게이트입니다.
 */
import { NextResponse } from "next/server";
import { isAdminLoggedIn } from "@/lib/auth";
import { updateClassRecord, softDeleteClassRecord } from "@/lib/data";

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  if (!isAdminLoggedIn()) {
    return NextResponse.json({ message: "로그인이 필요합니다." }, { status: 401 });
  }

  const body = (await req.json().catch(() => null)) as { comment?: string; counselor?: string } | null;
  if (!body || Object.keys(body).length === 0) {
    return NextResponse.json({ message: "잘못된 요청입니다." }, { status: 400 });
  }

  const found = await updateClassRecord(params.id, { comment: body.comment, counselor: body.counselor });
  if (!found) {
    return NextResponse.json({ message: "수업기록을 찾을 수 없습니다." }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}

/** 소프트삭제 — deleted_at만 세팅, 행 자체는 남아있어 관리자 실수 삭제도 복구 가능 */
export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  if (!isAdminLoggedIn()) {
    return NextResponse.json({ message: "로그인이 필요합니다." }, { status: 401 });
  }

  const found = await softDeleteClassRecord(params.id);
  if (!found) {
    return NextResponse.json({ message: "수업기록을 찾을 수 없습니다." }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}

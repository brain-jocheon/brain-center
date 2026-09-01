/**
 * 학부모 전용 공지 수정(PATCH)/삭제(DELETE, 소프트삭제) API (관리자 전용)
 * [보안] middleware.ts는 /api/admin/*을 보호하지 않으므로 이 세션 확인이 유일한 인증 게이트입니다.
 */
import { NextResponse } from "next/server";
import { getCurrentActor, isFullAdmin } from "@/lib/auth";
import { updateParentNotice, softDeleteParentNotice } from "@/lib/data";
import type { ParentNoticeAdmin } from "@/lib/types";

const AUDIENCE_TYPES: ParentNoticeAdmin["audienceType"][] = ["all", "status", "program", "weekday", "child"];

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  if (!isFullAdmin(getCurrentActor())) {
    return NextResponse.json({ message: "권한이 없습니다." }, { status: 403 });
  }

  const body = (await req.json().catch(() => null)) as
    | { title?: string; body?: string; audienceType?: string; audienceValue?: string }
    | null;
  if (!body || Object.keys(body).length === 0) {
    return NextResponse.json({ message: "잘못된 요청입니다." }, { status: 400 });
  }
  if (body.audienceType !== undefined && !AUDIENCE_TYPES.includes(body.audienceType as ParentNoticeAdmin["audienceType"])) {
    return NextResponse.json({ message: "대상 유형이 올바르지 않습니다." }, { status: 400 });
  }

  const found = await updateParentNotice(params.id, {
    title: body.title?.trim(),
    body: body.body?.trim(),
    audienceType: body.audienceType as ParentNoticeAdmin["audienceType"] | undefined,
    audienceValue: body.audienceType === "all" ? "" : body.audienceValue?.trim(),
  });
  if (!found) {
    return NextResponse.json({ message: "공지를 찾을 수 없습니다." }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}

/** 소프트삭제 — deleted_at만 세팅, 행 자체는 남아있어 관리자 실수 삭제도 복구 가능 */
export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  if (!isFullAdmin(getCurrentActor())) {
    return NextResponse.json({ message: "권한이 없습니다." }, { status: 403 });
  }

  const found = await softDeleteParentNotice(params.id);
  if (!found) {
    return NextResponse.json({ message: "공지를 찾을 수 없습니다." }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}

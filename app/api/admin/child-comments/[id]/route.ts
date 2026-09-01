/**
 * 아이별 코멘트 오버라이드 수정 API (관리자 전용) — 텍스트/공개여부만
 * [보안] middleware.ts는 /api/admin/*을 보호하지 않으므로 이 세션 확인이 유일한 인증 게이트입니다.
 */
import { NextResponse } from "next/server";
import { getCurrentActor } from "@/lib/auth";
import { updateChildComment, getChildCommentOwner, actorCanAccessChild } from "@/lib/data";

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const actor = getCurrentActor();
  if (!actor) {
    return NextResponse.json({ message: "로그인이 필요합니다." }, { status: 401 });
  }
  const childId = await getChildCommentOwner(params.id);
  if (!childId || !(await actorCanAccessChild(actor, childId))) {
    return NextResponse.json({ message: "권한이 없습니다." }, { status: 403 });
  }

  const body = (await req.json().catch(() => null)) as { comment?: string; isPublicToParent?: boolean } | null;
  if (!body || Object.keys(body).length === 0) {
    return NextResponse.json({ message: "잘못된 요청입니다." }, { status: 400 });
  }

  const found = await updateChildComment(params.id, { comment: body.comment, isPublicToParent: body.isPublicToParent });
  if (!found) {
    return NextResponse.json({ message: "코멘트를 찾을 수 없습니다." }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}

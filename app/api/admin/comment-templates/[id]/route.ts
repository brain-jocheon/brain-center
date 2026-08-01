/**
 * 코멘트 템플릿 삭제 API (관리자 전용)
 * [보안] middleware.ts는 /api/admin/*을 보호하지 않으므로 이 세션 확인이 유일한 인증 게이트입니다.
 */
import { NextResponse } from "next/server";
import { isAdminLoggedIn } from "@/lib/auth";
import { deleteCommentTemplate } from "@/lib/data";

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  if (!isAdminLoggedIn()) {
    return NextResponse.json({ message: "로그인이 필요합니다." }, { status: 401 });
  }
  await deleteCommentTemplate(params.id);
  return NextResponse.json({ ok: true });
}

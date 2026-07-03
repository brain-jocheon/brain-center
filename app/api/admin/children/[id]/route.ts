/**
 * 아동 상태 변경(PATCH: 그만둠/재등록) 및 완전 삭제(DELETE) API (관리자 전용)
 * [보안] middleware.ts는 /api/admin/*을 보호하지 않으므로 이 세션 확인이 유일한 인증 게이트입니다.
 */
import { NextResponse } from "next/server";
import { isAdminLoggedIn } from "@/lib/auth";
import { deleteChild, getChild, setChildStatus } from "@/lib/data";

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  if (!isAdminLoggedIn()) {
    return NextResponse.json({ message: "로그인이 필요합니다." }, { status: 401 });
  }

  const body = (await req.json().catch(() => null)) as { status?: string } | null;
  if (body?.status !== "active" && body?.status !== "archived") {
    return NextResponse.json({ message: "잘못된 요청입니다." }, { status: 400 });
  }

  const found = await setChildStatus(params.id, body.status);
  if (!found) {
    return NextResponse.json({ message: "아동을 찾을 수 없습니다." }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  if (!isAdminLoggedIn()) {
    return NextResponse.json({ message: "로그인이 필요합니다." }, { status: 401 });
  }

  const existing = await getChild(params.id);
  if (!existing) {
    return NextResponse.json({ message: "아동을 찾을 수 없습니다." }, { status: 404 });
  }

  await deleteChild(params.id);
  return NextResponse.json({ ok: true });
}

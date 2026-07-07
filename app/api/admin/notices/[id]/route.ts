/**
 * 공지사항 수정(PATCH)/삭제(DELETE) API (관리자 전용)
 */
import { NextResponse } from "next/server";
import { isAdminLoggedIn } from "@/lib/auth";
import { updateNotice, deleteNotice } from "@/lib/data";

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  if (!isAdminLoggedIn()) {
    return NextResponse.json({ message: "로그인이 필요합니다." }, { status: 401 });
  }

  const body = (await req.json().catch(() => null)) as { title?: string; body?: string } | null;
  if (!body || Object.keys(body).length === 0) {
    return NextResponse.json({ message: "잘못된 요청입니다." }, { status: 400 });
  }

  const found = await updateNotice(params.id, {
    title: body.title?.trim(),
    body: body.body?.trim(),
  });
  if (!found) {
    return NextResponse.json({ message: "공지를 찾을 수 없습니다." }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  if (!isAdminLoggedIn()) {
    return NextResponse.json({ message: "로그인이 필요합니다." }, { status: 401 });
  }

  const found = await deleteNotice(params.id);
  if (!found) {
    return NextResponse.json({ message: "공지를 찾을 수 없습니다." }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}

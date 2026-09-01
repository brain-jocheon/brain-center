/**
 * 출결 기록 삭제 API (관리자 전용)
 */
import { NextResponse } from "next/server";
import { getCurrentActor } from "@/lib/auth";
import { deleteAttendance, getAttendanceOwner, actorCanAccessChild } from "@/lib/data";

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const actor = getCurrentActor();
  if (!actor) {
    return NextResponse.json({ message: "로그인이 필요합니다." }, { status: 401 });
  }
  const childId = await getAttendanceOwner(params.id);
  if (!childId || !(await actorCanAccessChild(actor, childId))) {
    return NextResponse.json({ message: "권한이 없습니다." }, { status: 403 });
  }

  const found = await deleteAttendance(params.id);
  if (!found) {
    return NextResponse.json({ message: "출결 기록을 찾을 수 없습니다." }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}

/**
 * 보강 희망일 요청 승인/거절 (관리자 전용)
 * 승인 시 원래 결석 기록(attendance_records)의 보강 예정일도 함께 반영됩니다.
 */
import { NextResponse } from "next/server";
import { isAdminLoggedIn } from "@/lib/auth";
import { reviewMakeupRequest } from "@/lib/data";

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  if (!isAdminLoggedIn()) {
    return NextResponse.json({ message: "로그인이 필요합니다." }, { status: 401 });
  }

  const body = (await req.json().catch(() => null)) as { decision?: string; adminMemo?: string } | null;
  if (body?.decision !== "approved" && body?.decision !== "rejected") {
    return NextResponse.json({ message: "잘못된 요청입니다." }, { status: 400 });
  }

  const result = await reviewMakeupRequest(params.id, body.decision, body.adminMemo?.trim() || undefined);
  if (!result) {
    return NextResponse.json({ message: "요청을 찾을 수 없습니다." }, { status: 404 });
  }
  return NextResponse.json({ ok: true, request: result });
}

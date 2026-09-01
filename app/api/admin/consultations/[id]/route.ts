/**
 * 상담 신청 상태 변경 · 관리자 메모 작성 (관리자 전용)
 * [보안] middleware.ts는 /api/admin/*을 보호하지 않으므로 이 세션 확인이 유일한 인증 게이트입니다.
 */
import { NextResponse } from "next/server";
import { getCurrentActor, isFullAdmin } from "@/lib/auth";
import { updateConsultation } from "@/lib/data";
import type { Consultation } from "@/lib/types";

const VALID_STATUS: Consultation["status"][] = [
  "new", "contact_scheduled", "consult_scheduled", "consult_done", "enrolled", "on_hold", "closed",
];

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  if (!isFullAdmin(getCurrentActor())) {
    return NextResponse.json({ message: "권한이 없습니다." }, { status: 403 });
  }

  const body = (await req.json().catch(() => null)) as { status?: string; adminMemo?: string } | null;
  if (!body || Object.keys(body).length === 0) {
    return NextResponse.json({ message: "잘못된 요청입니다." }, { status: 400 });
  }
  if (body.status !== undefined && !VALID_STATUS.includes(body.status as Consultation["status"])) {
    return NextResponse.json({ message: "상태 값이 올바르지 않습니다." }, { status: 400 });
  }

  const found = await updateConsultation(params.id, {
    status: body.status as Consultation["status"] | undefined,
    adminMemo: body.adminMemo,
  });
  if (!found) {
    return NextResponse.json({ message: "상담 신청을 찾을 수 없습니다." }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}

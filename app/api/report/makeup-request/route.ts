/**
 * =====================================================================
 * 보강 희망일 요청 제출 (학부모 전용)
 * ---------------------------------------------------------------------
 * POST { token, originalClassDate?, requestedDate, parentMemo? }
 * [보안] childId를 클라이언트에서 직접 받지 않고, 이미 검증된 학부모 링크
 * 토큰으로 서버가 아이를 확인합니다 — 다른 아이 이름으로 요청을 넣을 수 없음.
 * 이 요청은 승인 전까지 실제 출결(attendance_records)에 반영되지 않습니다.
 * =====================================================================
 */
import { NextResponse } from "next/server";
import { getAccessByToken, getReport, getMtprisReport, createMakeupRequest } from "@/lib/data";

export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as
    | { token?: string; originalClassDate?: string; requestedDate?: string; parentMemo?: string }
    | null;

  const token = body?.token?.trim();
  const requestedDate = body?.requestedDate?.trim();
  if (!token || !requestedDate) {
    return NextResponse.json({ message: "잘못된 요청입니다." }, { status: 400 });
  }

  const access = await getAccessByToken(token);
  if (!access) {
    return NextResponse.json({ message: "링크가 유효하지 않습니다." }, { status: 401 });
  }

  const childId =
    access.reportKind === "mtpris"
      ? (await getMtprisReport(access.reportId))?.childId
      : (await getReport(access.reportId))?.childId;
  if (!childId) {
    return NextResponse.json({ message: "아이 정보를 찾을 수 없습니다." }, { status: 404 });
  }

  const request = await createMakeupRequest({
    childId,
    originalClassDate: body?.originalClassDate?.trim() || undefined,
    requestedDate,
    parentMemo: body?.parentMemo?.trim() || undefined,
  });

  return NextResponse.json({ ok: true, request });
}

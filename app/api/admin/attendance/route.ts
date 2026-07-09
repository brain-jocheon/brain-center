/**
 * 출결 기록 생성/수정 API (관리자 전용) — 같은 (아이, 날짜)면 upsert로 덮어씀
 */
import { NextResponse } from "next/server";
import { isAdminLoggedIn } from "@/lib/auth";
import { upsertAttendance } from "@/lib/data";

export async function POST(req: Request) {
  if (!isAdminLoggedIn()) {
    return NextResponse.json({ message: "로그인이 필요합니다." }, { status: 401 });
  }

  const body = (await req.json().catch(() => null)) as
    | {
        childId?: string;
        classDate?: string;
        status?: string;
        isMakeup?: boolean;
        makeupDate?: string;
        memo?: string;
      }
    | null;

  const childId = body?.childId?.trim();
  const classDate = body?.classDate?.trim();
  if (!childId || !classDate) {
    return NextResponse.json({ message: "날짜를 입력해 주세요." }, { status: 400 });
  }
  if (body?.status !== "present" && body?.status !== "absent") {
    return NextResponse.json({ message: "출결 상태가 올바르지 않습니다." }, { status: 400 });
  }

  const record = await upsertAttendance({
    childId,
    classDate,
    status: body.status,
    isMakeup: !!body.isMakeup,
    makeupDate: body.makeupDate?.trim() || undefined,
    memo: body.memo?.trim() || undefined,
  });

  return NextResponse.json({ ok: true, record });
}

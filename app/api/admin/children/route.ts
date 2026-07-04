/**
 * 아동 등록 API (관리자 전용)
 * [보안] middleware.ts는 /api/admin/*을 보호하지 않으므로 이 세션 확인이 유일한 인증 게이트입니다.
 */
import { NextResponse } from "next/server";
import { isAdminLoggedIn } from "@/lib/auth";
import { createChild } from "@/lib/data";

export async function POST(req: Request) {
  if (!isAdminLoggedIn()) {
    return NextResponse.json({ message: "로그인이 필요합니다." }, { status: 401 });
  }

  const body = (await req.json().catch(() => null)) as
    | {
        name?: string;
        grade?: string;
        birthYear?: number;
        birthDate?: string;
        gender?: "M" | "F";
        guardianName?: string;
        guardianPhone?: string;
        serviceType?: string;
        classDay?: string;
        counselor?: string;
        memo?: string;
      }
    | null;

  const name = body?.name?.trim();
  const grade = body?.grade?.trim();
  if (!name || !grade) {
    return NextResponse.json({ message: "이름과 학년을 입력해 주세요." }, { status: 400 });
  }

  let birthYear: number | undefined;
  if (body?.birthYear !== undefined && body.birthYear !== null) {
    const y = Number(body.birthYear);
    const currentYear = new Date().getFullYear();
    if (!Number.isInteger(y) || y < 2000 || y > currentYear) {
      return NextResponse.json({ message: "출생연도가 올바르지 않습니다." }, { status: 400 });
    }
    birthYear = y;
  }

  if (body?.gender !== undefined && body.gender !== null && body.gender !== "M" && body.gender !== "F") {
    return NextResponse.json({ message: "성별 값이 올바르지 않습니다." }, { status: 400 });
  }

  const child = await createChild({
    name,
    grade,
    birthYear,
    birthDate: body?.birthDate?.trim() || undefined,
    gender: body?.gender,
    guardianName: body?.guardianName?.trim() || undefined,
    guardianPhone: body?.guardianPhone?.trim() || undefined,
    serviceType: body?.serviceType?.trim() || undefined,
    classDay: body?.classDay?.trim() || undefined,
    counselor: body?.counselor?.trim() || undefined,
    memo: body?.memo?.trim() || undefined,
  });
  return NextResponse.json({ ok: true, child });
}

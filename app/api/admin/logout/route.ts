import { NextResponse } from "next/server";
import { ADMIN_SESSION_COOKIE, STAFF_SESSION_COOKIE } from "@/lib/auth";

export async function POST() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set(ADMIN_SESSION_COOKIE, "", { path: "/", maxAge: 0 });
  // 7단계: 선생님 세션도 같은 로그아웃 버튼으로 함께 정리(둘 중 하나만 있어도 무해)
  res.cookies.set(STAFF_SESSION_COOKIE, "", { path: "/", maxAge: 0 });
  return res;
}

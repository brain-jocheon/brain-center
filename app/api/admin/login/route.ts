/**
 * 관리자 로그인 API
 * [보안]
 * - 비밀번호는 환경변수 ADMIN_PASSWORD와 비교 (코드에 하드코딩 금지!)
 * - 성공 시 HMAC 서명된 세션 쿠키 발급 (httpOnly → JS로 탈취 불가)
 * TODO(운영 전환 시): 관리자 계정 여러 개 + 개별 권한이 필요하면
 *                    Supabase Auth 등 정식 인증으로 교체
 */
import { NextResponse } from "next/server";
import { createSessionToken, safeEqual, ADMIN_SESSION_COOKIE } from "@/lib/auth";

export async function POST(req: Request) {
  const { password } = await req.json().catch(() => ({}));

  const adminPassword = process.env.ADMIN_PASSWORD;
  if (!adminPassword) {
    // [보안] 환경변수 미설정 시 로그인 자체를 막음 (기본 비밀번호로 열어두지 않음)
    return NextResponse.json(
      { message: "서버에 ADMIN_PASSWORD가 설정되지 않았습니다. .env.local을 확인하세요." },
      { status: 500 }
    );
  }

  if (typeof password !== "string" || !safeEqual(password, adminPassword)) {
    return NextResponse.json({ message: "비밀번호 오류" }, { status: 401 });
  }

  const res = NextResponse.json({ ok: true });
  res.cookies.set(ADMIN_SESSION_COOKIE, createSessionToken(), {
    httpOnly: true, // [보안] 자바스크립트에서 쿠키 접근 불가
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production", // [보안] 운영에서는 HTTPS에서만 전송
    path: "/",
    maxAge: 60 * 60 * 8, // 8시간
  });
  return res;
}

/**
 * 관리자 로그인 API
 * [보안]
 * - 비밀번호는 환경변수 ADMIN_PASSWORD와 비교 (코드에 하드코딩 금지!)
 * - 성공 시 HMAC 서명된 세션 쿠키 발급 (httpOnly → JS로 탈취 불가)
 * [14단계] 선생님 로그인(/api/staff/login)과 동일하게 IP당 10분 8회 초과 시 429,
 * 성공/실패 모두 audit_logs에 기록(공용 비밀번호라 무제한 시도가 가능했던 gap을 보완).
 * TODO(운영 전환 시): 관리자 계정 여러 개 + 개별 권한이 필요하면
 *                    Supabase Auth 등 정식 인증으로 교체
 */
import { NextResponse } from "next/server";
import { createSessionToken, safeEqual, ADMIN_SESSION_COOKIE } from "@/lib/auth";
import { logFailedAdminLogin, countRecentFailedAdminLogins, writeAuditLog } from "@/lib/data";

const RATE_LIMIT_WINDOW_MIN = 10;
const RATE_LIMIT_MAX_FAILURES = 8;

export async function POST(req: Request) {
  const { password } = await req.json().catch(() => ({}));
  const ip = req.headers.get("x-forwarded-for");

  try {
    const recentFailures = await countRecentFailedAdminLogins(ip, RATE_LIMIT_WINDOW_MIN);
    if (recentFailures >= RATE_LIMIT_MAX_FAILURES) {
      return NextResponse.json({ message: "시도가 너무 많습니다. 잠시 후 다시 시도해 주세요." }, { status: 429 });
    }
  } catch {
    // 레이트리밋 확인 실패는 로그인 자체를 막지 않음
  }

  const adminPassword = process.env.ADMIN_PASSWORD;
  if (!adminPassword) {
    // [보안] 환경변수 미설정 시 로그인 자체를 막음 (기본 비밀번호로 열어두지 않음)
    return NextResponse.json(
      { message: "서버에 ADMIN_PASSWORD가 설정되지 않았습니다. .env.local을 확인하세요." },
      { status: 500 }
    );
  }

  if (typeof password !== "string" || !safeEqual(password, adminPassword)) {
    await logFailedAdminLogin(ip);
    return NextResponse.json({ message: "비밀번호 오류" }, { status: 401 });
  }

  // [보안] createSessionToken()이 SESSION_SECRET 미설정 시 예외를 던지므로, 감사로그보다 먼저
  // 호출해 실패 시 "로그인 성공"으로 잘못 기록되지 않게 한다.
  const sessionToken = createSessionToken();
  await writeAuditLog({ actorLabel: "관리자(공용계정)", action: "admin_login_success", targetTable: "staff" });

  const res = NextResponse.json({ ok: true });
  res.cookies.set(ADMIN_SESSION_COOKIE, sessionToken, {
    httpOnly: true, // [보안] 자바스크립트에서 쿠키 접근 불가
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production", // [보안] 운영에서는 HTTPS에서만 전송
    path: "/",
    maxAge: 60 * 60 * 8, // 8시간
  });
  return res;
}

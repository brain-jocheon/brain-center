/**
 * =====================================================================
 * 선생님/스태프 로그인 API — 기존 관리자 로그인(app/api/admin/login)과 병행
 * ---------------------------------------------------------------------
 * POST { phone, password }
 * [보안] 전화번호로 staff를 조회한 뒤 bcrypt 비교. 실패 시도는 IP와 함께
 * audit_logs에 기록하고, /api/report/verify와 동일한 원리로 IP당 10분 8회
 * 초과 시 429로 차단합니다.
 * =====================================================================
 */
import { NextResponse } from "next/server";
import { createStaffSessionToken, verifyParentPassword, STAFF_SESSION_COOKIE } from "@/lib/auth";
import { getStaffByPhone, logFailedStaffLogin, countRecentFailedStaffLogins, writeAuditLog } from "@/lib/data";

const RATE_LIMIT_WINDOW_MIN = 10;
const RATE_LIMIT_MAX_FAILURES = 8;

export async function POST(req: Request) {
  const { phone, password } = await req.json().catch(() => ({}));

  if (typeof phone !== "string" || typeof password !== "string" || !phone.trim() || !password) {
    return NextResponse.json({ message: "전화번호와 비밀번호를 입력해 주세요." }, { status: 400 });
  }

  const ip = req.headers.get("x-forwarded-for");
  try {
    const recentFailures = await countRecentFailedStaffLogins(ip, RATE_LIMIT_WINDOW_MIN);
    if (recentFailures >= RATE_LIMIT_MAX_FAILURES) {
      return NextResponse.json({ message: "시도가 너무 많습니다. 잠시 후 다시 시도해 주세요." }, { status: 429 });
    }
  } catch {
    // 레이트리밋 확인 실패는 로그인 자체를 막지 않음
  }

  const staff = await getStaffByPhone(phone.trim());
  if (!staff || !staff.active || !(await verifyParentPassword(password, staff.passwordHash))) {
    await logFailedStaffLogin(ip);
    return NextResponse.json({ message: "전화번호 또는 비밀번호가 맞지 않습니다." }, { status: 401 });
  }

  // [보안] createStaffSessionToken()이 SESSION_SECRET 미설정 시 예외를 던지므로, 감사로그보다
  // 먼저 호출해 실패 시 "로그인 성공"으로 잘못 기록되지 않게 한다.
  const sessionToken = createStaffSessionToken(staff.id, staff.role);
  await writeAuditLog({
    actorStaffId: staff.id,
    actorLabel: `${staff.name}(${staff.role})`,
    action: "staff_login_success",
    targetTable: "staff",
    targetId: staff.id,
  });

  const res = NextResponse.json({ ok: true, role: staff.role });
  res.cookies.set(STAFF_SESSION_COOKIE, sessionToken, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 8,
  });
  return res;
}

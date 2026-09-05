/**
 * =====================================================================
 * [보안] 관리자 영역 보호 미들웨어
 * ---------------------------------------------------------------------
 * /admin 아래 모든 경로는 로그인 세션이 없으면 로그인 페이지로 보냅니다.
 * 세션 쿠키는 HMAC 서명되어 위조할 수 없습니다. (lib/auth.ts 참고)
 * [7단계] 기존 관리자 세션(bc_admin_session)은 그대로 두고, 선생님/스태프
 * 세션(bc_staff_session)도 같은 서명 방식으로 인정합니다. 선생님(teacher)
 * 역할이면 관리자 전용 경로는 여기서 한 번 더 막습니다(화면단 방어와 별개의
 * 이중 방어 — IDOR/권한상승 방지).
 * =====================================================================
 */
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// middleware는 Edge 런타임이므로 Web Crypto로 검증
// [주의] payload는 관리자 토큰이면 그냥 숫자(만료시각), 선생님 토큰이면
// "만료시각:staffId:role" — split(":")[0]으로 만료시각만 뽑으면 두 형식 다 통과.
async function verify(token: string | undefined, secret: string): Promise<{ payload: string } | null> {
  if (!token) return null;
  const [payload, sig] = token.split(".");
  if (!payload || !sig) return null;
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]
  );
  const mac = await crypto.subtle.sign("HMAC", key, enc.encode(payload));
  const expected = Array.from(new Uint8Array(mac))
    .map((b) => b.toString(16).padStart(2, "0")).join("");
  if (expected !== sig) return null;
  const expiresStr = payload.split(":")[0];
  if (!(Number(expiresStr) > Date.now())) return null;
  return { payload };
}

// 선생님(teacher) 역할은 접근할 수 없는 경로 — 화면단 체크와 별개인 미들웨어 레벨 이중 방어
const ADMIN_ONLY_PREFIXES = [
  "/admin/staff",
  "/admin/consultations",
  "/admin/parent-notices",
  "/admin/site",
  "/admin/blog",
  "/admin/visits",
  "/admin/feedback",
  "/admin/makeup-requests",
  "/admin/audit-logs",
  "/admin/test-templates",
];

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // 로그인 페이지와 로그인 API는 통과
  if (pathname.startsWith("/admin/login")) return NextResponse.next();

  if (pathname.startsWith("/admin")) {
    const secret = process.env.SESSION_SECRET;
    // [보안 수정] 예전엔 SESSION_SECRET이 없으면 코드에 박힌 문자열로 대체해서, 그 값을
    // 알면 누구나 세션을 위조할 수 있었음 — 이제 없으면 모든 세션을 무조건 무효 처리
    // (로그인 화면으로 안전하게 리다이렉트, 크래시 아님)하고 그 값으로는 절대 검증하지 않는다.
    if (!secret) {
      const url = req.nextUrl.clone();
      url.pathname = "/admin/login";
      return NextResponse.redirect(url);
    }
    const adminResult = await verify(req.cookies.get("bc_admin_session")?.value, secret);
    if (adminResult) return NextResponse.next(); // 기존 관리자 세션 — 동작 완전히 그대로

    const staffResult = await verify(req.cookies.get("bc_staff_session")?.value, secret);
    if (!staffResult) {
      const url = req.nextUrl.clone();
      url.pathname = "/admin/login";
      return NextResponse.redirect(url);
    }

    const [, , role] = staffResult.payload.split(":");
    if (role === "teacher" && ADMIN_ONLY_PREFIXES.some((p) => pathname.startsWith(p))) {
      const url = req.nextUrl.clone();
      url.pathname = "/admin";
      return NextResponse.redirect(url);
    }
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*"],
};

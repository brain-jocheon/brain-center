/**
 * =====================================================================
 * [보안] 관리자 영역 보호 미들웨어
 * ---------------------------------------------------------------------
 * /admin 아래 모든 경로는 로그인 세션이 없으면 로그인 페이지로 보냅니다.
 * 세션 쿠키는 HMAC 서명되어 위조할 수 없습니다. (lib/auth.ts 참고)
 * =====================================================================
 */
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// middleware는 Edge 런타임이므로 Web Crypto로 검증
async function verify(token: string | undefined, secret: string): Promise<boolean> {
  if (!token) return false;
  const [payload, sig] = token.split(".");
  if (!payload || !sig) return false;
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]
  );
  const mac = await crypto.subtle.sign("HMAC", key, enc.encode(payload));
  const expected = Array.from(new Uint8Array(mac))
    .map((b) => b.toString(16).padStart(2, "0")).join("");
  if (expected !== sig) return false;
  return Number(payload) > Date.now();
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // 로그인 페이지와 로그인 API는 통과
  if (pathname.startsWith("/admin/login")) return NextResponse.next();

  if (pathname.startsWith("/admin")) {
    const token = req.cookies.get("bc_admin_session")?.value;
    const secret = process.env.SESSION_SECRET || "dev-only-insecure-secret";
    const ok = await verify(token, secret);
    if (!ok) {
      const url = req.nextUrl.clone();
      url.pathname = "/admin/login";
      return NextResponse.redirect(url);
    }
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*"],
};

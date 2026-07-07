/**
 * =====================================================================
 * "아이 이름 + 비밀번호"로 홈페이지에서 바로 로그인 — 토큰 찾기 API
 * ---------------------------------------------------------------------
 * POST { name, password } → 성공: { token } (그 아이의 가장 최근 결과지 토큰)
 *                         → 실패: 401 (이름이 없거나, 비밀번호가 안 맞거나,
 *                                      같은 이름의 여러 아이가 동시에 일치)
 *
 * [보안]
 * - 고유 링크(토큰) 없이도 시도할 수 있어 기존 /report/[token] 흐름보다
 *   무차별 대입에 취약함 → IP별 최근 실패 횟수로 레이트리밋을 건다.
 * - 이름 존재 여부/모호함 여부를 구분해서 알려주지 않고 항상 같은
 *   오류 메시지만 반환 (계정 존재 여부 추측 방지).
 * - 토큰을 찾아줄 뿐 결과지 내용은 내려주지 않음 — 클라이언트가 이 토큰으로
 *   기존 /api/report/verify를 한 번 더 호출해서 마스킹된 내용을 받는다.
 * =====================================================================
 */
import { NextResponse } from "next/server";
import { findActiveAccessEntriesByChildName, logAccess, countRecentFailedAttempts } from "@/lib/data";
import { verifyParentPassword } from "@/lib/auth";

const NO_STORE = { "Cache-Control": "no-store, no-cache, must-revalidate" };
const RATE_LIMIT_WINDOW_MIN = 10;
const RATE_LIMIT_MAX_FAILURES = 8;
const GENERIC_ERROR = "이름 또는 비밀번호가 맞지 않습니다.";

function isExpired(expiresAt?: string): boolean {
  if (!expiresAt) return false;
  // access_tokens와 동일한 규칙: 만료일 "그날 끝까지"는 유효
  return new Date(`${expiresAt}T23:59:59Z`) < new Date();
}

export async function POST(req: Request) {
  const { name, password } = await req.json().catch(() => ({}));
  const ip = req.headers.get("x-forwarded-for");

  if (typeof name !== "string" || !name.trim() || typeof password !== "string" || !password) {
    return NextResponse.json({ message: "아이 이름과 비밀번호를 입력해 주세요." }, { status: 400 });
  }

  try {
    const recentFailures = await countRecentFailedAttempts(ip, RATE_LIMIT_WINDOW_MIN);
    if (recentFailures >= RATE_LIMIT_MAX_FAILURES) {
      return NextResponse.json({ message: "시도가 너무 많습니다. 잠시 후 다시 시도해 주세요." }, { status: 429 });
    }
  } catch {
    // 레이트리밋 확인 실패는 로그인 자체를 막지 않음
  }

  const candidates = (await findActiveAccessEntriesByChildName(name.trim())).filter((c) => !isExpired(c.expiresAt));

  const matched = [];
  for (const c of candidates) {
    if (await verifyParentPassword(password, c.passwordHash)) matched.push(c);
  }

  const distinctChildIds = new Set(matched.map((m) => m.childId));

  if (matched.length === 0 || distinctChildIds.size > 1) {
    try {
      await logAccess({ token: null, reportId: null, success: false, ip });
    } catch {
      // 기록 실패는 무시
    }
    return NextResponse.json({ message: GENERIC_ERROR }, { status: 401 });
  }

  // 같은 아이의 결과지가 여러 개면 가장 최근 검사일을 우선
  matched.sort((a, b) => (a.testDate < b.testDate ? 1 : -1));
  const winner = matched[0];

  try {
    await logAccess({ token: winner.token, reportId: winner.reportId, success: true, ip });
  } catch {
    // 기록 실패는 무시
  }

  return NextResponse.json({ token: winner.token }, { headers: NO_STORE });
}

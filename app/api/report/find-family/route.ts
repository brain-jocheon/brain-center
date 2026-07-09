/**
 * =====================================================================
 * "아이 이름 + 비밀번호"로 홈페이지 로그인 — 형제자매까지 한 번에 확인
 * ---------------------------------------------------------------------
 * POST { name, password }
 *  → 성공: { children: [{ childId, maskedName, token, payload }, ...] } — 입력한 이름의 아이 +
 *          같은 보호자 연락처를 쓰는 형제자매 중 "같은 비밀번호"로도 검증에
 *          성공한 아이만 포함 (형제자매마다 비밀번호가 다르면 그 아이는
 *          제외 — 다른 아이 정보가 검증 없이 노출되는 일은 없습니다)
 *  → 실패: 401 (이름 없음/비밀번호 불일치/이름이 여러 아이와 모호하게 일치)
 *
 * [보안] /api/report/find-token과 동일한 레이트리밋·일반화된 오류 메시지를
 * 쓰고, 마스킹된 콘텐츠 조립은 /api/report/verify와 같은
 * lib/reportPayload.ts를 공유합니다.
 * =====================================================================
 */
import { NextResponse } from "next/server";
import {
  findActiveAccessEntriesByChildName, findActiveAccessEntriesByChildIds,
  getSiblingChildIds, getChild, logAccess, countRecentFailedAttempts,
  type ChildLoginCandidate,
} from "@/lib/data";
import { verifyParentPassword, maskName } from "@/lib/auth";
import { buildParentReportPayload } from "@/lib/reportPayload";

const NO_STORE = { "Cache-Control": "no-store, no-cache, must-revalidate" };
const RATE_LIMIT_WINDOW_MIN = 10;
const RATE_LIMIT_MAX_FAILURES = 8;
const GENERIC_ERROR = "이름 또는 비밀번호가 맞지 않습니다.";

function isExpired(expiresAt?: string): boolean {
  if (!expiresAt) return false;
  return new Date(`${expiresAt}T23:59:59Z`) < new Date();
}

/** 후보 중 이 비밀번호와 일치하는 것들 → 아이별로 가장 최근 검사일 하나만 남김 */
async function resolveWinnersByChild(candidates: ChildLoginCandidate[], password: string): Promise<ChildLoginCandidate[]> {
  const matched: ChildLoginCandidate[] = [];
  for (const c of candidates.filter((c) => !isExpired(c.expiresAt))) {
    if (await verifyParentPassword(password, c.passwordHash)) matched.push(c);
  }
  const byChild = new Map<string, ChildLoginCandidate>();
  for (const m of matched) {
    const prev = byChild.get(m.childId);
    if (!prev || m.testDate > prev.testDate) byChild.set(m.childId, m);
  }
  return Array.from(byChild.values());
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

  const primaryCandidates = await findActiveAccessEntriesByChildName(name.trim());
  const primaryWinners = await resolveWinnersByChild(primaryCandidates, password);

  if (primaryWinners.length === 0 || primaryWinners.length > 1) {
    // 0명(불일치) 또는 여러 명(동명이인 + 우연히 같은 비밀번호) 모두 안전하게 거부
    try {
      await logAccess({ token: null, reportId: null, success: false, ip });
    } catch {
      // 기록 실패는 무시
    }
    return NextResponse.json({ message: GENERIC_ERROR }, { status: 401 });
  }

  const primary = primaryWinners[0];
  const primaryChild = await getChild(primary.childId);

  // 같은 보호자 연락처를 쓰는 형제자매 중, 같은 비밀번호로도 검증되는 아이만 포함
  const siblingIds = await getSiblingChildIds(primaryChild?.guardianPhone, primary.childId);
  const siblingCandidates = await findActiveAccessEntriesByChildIds(siblingIds);
  const siblingWinners = await resolveWinnersByChild(siblingCandidates, password);

  const allWinners = [primary, ...siblingWinners];

  const children = (
    await Promise.all(
      allWinners.map(async (w) => {
        const child = w.childId === primary.childId ? primaryChild : await getChild(w.childId);
        const payload = await buildParentReportPayload({
          token: w.token,
          reportId: w.reportId,
          reportKind: w.reportKind,
          passwordHash: w.passwordHash,
          active: true,
        });
        if (!payload) return null;
        return { childId: w.childId, maskedName: maskName(child?.name ?? ""), token: w.token, payload };
      })
    )
  ).filter(
    (c): c is { childId: string; maskedName: string; token: string; payload: NonNullable<Awaited<ReturnType<typeof buildParentReportPayload>>> } =>
      c !== null
  );

  if (children.length === 0) {
    return NextResponse.json(
      { message: "아직 준비 중인 결과지입니다. 센터로 문의해 주세요." },
      { status: 404 }
    );
  }

  try {
    await logAccess({ token: primary.token, reportId: primary.reportId, success: true, ip });
  } catch {
    // 기록 실패는 무시
  }

  return NextResponse.json({ children }, { headers: NO_STORE });
}

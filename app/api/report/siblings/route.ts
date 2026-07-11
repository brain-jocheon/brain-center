/**
 * =====================================================================
 * 학부모 마이페이지 — 형제자매 목록 조회
 * ---------------------------------------------------------------------
 * POST { token, password } — 개별 링크(/report/[token])로 이미 로그인할 때
 * 쓴 token+password를 그대로 재사용해, 같은 보호자 연락처를 쓰면서 "같은
 * 비밀번호"로도 검증되는 다른 아이만 형제자매로 반환합니다.
 * (app/api/report/find-family/route.ts와 동일한 보안 원칙 — 비밀번호가
 * 다르면 형제자매라도 절대 포함하지 않습니다)
 * =====================================================================
 */
import { NextResponse } from "next/server";
import {
  getAccessByToken, getChild, getReport, getMtprisReport,
  getSiblingChildIds, findActiveAccessEntriesByChildIds,
  type ChildLoginCandidate,
} from "@/lib/data";
import { verifyParentPassword } from "@/lib/auth";
import { buildParentReportPayload, type FamilyMember } from "@/lib/reportPayload";

const NO_STORE = { "Cache-Control": "no-store, no-cache, must-revalidate" };

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
  const { token, password } = await req.json().catch(() => ({}));
  if (typeof token !== "string" || typeof password !== "string" || !password) {
    return NextResponse.json({ message: "잘못된 요청입니다." }, { status: 400 });
  }

  const access = await getAccessByToken(token);
  if (!access) {
    return NextResponse.json({ message: "링크가 유효하지 않습니다." }, { status: 401 });
  }
  if (!(await verifyParentPassword(password, access.passwordHash))) {
    return NextResponse.json({ message: "비밀번호가 맞지 않습니다." }, { status: 401 });
  }

  const childId =
    access.reportKind === "mtpris"
      ? (await getMtprisReport(access.reportId))?.childId
      : (await getReport(access.reportId))?.childId;
  if (!childId) {
    return NextResponse.json({ siblings: [] as FamilyMember[] }, { headers: NO_STORE });
  }

  const child = await getChild(childId);
  const siblingIds = await getSiblingChildIds(child?.guardianPhone, childId);
  if (siblingIds.length === 0) {
    return NextResponse.json({ siblings: [] as FamilyMember[] }, { headers: NO_STORE });
  }

  const candidates = await findActiveAccessEntriesByChildIds(siblingIds);
  const winners = await resolveWinnersByChild(candidates, password);

  const siblings = (
    await Promise.all(
      winners.map(async (w): Promise<FamilyMember | null> => {
        const sibling = await getChild(w.childId);
        const payload = await buildParentReportPayload({
          token: w.token,
          reportId: w.reportId,
          reportKind: w.reportKind,
          passwordHash: w.passwordHash,
          active: true,
        });
        if (!payload) return null;
        return { maskedName: sibling?.name ?? "", token: w.token, payload };
      })
    )
  ).filter((s): s is FamilyMember => s !== null);

  return NextResponse.json({ siblings }, { headers: NO_STORE });
}

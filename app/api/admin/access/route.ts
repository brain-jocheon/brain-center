/**
 * 학부모 접근 링크 발급(POST) / 회수(PATCH) API (관리자 전용)
 * [보안] middleware.ts는 /api/admin/*을 보호하지 않으므로 이 세션 확인이 유일한 인증 게이트입니다.
 * [보안] 평문 비밀번호는 어디에도 저장하지 않습니다 — POST 응답에만 한 번 담아 돌려주고 버립니다.
 */
import { NextResponse } from "next/server";
import { generateAccessToken, hashParentPassword, isAdminLoggedIn } from "@/lib/auth";
import { createAccessToken, deactivateAccessToken, getAccessTokens, getMtprisReport, getReport } from "@/lib/data";
import type { AccessToken } from "@/lib/types";

export async function POST(req: Request) {
  if (!isAdminLoggedIn()) {
    return NextResponse.json({ message: "로그인이 필요합니다." }, { status: 401 });
  }

  const body = (await req.json().catch(() => null)) as
    | { reportId?: string; reportKind?: "temperament" | "mtpris"; password?: string; expiresAt?: string }
    | null;

  const { reportId, reportKind, password, expiresAt } = body ?? {};

  if (!reportId || (reportKind !== "temperament" && reportKind !== "mtpris")) {
    return NextResponse.json({ message: "잘못된 요청입니다." }, { status: 400 });
  }
  if (!password || password.length < 4) {
    return NextResponse.json({ message: "비밀번호는 4자 이상이어야 합니다." }, { status: 400 });
  }
  if (expiresAt) {
    const d = new Date(expiresAt);
    const today = new Date(new Date().toDateString());
    if (Number.isNaN(d.getTime()) || d < today) {
      return NextResponse.json({ message: "만료일이 올바르지 않습니다." }, { status: 400 });
    }
  }

  const existingReport = reportKind === "mtpris" ? await getMtprisReport(reportId) : await getReport(reportId);
  if (!existingReport) {
    return NextResponse.json({ message: "리포트를 찾을 수 없습니다." }, { status: 404 });
  }

  const tokens = await getAccessTokens();
  const alreadyActive = tokens.some((t) => t.reportId === reportId && t.active);
  if (alreadyActive) {
    return NextResponse.json({ message: "이미 발급된 활성 링크가 있습니다. 먼저 비활성화해 주세요." }, { status: 409 });
  }

  const entry: AccessToken = {
    token: generateAccessToken(),
    reportId,
    reportKind,
    passwordHash: await hashParentPassword(password),
    expiresAt: expiresAt || undefined,
    active: true,
  };
  await createAccessToken(entry);

  return NextResponse.json(
    { ok: true, token: entry.token, password },
    { headers: { "Cache-Control": "no-store, no-cache, must-revalidate" } }
  );
}

export async function PATCH(req: Request) {
  if (!isAdminLoggedIn()) {
    return NextResponse.json({ message: "로그인이 필요합니다." }, { status: 401 });
  }

  const body = (await req.json().catch(() => null)) as { token?: string; active?: boolean } | null;
  if (!body?.token || body.active !== false) {
    return NextResponse.json({ message: "잘못된 요청입니다." }, { status: 400 });
  }

  const found = await deactivateAccessToken(body.token);
  if (!found) {
    return NextResponse.json({ message: "토큰을 찾을 수 없습니다." }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}

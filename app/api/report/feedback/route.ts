/**
 * =====================================================================
 * 학부모 문의/건의사항 제출
 * ---------------------------------------------------------------------
 * POST { token, type, title, content }
 * [보안] childId를 클라이언트에서 직접 받지 않고, 이미 검증된 학부모 링크
 * 토큰으로 서버가 아이를 확인합니다 — 다른 아이 이름으로 문의를 넣을 수 없음.
 * (app/api/report/makeup-request/route.ts와 동일한 패턴)
 * =====================================================================
 */
import { NextResponse } from "next/server";
import { getAccessByToken, getReport, getMtprisReport, createParentFeedback } from "@/lib/data";
import type { ParentFeedback } from "@/lib/types";

const VALID_TYPES: ParentFeedback["type"][] = ["class", "makeup", "share", "suggestion", "other"];

export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as
    | { token?: string; type?: string; title?: string; content?: string }
    | null;

  const token = body?.token?.trim();
  const type = body?.type;
  const title = body?.title?.trim();
  const content = body?.content?.trim();

  if (!token || !title || !content || !type || !VALID_TYPES.includes(type as ParentFeedback["type"])) {
    return NextResponse.json({ message: "잘못된 요청입니다." }, { status: 400 });
  }

  const access = await getAccessByToken(token);
  if (!access) {
    return NextResponse.json({ message: "링크가 유효하지 않습니다." }, { status: 401 });
  }

  const childId =
    access.reportKind === "mtpris"
      ? (await getMtprisReport(access.reportId))?.childId
      : (await getReport(access.reportId))?.childId;
  if (!childId) {
    return NextResponse.json({ message: "아이 정보를 찾을 수 없습니다." }, { status: 404 });
  }

  const feedback = await createParentFeedback({
    childId,
    type: type as ParentFeedback["type"],
    title,
    content,
  });

  return NextResponse.json({ ok: true, feedback });
}

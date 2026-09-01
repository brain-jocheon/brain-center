/**
 * 월간 성장 리포트 생성 API (관리자 전용)
 * [보안] middleware.ts는 /api/admin/*을 보호하지 않으므로 이 세션 확인이 유일한 인증 게이트입니다.
 */
import { NextResponse } from "next/server";
import { getCurrentActor } from "@/lib/auth";
import { createMonthlyReport, actorCanAccessChild } from "@/lib/data";

const MONTH_RE = /^\d{4}-\d{2}$/;

export async function POST(req: Request) {
  const actor = getCurrentActor();
  if (!actor) {
    return NextResponse.json({ message: "로그인이 필요합니다." }, { status: 401 });
  }

  const body = (await req.json().catch(() => null)) as
    | {
        childId?: string;
        month?: string;
        participation?: string;
        strengths?: string;
        improvements?: string;
        homeGuidance?: string;
        nextMonthGoals?: string;
        counselor?: string;
        isPublicToParent?: boolean;
      }
    | null;

  const childId = body?.childId?.trim();
  const month = body?.month?.trim();
  if (!childId || !month || !MONTH_RE.test(month)) {
    return NextResponse.json({ message: "아이와 대상 월(YYYY-MM)을 확인해 주세요." }, { status: 400 });
  }
  if (!(await actorCanAccessChild(actor, childId))) {
    return NextResponse.json({ message: "권한이 없습니다." }, { status: 403 });
  }

  try {
    const report = await createMonthlyReport({
      childId,
      month,
      participation: body?.participation,
      strengths: body?.strengths,
      improvements: body?.improvements,
      homeGuidance: body?.homeGuidance,
      nextMonthGoals: body?.nextMonthGoals,
      counselor: body?.counselor,
      isPublicToParent: !!body?.isPublicToParent,
    });
    return NextResponse.json({ ok: true, report });
  } catch (e: unknown) {
    const code = (e as { code?: string })?.code;
    if (code === "23505") {
      return NextResponse.json({ message: "이미 이 달의 리포트가 있습니다. 목록에서 수정해 주세요." }, { status: 400 });
    }
    throw e;
  }
}

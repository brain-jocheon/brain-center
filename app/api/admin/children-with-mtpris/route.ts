/**
 * 아동 등록 + MT-PRIS 검사 결과를 한 번에 생성하는 API (관리자 전용)
 * [보안] middleware.ts는 /api/admin/*을 보호하지 않으므로 이 세션 확인이 유일한 인증 게이트입니다.
 */
import { NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { isAdminLoggedIn } from "@/lib/auth";
import { createChild, saveMtprisReport } from "@/lib/data";
import { MAIN_CODES, SUB_CODES } from "@/lib/content/mtpris/types";
import type { MainCode, SubCode } from "@/lib/content/mtpris/types";
import type { MtprisScores } from "@/lib/mtpris/types";

export async function POST(req: Request) {
  if (!isAdminLoggedIn()) {
    return NextResponse.json({ message: "로그인이 필요합니다." }, { status: 401 });
  }

  const body = (await req.json().catch(() => null)) as
    | {
        name?: string;
        grade?: string;
        birthYear?: number;
        testDate?: string;
        counselor?: string;
        mainType?: MainCode;
        subType?: SubCode;
        scores?: Partial<MtprisScores>;
        memo?: string;
        memoPublic?: boolean;
      }
    | null;

  const name = body?.name?.trim();
  const grade = body?.grade?.trim();
  const testDate = body?.testDate?.trim();
  const counselor = body?.counselor?.trim();
  if (!name || !grade || !testDate || !counselor) {
    return NextResponse.json({ message: "이름·학년·검사일·담당자를 모두 입력해 주세요." }, { status: 400 });
  }

  let birthYear: number | undefined;
  if (body?.birthYear !== undefined && body.birthYear !== null) {
    const y = Number(body.birthYear);
    const currentYear = new Date().getFullYear();
    if (!Number.isInteger(y) || y < 2000 || y > currentYear) {
      return NextResponse.json({ message: "출생연도가 올바르지 않습니다." }, { status: 400 });
    }
    birthYear = y;
  }

  if (!body?.mainType || !MAIN_CODES.includes(body.mainType)) {
    return NextResponse.json({ message: "대표기능 값이 올바르지 않습니다." }, { status: 400 });
  }
  if (!body?.subType || !SUB_CODES.includes(body.subType)) {
    return NextResponse.json({ message: "바탕기능 값이 올바르지 않습니다." }, { status: 400 });
  }
  const scores = {} as MtprisScores;
  for (const k of ["P", "R", "I", "S"] as const) {
    const v = Number(body.scores?.[k]);
    if (Number.isNaN(v) || v < 0 || v > 100) {
      return NextResponse.json({ message: `${k} 점수는 0~100 사이여야 합니다.` }, { status: 400 });
    }
    scores[k] = v;
  }

  const child = await createChild({ name, grade, birthYear });
  const reportId = `mtpris_${randomBytes(4).toString("hex")}`;
  await saveMtprisReport({
    id: reportId,
    childId: child.id,
    testType: "mtpris",
    testDate,
    counselor,
    status: "published",
    mainType: body.mainType,
    subType: body.subType,
    scores,
    memo: body.memo || undefined,
    memoPublic: !!body.memoPublic,
  });

  return NextResponse.json({ ok: true, child, reportId });
}

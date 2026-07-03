/**
 * MT-PRIS 리포트 저장 API (관리자 전용)
 * [보안] 세션 재확인 (미들웨어와 이중 확인)
 * [주의] MVP는 data/mtpris-reports.json 파일에 저장. 서버리스 환경은
 *        파일 쓰기가 유지되지 않으므로 운영 전 DB로 전환하세요.
 */
import { NextResponse } from "next/server";
import { isAdminLoggedIn } from "@/lib/auth";
import { getMtprisReport, saveMtprisReport } from "@/lib/data";
import { MAIN_CODES, SUB_CODES } from "@/lib/content/mtpris/types";
import type { MtprisRawInput } from "@/lib/mtpris/types";

export async function PUT(req: Request) {
  if (!isAdminLoggedIn()) {
    return NextResponse.json({ message: "로그인이 필요합니다." }, { status: 401 });
  }

  const body = (await req.json().catch(() => null)) as MtprisRawInput | null;
  if (!body?.id || !body?.childId) {
    return NextResponse.json({ message: "잘못된 요청입니다." }, { status: 400 });
  }

  // [검증] 기질명 코드가 올바른 값인지 확인 (잘못된 값 저장 방지)
  if (!MAIN_CODES.includes(body.mainType)) {
    return NextResponse.json({ message: "대표기능 값이 올바르지 않습니다." }, { status: 400 });
  }
  if (!SUB_CODES.includes(body.subType)) {
    return NextResponse.json({ message: "바탕기능 값이 올바르지 않습니다." }, { status: 400 });
  }
  for (const k of ["P", "R", "I", "S"] as const) {
    const v = Number(body.scores?.[k]);
    if (Number.isNaN(v) || v < 0 || v > 100) {
      return NextResponse.json({ message: `${k} 점수는 0~100 사이여야 합니다.` }, { status: 400 });
    }
  }

  const existing = await getMtprisReport(body.id);
  if (!existing) {
    return NextResponse.json({ message: "리포트를 찾을 수 없습니다." }, { status: 404 });
  }

  // [보안] childId·testType 등 연결 정보는 클라이언트 값을 믿지 않고 기존 값 유지
  await saveMtprisReport({
    ...body,
    id: existing.id,
    childId: existing.childId,
    testType: "mtpris",
  });

  return NextResponse.json({ ok: true });
}

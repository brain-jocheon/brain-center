/**
 * =====================================================================
 * 상담 신청 제출 (공개 홈페이지, 로그인 불필요)
 * ---------------------------------------------------------------------
 * POST { guardianName, guardianPhone, childName, ..., consent }
 * [보안] 이 앱에서 처음으로 완전 공개된 쓰기 API라 IP당 최근 1시간 5건
 * 초과 시 429로 막습니다(app/api/report/verify의 실패-카운트 레이트리밋과
 * 같은 원리, countRecentConsultationsByIp 재사용).
 * =====================================================================
 */
import { NextResponse } from "next/server";
import { createConsultation, countRecentConsultationsByIp } from "@/lib/data";

const RATE_LIMIT_WINDOW_MIN = 60;
const RATE_LIMIT_MAX_SUBMISSIONS = 5;

export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as
    | {
        guardianName?: string;
        guardianPhone?: string;
        childName?: string;
        childAgeGrade?: string;
        concern?: string;
        isExistingMember?: boolean;
        desiredProgram?: string;
        desiredDatetime?: string;
        referralSource?: string;
        additionalMessage?: string;
        consent?: boolean;
      }
    | null;

  const guardianName = body?.guardianName?.trim();
  const guardianPhone = body?.guardianPhone?.trim();
  const childName = body?.childName?.trim();

  if (!guardianName || !guardianPhone || !childName || !body?.consent) {
    return NextResponse.json({ message: "필수 항목(보호자 이름·연락처·아이 이름·개인정보 동의)을 확인해 주세요." }, { status: 400 });
  }

  const ip = req.headers.get("x-forwarded-for");
  try {
    const recent = await countRecentConsultationsByIp(ip, RATE_LIMIT_WINDOW_MIN);
    if (recent >= RATE_LIMIT_MAX_SUBMISSIONS) {
      return NextResponse.json({ message: "잠시 후 다시 시도해 주세요." }, { status: 429 });
    }
  } catch {
    // 레이트리밋 확인 실패는 제출 자체를 막지 않음
  }

  const consultation = await createConsultation({
    guardianName,
    guardianPhone,
    childName,
    childAgeGrade: body.childAgeGrade?.trim(),
    concern: body.concern?.trim(),
    isExistingMember: !!body.isExistingMember,
    desiredProgram: body.desiredProgram?.trim(),
    desiredDatetime: body.desiredDatetime?.trim(),
    referralSource: body.referralSource?.trim(),
    additionalMessage: body.additionalMessage?.trim(),
    ip: ip ?? undefined,
  });

  return NextResponse.json({ ok: true, id: consultation.id });
}

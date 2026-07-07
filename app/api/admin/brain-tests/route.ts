/**
 * 뇌기능검사 생성 API (관리자 전용)
 * [보안] middleware.ts는 /api/admin/*을 보호하지 않으므로 이 세션 확인이 유일한 인증 게이트입니다.
 * 이 라우트가 호출되는 시점엔 이미 클라이언트가 Storage에 파일을 직접 업로드 완료한 상태입니다
 * (파일이 없는 경우도 허용 — 지표·의견만 입력할 수도 있음).
 */
import { NextResponse } from "next/server";
import { isAdminLoggedIn } from "@/lib/auth";
import { createBrainTest } from "@/lib/data";
import type { BrainIndicator } from "@/lib/types";

export async function POST(req: Request) {
  if (!isAdminLoggedIn()) {
    return NextResponse.json({ message: "로그인이 필요합니다." }, { status: 401 });
  }

  const body = (await req.json().catch(() => null)) as
    | {
        childId?: string;
        testDate?: string;
        counselor?: string;
        fileStoragePath?: string;
        fileName?: string;
        indicators?: BrainIndicator[];
        opinion?: string;
        isPublicToParent?: boolean;
      }
    | null;

  const childId = body?.childId?.trim();
  const testDate = body?.testDate?.trim();
  const counselor = body?.counselor?.trim();
  if (!childId || !testDate || !counselor) {
    return NextResponse.json({ message: "검사일과 담당자를 입력해 주세요." }, { status: 400 });
  }

  const indicators = Array.isArray(body?.indicators)
    ? body!.indicators!
        .map((i) => ({ label: (i?.label ?? "").trim(), value: (i?.value ?? "").trim() }))
        .filter((i) => i.label && i.value)
    : [];

  const test = await createBrainTest({
    childId,
    testDate,
    counselor,
    fileStoragePath: body?.fileStoragePath?.trim() || undefined,
    fileName: body?.fileName?.trim() || undefined,
    indicators,
    opinion: body?.opinion?.trim() || undefined,
    isPublicToParent: !!body?.isPublicToParent,
  });

  return NextResponse.json({ ok: true, test });
}

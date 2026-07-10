/**
 * 홈페이지 센터소개/위치/연락처 문구 수정 API (관리자 전용)
 */
import { NextResponse } from "next/server";
import { isAdminLoggedIn } from "@/lib/auth";
import { updateSiteSettings } from "@/lib/data";

export async function PATCH(req: Request) {
  if (!isAdminLoggedIn()) {
    return NextResponse.json({ message: "로그인이 필요합니다." }, { status: 401 });
  }

  const body = (await req.json().catch(() => null)) as
    | { aboutText?: string; address?: string; phone?: string; kakaoUrl?: string }
    | null;

  if (!body) {
    return NextResponse.json({ message: "잘못된 요청입니다." }, { status: 400 });
  }

  await updateSiteSettings({
    aboutText: body.aboutText?.trim(),
    address: body.address?.trim(),
    phone: body.phone?.trim(),
    kakaoUrl: body.kakaoUrl?.trim(),
  });

  return NextResponse.json({ ok: true });
}

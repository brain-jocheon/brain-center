/**
 * 학부모 전용 공지(대상분리) 목록 조회/생성 API (관리자 전용)
 * [보안] middleware.ts는 /api/admin/*을 보호하지 않으므로 이 세션 확인이 유일한 인증 게이트입니다.
 * [주의] 로그인 없이 보이는 공개 홈페이지 공지(app/api/admin/notices)와 완전히 별개입니다.
 */
import { NextResponse } from "next/server";
import { isAdminLoggedIn } from "@/lib/auth";
import { getParentNoticesAdmin, createParentNotice } from "@/lib/data";
import type { ParentNoticeAdmin } from "@/lib/types";

const AUDIENCE_TYPES: ParentNoticeAdmin["audienceType"][] = ["all", "status", "program", "weekday", "child"];

export async function GET() {
  if (!isAdminLoggedIn()) {
    return NextResponse.json({ message: "로그인이 필요합니다." }, { status: 401 });
  }
  const notices = await getParentNoticesAdmin();
  return NextResponse.json({ notices });
}

export async function POST(req: Request) {
  if (!isAdminLoggedIn()) {
    return NextResponse.json({ message: "로그인이 필요합니다." }, { status: 401 });
  }

  const body = (await req.json().catch(() => null)) as
    | { title?: string; body?: string; audienceType?: string; audienceValue?: string }
    | null;

  const title = body?.title?.trim();
  const bodyText = body?.body?.trim();
  const audienceType = body?.audienceType;
  const audienceValue = body?.audienceValue?.trim();

  if (!title || !bodyText || !audienceType || !AUDIENCE_TYPES.includes(audienceType as ParentNoticeAdmin["audienceType"])) {
    return NextResponse.json({ message: "제목·내용·대상을 확인해 주세요." }, { status: 400 });
  }
  if (audienceType !== "all" && !audienceValue) {
    return NextResponse.json({ message: "선택한 대상 유형에 맞는 값을 골라 주세요." }, { status: 400 });
  }

  const notice = await createParentNotice({
    title,
    body: bodyText,
    audienceType: audienceType as ParentNoticeAdmin["audienceType"],
    audienceValue: audienceType === "all" ? undefined : audienceValue,
  });

  return NextResponse.json({ ok: true, notice });
}

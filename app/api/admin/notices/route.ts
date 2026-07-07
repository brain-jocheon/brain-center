/**
 * 공지사항 작성 API (관리자 전용)
 * [주의] 공지사항은 로그인 없이 보이는 공개 홈페이지에 즉시 노출됩니다.
 * 아이 개인정보나 활동 사진은 여기(공지사항)가 아니라 "센터 소식 관리"(학부모 전용)에 올려야 합니다.
 */
import { NextResponse } from "next/server";
import { isAdminLoggedIn } from "@/lib/auth";
import { createNotice } from "@/lib/data";

export async function POST(req: Request) {
  if (!isAdminLoggedIn()) {
    return NextResponse.json({ message: "로그인이 필요합니다." }, { status: 401 });
  }

  const body = (await req.json().catch(() => null)) as { title?: string; body?: string } | null;
  const title = body?.title?.trim();
  const noticeBody = body?.body?.trim();

  if (!title || !noticeBody) {
    return NextResponse.json({ message: "제목과 내용을 입력해 주세요." }, { status: 400 });
  }

  const notice = await createNotice({ title, body: noticeBody });
  return NextResponse.json({ ok: true, notice });
}

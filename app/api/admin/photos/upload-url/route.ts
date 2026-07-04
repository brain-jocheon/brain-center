/**
 * 사진 업로드용 서명 URL 발급 API (관리자 전용)
 * [보안] middleware.ts는 /api/admin/*을 보호하지 않으므로 이 세션 확인이 유일한 인증 게이트입니다.
 * 실제 파일 바이트는 이 서버를 거치지 않습니다 — 클라이언트가 여기서 받은 서명 URL로
 * Supabase Storage에 직접 업로드합니다 (Vercel 요청 본문 4.5MB 제한 회피).
 */
import { NextResponse } from "next/server";
import { isAdminLoggedIn } from "@/lib/auth";
import { createPhotoUploadTarget, getChild } from "@/lib/data";

export async function POST(req: Request) {
  if (!isAdminLoggedIn()) {
    return NextResponse.json({ message: "로그인이 필요합니다." }, { status: 401 });
  }

  const body = (await req.json().catch(() => null)) as
    | { childId?: string; filename?: string; contentType?: string }
    | null;

  if (!body?.childId || !body?.filename || !body?.contentType) {
    return NextResponse.json({ message: "잘못된 요청입니다." }, { status: 400 });
  }

  const child = await getChild(body.childId);
  if (!child) {
    return NextResponse.json({ message: "아동을 찾을 수 없습니다." }, { status: 404 });
  }

  try {
    const target = await createPhotoUploadTarget(body.childId, body.filename, body.contentType);
    return NextResponse.json({ ok: true, ...target });
  } catch (e) {
    const message = e instanceof Error ? e.message : "업로드 URL 발급에 실패했습니다.";
    return NextResponse.json({ message }, { status: 400 });
  }
}

/**
 * 코멘트 템플릿(자주 쓰는 문구) 목록 조회/추가 API (관리자 전용)
 * [보안] middleware.ts는 /api/admin/*을 보호하지 않으므로 이 세션 확인이 유일한 인증 게이트입니다.
 */
import { NextResponse } from "next/server";
import { getCurrentActor } from "@/lib/auth";
import { getCommentTemplates, createCommentTemplate } from "@/lib/data";

export async function GET() {
  if (!getCurrentActor()) {
    return NextResponse.json({ message: "로그인이 필요합니다." }, { status: 401 });
  }
  const templates = await getCommentTemplates();
  return NextResponse.json({ templates });
}

export async function POST(req: Request) {
  if (!getCurrentActor()) {
    return NextResponse.json({ message: "로그인이 필요합니다." }, { status: 401 });
  }

  const body = (await req.json().catch(() => null)) as { text?: string } | null;
  const text = body?.text?.trim();
  if (!text) {
    return NextResponse.json({ message: "문구를 입력해 주세요." }, { status: 400 });
  }

  const template = await createCommentTemplate(text);
  return NextResponse.json({ ok: true, template });
}

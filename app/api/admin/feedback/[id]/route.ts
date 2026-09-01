/**
 * 학부모 문의/건의사항 상태 변경 · 답변 작성 (관리자 전용)
 */
import { NextResponse } from "next/server";
import { getCurrentActor, isFullAdmin } from "@/lib/auth";
import { reviewParentFeedback } from "@/lib/data";
import type { ParentFeedback } from "@/lib/types";

const VALID_STATUS: ParentFeedback["status"][] = ["pending", "reviewed", "answered"];

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  if (!isFullAdmin(getCurrentActor())) {
    return NextResponse.json({ message: "권한이 없습니다." }, { status: 403 });
  }

  const body = (await req.json().catch(() => null)) as { status?: string; adminReply?: string } | null;
  if (!body?.status || !VALID_STATUS.includes(body.status as ParentFeedback["status"])) {
    return NextResponse.json({ message: "잘못된 요청입니다." }, { status: 400 });
  }

  const result = await reviewParentFeedback(params.id, body.status as ParentFeedback["status"], body.adminReply?.trim() || undefined);
  if (!result) {
    return NextResponse.json({ message: "문의를 찾을 수 없습니다." }, { status: 404 });
  }
  return NextResponse.json({ ok: true, feedback: result });
}

/**
 * 수업기록 빠른등록 생성 API (관리자 전용)
 * [보안] middleware.ts는 /api/admin/*을 보호하지 않으므로 이 세션 확인이 유일한 인증 게이트입니다.
 * 사진은 이 라우트가 다루지 않음 — 클라이언트가 이 응답의 id를 classRecordId로 붙여서
 * 기존 POST /api/admin/photos를 그대로 재호출.
 */
import { NextResponse } from "next/server";
import { getCurrentActor } from "@/lib/auth";
import { createClassRecord, actorCanAccessChild } from "@/lib/data";
import type { ActivityPhoto } from "@/lib/types";
import type { ChildCommentExtras } from "@/lib/data";

const ACTIVITY_TYPES: ActivityPhoto["activityType"][] = ["class", "craft", "cooking", "neurofeedback", "event", "other"];

export async function POST(req: Request) {
  const actor = getCurrentActor();
  if (!actor) {
    return NextResponse.json({ message: "로그인이 필요합니다." }, { status: 401 });
  }

  const body = (await req.json().catch(() => null)) as
    | {
        classDate?: string;
        activityName?: string;
        activityType?: string;
        comment?: string;
        counselor?: string;
        lessonGoal?: string;
        participation?: string;
        childIds?: string[];
        childComments?: Record<string, { comment?: string; isPublicToParent: boolean } & ChildCommentExtras>;
      }
    | null;

  const classDate = body?.classDate?.trim();
  const activityName = body?.activityName?.trim();
  const childIds = Array.isArray(body?.childIds) ? body!.childIds!.filter((id) => typeof id === "string" && id) : [];

  if (!classDate || !activityName) {
    return NextResponse.json({ message: "날짜와 활동명을 입력해 주세요." }, { status: 400 });
  }
  if (!body?.activityType || !ACTIVITY_TYPES.includes(body.activityType as ActivityPhoto["activityType"])) {
    return NextResponse.json({ message: "활동 유형이 올바르지 않습니다." }, { status: 400 });
  }
  if (childIds.length === 0) {
    return NextResponse.json({ message: "참여한 아이를 1명 이상 선택해 주세요." }, { status: 400 });
  }
  // [보안] 담당이 아닌 아이가 하나라도 섞여 있으면 전체 거부(IDOR 방지)
  const accessChecks = await Promise.all(childIds.map((id) => actorCanAccessChild(actor, id)));
  if (accessChecks.some((ok) => !ok)) {
    return NextResponse.json({ message: "담당하지 않는 아이가 포함되어 있습니다." }, { status: 403 });
  }

  const record = await createClassRecord({
    classDate,
    activityName,
    activityType: body.activityType as ActivityPhoto["activityType"],
    comment: body.comment?.trim() || undefined,
    counselor: body.counselor?.trim() || undefined,
    lessonGoal: body.lessonGoal?.trim() || undefined,
    participation: body.participation?.trim() || undefined,
    childIds,
    childComments: body.childComments ?? {},
  });

  return NextResponse.json({ ok: true, record });
}

/**
 * 아이별 코멘트 오버라이드 수정 API (담당 선생님/관리자) — 내용 수정 + [15단계] 단계형 관찰/
 * 내부메모/학부모 공개초안 + 학부모 공개 승인·취소
 * [보안] middleware.ts는 /api/admin/*을 보호하지 않으므로 이 세션 확인이 유일한 인증 게이트입니다.
 * [15단계/보안] 학부모 공개(parentPublishAction)는 isFullAdmin만 가능 — 선생님은 내용은
 * 자유롭게 수정할 수 있지만 승인/공개취소는 못 함(요청하신 권한표와 정확히 일치).
 */
import { NextResponse } from "next/server";
import { getCurrentActor, isFullAdmin } from "@/lib/auth";
import { updateChildComment, getChildCommentOwner, actorCanAccessChild, getStaffById } from "@/lib/data";

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const actor = getCurrentActor();
  if (!actor) {
    return NextResponse.json({ message: "로그인이 필요합니다." }, { status: 401 });
  }
  const childId = await getChildCommentOwner(params.id);
  if (!childId || !(await actorCanAccessChild(actor, childId))) {
    return NextResponse.json({ message: "권한이 없습니다." }, { status: 403 });
  }

  const body = (await req.json().catch(() => null)) as
    | {
        comment?: string;
        participationLevel?: number | null;
        concentrationLevel?: number | null;
        understandingLevel?: number | null;
        emotionalStateLevel?: number | null;
        interactionLevel?: number | null;
        strengthsNote?: string;
        difficultiesNote?: string;
        teacherMemo?: string;
        specialNote?: string;
        nextSessionGoal?: string;
        parentActivitySummary?: string;
        parentPositiveMoment?: string;
        parentObservedChange?: string;
        parentNextGoal?: string;
        parentHomeTip?: string;
        parentPublishAction?: "approve" | "revoke";
      }
    | null;
  if (!body || Object.keys(body).length === 0) {
    return NextResponse.json({ message: "잘못된 요청입니다." }, { status: 400 });
  }

  if (body.parentPublishAction !== undefined && !isFullAdmin(actor)) {
    return NextResponse.json({ message: "학부모 공개 승인은 관리자만 할 수 있습니다." }, { status: 403 });
  }

  const RATING_FIELDS = [
    "participationLevel", "concentrationLevel", "understandingLevel", "emotionalStateLevel", "interactionLevel",
  ] as const;
  for (const f of RATING_FIELDS) {
    const v = body[f];
    if (v !== undefined && v !== null && (typeof v !== "number" || v < 1 || v > 5)) {
      return NextResponse.json({ message: "관찰 지표 값은 1~5 사이여야 합니다." }, { status: 400 });
    }
  }

  const approverLabel =
    actor.kind === "staff" ? `${(await getStaffById(actor.staffId))?.name ?? "관리자"}(${actor.role})` : "관리자(공용계정)";

  const found = await updateChildComment(params.id, {
    comment: body.comment,
    participationLevel: body.participationLevel ?? undefined,
    concentrationLevel: body.concentrationLevel ?? undefined,
    understandingLevel: body.understandingLevel ?? undefined,
    emotionalStateLevel: body.emotionalStateLevel ?? undefined,
    interactionLevel: body.interactionLevel ?? undefined,
    strengthsNote: body.strengthsNote,
    difficultiesNote: body.difficultiesNote,
    teacherMemo: body.teacherMemo,
    specialNote: body.specialNote,
    nextSessionGoal: body.nextSessionGoal,
    parentActivitySummary: body.parentActivitySummary,
    parentPositiveMoment: body.parentPositiveMoment,
    parentObservedChange: body.parentObservedChange,
    parentNextGoal: body.parentNextGoal,
    parentHomeTip: body.parentHomeTip,
    parentPublishAction: body.parentPublishAction,
    approverLabel,
  });
  if (!found) {
    return NextResponse.json({ message: "코멘트를 찾을 수 없습니다." }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}

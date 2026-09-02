/**
 * 아동 특성(child_traits) 저장 API — 아동당 1행, upsert.
 * [보안] middleware.ts는 /api/admin/*을 보호하지 않으므로 이 세션 확인이 유일한 인증 게이트입니다.
 * [보안] aiIncludeFields(AI에 실제로 보낼 항목 화이트리스트)는 isFullAdmin만 바꿀 수 있음 —
 * 담당 선생님은 그 외 특성 필드는 자유롭게 적되, 이 배열은 관리자만 조정.
 */
import { NextResponse } from "next/server";
import { getCurrentActor, isFullAdmin } from "@/lib/auth";
import { upsertChildTraits, actorCanAccessChild, getStaffById } from "@/lib/data";

export async function PATCH(req: Request, { params }: { params: { childId: string } }) {
  const actor = getCurrentActor();
  if (!actor) {
    return NextResponse.json({ message: "로그인이 필요합니다." }, { status: 401 });
  }
  if (!(await actorCanAccessChild(actor, params.childId))) {
    return NextResponse.json({ message: "권한이 없습니다." }, { status: 403 });
  }

  const body = (await req.json().catch(() => null)) as
    | {
        temperament?: string;
        strengths?: string;
        weaknesses?: string;
        cautions?: string;
        learningStyle?: string;
        emotionalBehavior?: string;
        counselingGoal?: string;
        teacherMemo?: string;
        aiGuidanceNote?: string;
        aiIncludeFields?: string[];
      }
    | null;
  if (!body || Object.keys(body).length === 0) {
    return NextResponse.json({ message: "잘못된 요청입니다." }, { status: 400 });
  }
  if (body.aiIncludeFields !== undefined && !isFullAdmin(actor)) {
    return NextResponse.json({ message: "AI 반영 항목은 관리자만 변경할 수 있습니다." }, { status: 403 });
  }

  const updatedByName =
    actor.kind === "staff" ? (await getStaffById(actor.staffId))?.name ?? "관리자" : "관리자";

  const traits = await upsertChildTraits(params.childId, body, updatedByName);
  return NextResponse.json({ ok: true, traits });
}

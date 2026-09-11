/**
 * [16단계] 수업기록 기반 학부모 코멘트 5분할 AI 초안 생성 API
 * [보안] middleware.ts는 /api/admin/*을 보호하지 않으므로 이 세션 확인이 유일한 인증 게이트입니다.
 * [주의] 키가 없으면 not_configured로 조용히 응답 — 에러가 아님, 수동 입력은 항상 가능해야 함.
 * [안전] 생성 결과는 child_comments.ai_parent_draft(원본 스냅샷)에만 저장하고, 학부모 공개용
 * 라이브 필드(parent_activity_summary 등)는 절대 자동으로 안 건드림 — 화면에서 사람이
 * "이 초안 적용"을 눌러야 옮겨지고, 그 후에도 관리자 승인(parentPublishAction)이 있어야
 * 학부모에게 공개됨(15단계 흐름 그대로).
 */
import { NextResponse } from "next/server";
import { getCurrentActor } from "@/lib/auth";
import {
  actorCanAccessChild, getChildCommentOwner, getChild, getChildCommentsByChild,
  saveAiParentDraft, logAiGeneration, countRecentAiGenerationsByStaff, hashAiInputSummary,
} from "@/lib/data";
import { generateParentCommentDraft } from "@/lib/ai";

const RATE_LIMIT_WINDOW_MINUTES = 60;
const RATE_LIMIT_MAX = 40;
const RECENT_SESSIONS_LIMIT = 5;

export async function POST(req: Request) {
  const actor = getCurrentActor();
  if (!actor) {
    return NextResponse.json({ message: "로그인이 필요합니다." }, { status: 401 });
  }

  const body = (await req.json().catch(() => null)) as
    | {
        childCommentId?: string;
        activityName?: string;
        activityType?: string;
        classDate?: string;
        participationLevel?: number;
        concentrationLevel?: number;
        understandingLevel?: number;
        emotionalStateLevel?: number;
        interactionLevel?: number;
        strengthsNote?: string;
        difficultiesNote?: string;
        specialNote?: string;
        nextSessionGoal?: string;
      }
    | null;

  const childCommentId = body?.childCommentId?.trim();
  if (!childCommentId) {
    return NextResponse.json({ message: "잘못된 요청입니다." }, { status: 400 });
  }

  const childId = await getChildCommentOwner(childCommentId);
  if (!childId || !(await actorCanAccessChild(actor, childId))) {
    return NextResponse.json({ message: "권한이 없습니다." }, { status: 403 });
  }

  const staffId = actor.kind === "staff" ? actor.staffId : undefined;
  if (staffId) {
    const recent = await countRecentAiGenerationsByStaff(staffId, RATE_LIMIT_WINDOW_MINUTES);
    if (recent >= RATE_LIMIT_MAX) {
      return NextResponse.json({ message: "AI 요청이 너무 많습니다. 잠시 후 다시 시도해 주세요." }, { status: 429 });
    }
  }

  const child = await getChild(childId);
  if (!child) {
    return NextResponse.json({ message: "아이를 찾을 수 없습니다." }, { status: 404 });
  }

  // [16단계] 최근 수업기록 최대 5건을 짧게 요약해 컨텍스트로 제공(현재 편집 중인 기록은 제외)
  let recentSessionsContext: string | undefined;
  try {
    const history = await getChildCommentsByChild(childId);
    const recentLines = history
      .filter((h) => h.childComment?.id !== childCommentId)
      .slice(0, RECENT_SESSIONS_LIMIT)
      .map((h) => {
        const c = h.childComment;
        const parts = [`${h.classRecord.classDate} ${h.classRecord.activityName}`];
        if (c?.participationLevel != null) parts.push(`참여도${c.participationLevel}`);
        if (c?.concentrationLevel != null) parts.push(`집중도${c.concentrationLevel}`);
        if (c?.understandingLevel != null) parts.push(`이해도${c.understandingLevel}`);
        return parts.join(" ");
      });
    if (recentLines.length > 0) recentSessionsContext = recentLines.join("\n");
  } catch {
    // 최근기록 조회 실패는 컨텍스트 없이 진행(AI 초안 자체를 막지 않음)
  }

  const draftInput = {
    childName: child.name,
    activityName: body?.activityName?.trim() || "",
    activityType: body?.activityType?.trim() || "",
    classDate: body?.classDate?.trim() || "",
    participationLevel: body?.participationLevel,
    concentrationLevel: body?.concentrationLevel,
    understandingLevel: body?.understandingLevel,
    emotionalStateLevel: body?.emotionalStateLevel,
    interactionLevel: body?.interactionLevel,
    strengthsNote: body?.strengthsNote?.trim() || undefined,
    difficultiesNote: body?.difficultiesNote?.trim() || undefined,
    specialNote: body?.specialNote?.trim() || undefined,
    nextSessionGoal: body?.nextSessionGoal?.trim() || undefined,
    recentSessionsContext,
    programContext: child.serviceType || undefined,
  };

  const result = await generateParentCommentDraft(draftInput);

  const inputSummaryHash = hashAiInputSummary([
    draftInput.activityName,
    draftInput.classDate,
    String(draftInput.participationLevel ?? ""),
  ]);

  if (result.status === "not_configured") {
    return NextResponse.json({ ok: false, reason: "not_configured", message: "AI 기능이 아직 설정되지 않았습니다. 직접 입력해 주세요." });
  }

  if (result.status === "error") {
    await logAiGeneration({
      feature: "parent_comment_draft",
      targetId: childCommentId,
      staffId,
      inputSummaryHash,
      status: "failed",
      errorMessage: result.message,
    });
    return NextResponse.json({ ok: false, reason: "error", message: result.message });
  }

  const draft = {
    activitySummary: result.activitySummary,
    positiveMoment: result.positiveMoment,
    observedChange: result.observedChange,
    nextGoal: result.nextGoal,
    homeTip: result.homeTip,
  };
  await saveAiParentDraft(childCommentId, draft, result.model);

  await logAiGeneration({
    feature: "parent_comment_draft",
    targetId: childCommentId,
    staffId,
    model: result.model,
    inputSummaryHash,
    status: "success",
    tokensUsed: result.tokensUsed,
  });

  return NextResponse.json({ ok: true, draft, model: result.model });
}

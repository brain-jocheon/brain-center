/**
 * 뇌기능검사 수정(PATCH)/삭제(DELETE) API (관리자 전용)
 */
import { NextResponse } from "next/server";
import { getCurrentActor, isFullAdmin } from "@/lib/auth";
import { deleteBrainTest, deleteBrainFile, updateBrainTest, getStaffById } from "@/lib/data";
import type { BrainIndicator, BrainTest } from "@/lib/types";

const STATUS_VALUES: BrainTest["status"][] = [
  "draft", "uploaded", "extracting", "needs_review", "confirmed", "ai_processing",
  "ai_drafted", "teacher_reviewed", "pending_approval", "approved", "published", "failed",
];

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const actor = getCurrentActor();
  if (!isFullAdmin(actor)) {
    return NextResponse.json({ message: "권한이 없습니다." }, { status: 403 });
  }

  const body = (await req.json().catch(() => null)) as
    | {
        testDate?: string;
        counselor?: string;
        indicators?: BrainIndicator[];
        opinion?: string;
        isPublicToParent?: boolean;
        testType?: string;
        testName?: string;
        measuringOrg?: string;
        measuredBy?: string;
        parentSummary?: string;
        status?: string;
      }
    | null;

  if (!body || Object.keys(body).length === 0) {
    return NextResponse.json({ message: "잘못된 요청입니다." }, { status: 400 });
  }
  if (body.status !== undefined && !STATUS_VALUES.includes(body.status as BrainTest["status"])) {
    return NextResponse.json({ message: "처리 상태 값이 올바르지 않습니다." }, { status: 400 });
  }

  const indicators = Array.isArray(body.indicators)
    ? body.indicators
        .map((i) => ({ label: (i?.label ?? "").trim(), value: (i?.value ?? "").trim() }))
        .filter((i) => i.label && i.value)
    : undefined;

  // [8단계] 승인자 이름 기록용 — legacy_admin은 "관리자", staff면 실제 이름 조회
  const approverName =
    actor?.kind === "staff" ? (await getStaffById(actor.staffId))?.name ?? "관리자" : "관리자";

  const found = await updateBrainTest(
    params.id,
    {
      testDate: body.testDate?.trim(),
      counselor: body.counselor?.trim(),
      indicators,
      opinion: body.opinion?.trim(),
      isPublicToParent: body.isPublicToParent,
      testType: body.testType,
      testName: body.testName,
      measuringOrg: body.measuringOrg,
      measuredBy: body.measuredBy,
      parentSummary: body.parentSummary,
      status: body.status as BrainTest["status"] | undefined,
    },
    approverName
  );
  if (!found) {
    return NextResponse.json({ message: "뇌기능검사를 찾을 수 없습니다." }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  if (!isFullAdmin(getCurrentActor())) {
    return NextResponse.json({ message: "권한이 없습니다." }, { status: 403 });
  }

  const storagePath = await deleteBrainTest(params.id);
  if (storagePath === null) {
    return NextResponse.json({ message: "뇌기능검사를 찾을 수 없습니다." }, { status: 404 });
  }

  if (storagePath) {
    try {
      await deleteBrainFile(storagePath);
    } catch {
      // [주의] Storage 파일 삭제 실패는 무시 — DB 행은 이미 지워졌으므로 화면/링크에서는 즉시 사라짐
    }
  }

  return NextResponse.json({ ok: true });
}

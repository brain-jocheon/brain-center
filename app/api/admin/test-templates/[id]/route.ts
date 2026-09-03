/**
 * 검사 템플릿(eeg_test_templates) 수정·삭제 API — 전체 관리자 전용.
 */
import { NextResponse } from "next/server";
import { getCurrentActor, isFullAdmin } from "@/lib/auth";
import { updateEegTestTemplate, deleteEegTestTemplate } from "@/lib/data";
import type { EegTestTemplate } from "@/lib/types";

const VALID_DIRECTIONS: EegTestTemplate["direction"][] = ["higher_better", "lower_better", "none"];

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  if (!isFullAdmin(getCurrentActor())) {
    return NextResponse.json({ message: "권한이 없습니다." }, { status: 403 });
  }

  const body = (await req.json().catch(() => null)) as
    | {
        indicatorLabel?: string;
        direction?: string;
        normalRangeMin?: number | null;
        normalRangeMax?: number | null;
        aiInstruction?: string;
      }
    | null;
  if (!body || Object.keys(body).length === 0) {
    return NextResponse.json({ message: "잘못된 요청입니다." }, { status: 400 });
  }
  if (body.direction !== undefined && !VALID_DIRECTIONS.includes(body.direction as EegTestTemplate["direction"])) {
    return NextResponse.json({ message: "방향성 값이 올바르지 않습니다." }, { status: 400 });
  }

  const found = await updateEegTestTemplate(params.id, {
    indicatorLabel: body.indicatorLabel,
    direction: body.direction as EegTestTemplate["direction"] | undefined,
    normalRangeMin: body.normalRangeMin,
    normalRangeMax: body.normalRangeMax,
    aiInstruction: body.aiInstruction,
  });
  if (!found) {
    return NextResponse.json({ message: "템플릿을 찾을 수 없습니다." }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  if (!isFullAdmin(getCurrentActor())) {
    return NextResponse.json({ message: "권한이 없습니다." }, { status: 403 });
  }
  const found = await deleteEegTestTemplate(params.id);
  if (!found) {
    return NextResponse.json({ message: "템플릿을 찾을 수 없습니다." }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}

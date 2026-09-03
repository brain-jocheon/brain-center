/**
 * 검사 템플릿(eeg_test_templates) 목록 조회·생성 API — 전체 관리자 전용.
 * [보안] 뇌기능검사와 동일하게(8단계 결정) 관리자만 다룸 — 선생님은 조회조차 안 함.
 */
import { NextResponse } from "next/server";
import { getCurrentActor, isFullAdmin } from "@/lib/auth";
import { getEegTestTemplates, createEegTestTemplate } from "@/lib/data";
import type { EegTestTemplate } from "@/lib/types";

const VALID_DIRECTIONS: EegTestTemplate["direction"][] = ["higher_better", "lower_better", "none"];

export async function GET() {
  if (!isFullAdmin(getCurrentActor())) {
    return NextResponse.json({ message: "권한이 없습니다." }, { status: 403 });
  }
  const templates = await getEegTestTemplates();
  return NextResponse.json({ templates });
}

export async function POST(req: Request) {
  if (!isFullAdmin(getCurrentActor())) {
    return NextResponse.json({ message: "권한이 없습니다." }, { status: 403 });
  }

  const body = (await req.json().catch(() => null)) as
    | {
        testType?: string;
        indicatorKey?: string;
        indicatorLabel?: string;
        direction?: string;
        normalRangeMin?: number | null;
        normalRangeMax?: number | null;
        aiInstruction?: string;
      }
    | null;

  const testType = body?.testType?.trim();
  const indicatorKey = body?.indicatorKey?.trim();
  const indicatorLabel = body?.indicatorLabel?.trim();
  const direction = body?.direction;
  if (!testType || !indicatorKey || !indicatorLabel || !direction || !VALID_DIRECTIONS.includes(direction as EegTestTemplate["direction"])) {
    return NextResponse.json({ message: "검사종류·지표key·지표명·방향성을 확인해 주세요." }, { status: 400 });
  }

  try {
    const template = await createEegTestTemplate({
      testType,
      indicatorKey,
      indicatorLabel,
      direction: direction as EegTestTemplate["direction"],
      normalRangeMin: body?.normalRangeMin ?? undefined,
      normalRangeMax: body?.normalRangeMax ?? undefined,
      aiInstruction: body?.aiInstruction,
    });
    return NextResponse.json({ ok: true, template });
  } catch (e: unknown) {
    const code = (e as { code?: string })?.code;
    if (code === "23505") {
      return NextResponse.json({ message: "이미 같은 검사종류·지표key로 등록된 템플릿이 있습니다." }, { status: 400 });
    }
    throw e;
  }
}

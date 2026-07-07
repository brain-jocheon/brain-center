/**
 * 뇌기능검사 수정(PATCH)/삭제(DELETE) API (관리자 전용)
 */
import { NextResponse } from "next/server";
import { isAdminLoggedIn } from "@/lib/auth";
import { deleteBrainTest, deleteBrainFile, updateBrainTest } from "@/lib/data";
import type { BrainIndicator } from "@/lib/types";

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  if (!isAdminLoggedIn()) {
    return NextResponse.json({ message: "로그인이 필요합니다." }, { status: 401 });
  }

  const body = (await req.json().catch(() => null)) as
    | {
        testDate?: string;
        counselor?: string;
        indicators?: BrainIndicator[];
        opinion?: string;
        isPublicToParent?: boolean;
      }
    | null;

  if (!body || Object.keys(body).length === 0) {
    return NextResponse.json({ message: "잘못된 요청입니다." }, { status: 400 });
  }

  const indicators = Array.isArray(body.indicators)
    ? body.indicators
        .map((i) => ({ label: (i?.label ?? "").trim(), value: (i?.value ?? "").trim() }))
        .filter((i) => i.label && i.value)
    : undefined;

  const found = await updateBrainTest(params.id, {
    testDate: body.testDate?.trim(),
    counselor: body.counselor?.trim(),
    indicators,
    opinion: body.opinion?.trim(),
    isPublicToParent: body.isPublicToParent,
  });
  if (!found) {
    return NextResponse.json({ message: "뇌기능검사를 찾을 수 없습니다." }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  if (!isAdminLoggedIn()) {
    return NextResponse.json({ message: "로그인이 필요합니다." }, { status: 401 });
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

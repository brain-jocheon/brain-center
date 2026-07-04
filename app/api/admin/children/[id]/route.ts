/**
 * 아동 정보 수정(PATCH: 기본정보/상태 변경) 및 완전 삭제(DELETE) API (관리자 전용)
 * [보안] middleware.ts는 /api/admin/*을 보호하지 않으므로 이 세션 확인이 유일한 인증 게이트입니다.
 */
import { NextResponse } from "next/server";
import { isAdminLoggedIn } from "@/lib/auth";
import { deleteChild, getChild, updateChild } from "@/lib/data";

const STATUS_VALUES = ["active", "waiting", "ended"] as const;

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  if (!isAdminLoggedIn()) {
    return NextResponse.json({ message: "로그인이 필요합니다." }, { status: 401 });
  }

  const body = (await req.json().catch(() => null)) as
    | {
        status?: string;
        name?: string;
        grade?: string;
        birthYear?: number;
        birthDate?: string;
        gender?: string;
        guardianName?: string;
        guardianPhone?: string;
        serviceType?: string;
        classDay?: string;
        counselor?: string;
        memo?: string;
      }
    | null;

  if (!body || Object.keys(body).length === 0) {
    return NextResponse.json({ message: "잘못된 요청입니다." }, { status: 400 });
  }

  if (body.status !== undefined && !STATUS_VALUES.includes(body.status as (typeof STATUS_VALUES)[number])) {
    return NextResponse.json({ message: "잘못된 상태 값입니다." }, { status: 400 });
  }
  if (body.name !== undefined && !body.name.trim()) {
    return NextResponse.json({ message: "이름을 입력해 주세요." }, { status: 400 });
  }
  if (body.grade !== undefined && !body.grade.trim()) {
    return NextResponse.json({ message: "학년을 입력해 주세요." }, { status: 400 });
  }
  if (body.gender !== undefined && body.gender !== "" && body.gender !== "M" && body.gender !== "F") {
    return NextResponse.json({ message: "성별 값이 올바르지 않습니다." }, { status: 400 });
  }

  const found = await updateChild(params.id, {
    status: body.status as (typeof STATUS_VALUES)[number] | undefined,
    name: body.name?.trim(),
    grade: body.grade?.trim(),
    birthYear: body.birthYear,
    birthDate: body.birthDate?.trim(),
    gender: body.gender === "" ? undefined : (body.gender as "M" | "F" | undefined),
    guardianName: body.guardianName?.trim(),
    guardianPhone: body.guardianPhone?.trim(),
    serviceType: body.serviceType?.trim(),
    classDay: body.classDay?.trim(),
    counselor: body.counselor?.trim(),
    memo: body.memo?.trim(),
  });
  if (!found) {
    return NextResponse.json({ message: "아동을 찾을 수 없습니다." }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  if (!isAdminLoggedIn()) {
    return NextResponse.json({ message: "로그인이 필요합니다." }, { status: 401 });
  }

  const existing = await getChild(params.id);
  if (!existing) {
    return NextResponse.json({ message: "아동을 찾을 수 없습니다." }, { status: 404 });
  }

  await deleteChild(params.id);
  return NextResponse.json({ ok: true });
}

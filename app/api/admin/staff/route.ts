/**
 * 선생님/스태프 계정 목록 조회·생성 API (전체 관리자 전용)
 * [보안] 여기 접근은 legacy_admin이거나 staff.role==='admin'이어야만 허용 — 선생님(teacher)은 접근 불가.
 */
import { NextResponse } from "next/server";
import { getCurrentActor, isFullAdmin } from "@/lib/auth";
import { getStaffList, createStaff, getAssignedChildIds, getStaffById, writeAuditLog } from "@/lib/data";
import type { Staff } from "@/lib/types";

const VALID_ROLES: Staff["role"][] = ["admin", "teacher"];

export async function GET() {
  const actor = getCurrentActor();
  if (!isFullAdmin(actor)) {
    return NextResponse.json({ message: "권한이 없습니다." }, { status: 403 });
  }
  const staff = await getStaffList();
  const withAssignments = await Promise.all(
    staff.map(async (s) => ({ ...s, assignedChildIds: await getAssignedChildIds(s.id) }))
  );
  return NextResponse.json({ staff: withAssignments });
}

export async function POST(req: Request) {
  const actor = getCurrentActor();
  if (!isFullAdmin(actor)) {
    return NextResponse.json({ message: "권한이 없습니다." }, { status: 403 });
  }

  const body = (await req.json().catch(() => null)) as
    | { name?: string; phone?: string; password?: string; role?: string }
    | null;

  const name = body?.name?.trim();
  const phone = body?.phone?.trim();
  const password = body?.password;
  const role = body?.role;

  if (!name || !phone || !password || password.length < 4 || !role || !VALID_ROLES.includes(role as Staff["role"])) {
    return NextResponse.json({ message: "이름·전화번호·비밀번호(4자 이상)·역할을 확인해 주세요." }, { status: 400 });
  }

  try {
    const staff = await createStaff({ name, phone, password, role: role as Staff["role"] });
    const actorLabel =
      actor?.kind === "staff" ? `${(await getStaffById(actor.staffId))?.name ?? "관리자"}(${actor.role})` : "관리자(공용계정)";
    await writeAuditLog({
      actorStaffId: actor?.kind === "staff" ? actor.staffId : undefined,
      actorLabel,
      action: "staff_created",
      targetTable: "staff",
      targetId: staff.id,
      after: { name: staff.name, phone: staff.phone, role: staff.role },
    });
    return NextResponse.json({ ok: true, staff });
  } catch (e: unknown) {
    const code = (e as { code?: string })?.code;
    if (code === "23505") {
      return NextResponse.json({ message: "이미 같은 전화번호로 등록된 계정이 있습니다." }, { status: 400 });
    }
    throw e;
  }
}

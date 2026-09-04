/**
 * 담당 아동 배정/해제 (전체 관리자 전용)
 * POST { childId } — 배정, DELETE ?childId= — 해제
 */
import { NextResponse } from "next/server";
import { getCurrentActor, isFullAdmin } from "@/lib/auth";
import { assignChildToStaff, unassignChildFromStaff, getChild, getStaffById, writeAuditLog } from "@/lib/data";

async function actorLabelOf(actor: ReturnType<typeof getCurrentActor>): Promise<string> {
  return actor?.kind === "staff" ? `${(await getStaffById(actor.staffId))?.name ?? "관리자"}(${actor.role})` : "관리자(공용계정)";
}

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const actor = getCurrentActor();
  if (!isFullAdmin(actor)) {
    return NextResponse.json({ message: "권한이 없습니다." }, { status: 403 });
  }

  const body = (await req.json().catch(() => null)) as { childId?: string } | null;
  const childId = body?.childId?.trim();
  if (!childId) {
    return NextResponse.json({ message: "아이를 선택해 주세요." }, { status: 400 });
  }
  const child = await getChild(childId);
  if (!child) {
    return NextResponse.json({ message: "아이를 찾을 수 없습니다." }, { status: 404 });
  }

  await assignChildToStaff(childId, params.id);
  await writeAuditLog({
    actorStaffId: actor?.kind === "staff" ? actor.staffId : undefined,
    actorLabel: await actorLabelOf(actor),
    action: "staff_assignment_changed",
    targetTable: "child_staff_assignments",
    targetId: `${params.id}:${childId}`,
    after: { childId, staffId: params.id, childName: child.name, op: "assigned" },
  });
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  const actor = getCurrentActor();
  if (!isFullAdmin(actor)) {
    return NextResponse.json({ message: "권한이 없습니다." }, { status: 403 });
  }

  const childId = new URL(req.url).searchParams.get("childId");
  if (!childId) {
    return NextResponse.json({ message: "잘못된 요청입니다." }, { status: 400 });
  }

  await unassignChildFromStaff(childId, params.id);
  await writeAuditLog({
    actorStaffId: actor?.kind === "staff" ? actor.staffId : undefined,
    actorLabel: await actorLabelOf(actor),
    action: "staff_assignment_changed",
    targetTable: "child_staff_assignments",
    targetId: `${params.id}:${childId}`,
    after: { childId, staffId: params.id, op: "unassigned" },
  });
  return NextResponse.json({ ok: true });
}

/**
 * 선생님/스태프 계정 활성화 토글 (전체 관리자 전용)
 */
import { NextResponse } from "next/server";
import { getCurrentActor, isFullAdmin } from "@/lib/auth";
import { setStaffActive, getStaffById, writeAuditLog } from "@/lib/data";

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const actor = getCurrentActor();
  if (!isFullAdmin(actor)) {
    return NextResponse.json({ message: "권한이 없습니다." }, { status: 403 });
  }

  const body = (await req.json().catch(() => null)) as { active?: boolean } | null;
  if (typeof body?.active !== "boolean") {
    return NextResponse.json({ message: "잘못된 요청입니다." }, { status: 400 });
  }

  const before = await getStaffById(params.id);
  const found = await setStaffActive(params.id, body.active);
  if (!found) {
    return NextResponse.json({ message: "계정을 찾을 수 없습니다." }, { status: 404 });
  }

  const actorLabel =
    actor?.kind === "staff" ? `${(await getStaffById(actor.staffId))?.name ?? "관리자"}(${actor.role})` : "관리자(공용계정)";
  await writeAuditLog({
    actorStaffId: actor?.kind === "staff" ? actor.staffId : undefined,
    actorLabel,
    action: "staff_active_toggled",
    targetTable: "staff",
    targetId: params.id,
    before: { active: before?.active },
    after: { active: body.active },
  });

  return NextResponse.json({ ok: true });
}

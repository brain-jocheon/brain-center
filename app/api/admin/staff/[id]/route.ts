/**
 * 선생님/스태프 계정 활성화 토글 + 비밀번호 재설정 (전체 관리자 전용)
 * [보안 감사 후속조치] 예전엔 계정 생성 시 초기 비밀번호만 정할 수 있고, 그 뒤엔 바꿀 방법이
 * 전혀 없어서 선생님이 비밀번호를 잊으면 손 쓸 방법이 없었음 — 관리자가 새 비밀번호를
 * 직접 지정해 재설정할 수 있게 추가.
 */
import { NextResponse } from "next/server";
import { getCurrentActor, isFullAdmin } from "@/lib/auth";
import { setStaffActive, setStaffPassword, getStaffById, writeAuditLog } from "@/lib/data";

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const actor = getCurrentActor();
  if (!isFullAdmin(actor)) {
    return NextResponse.json({ message: "권한이 없습니다." }, { status: 403 });
  }

  const body = (await req.json().catch(() => null)) as { active?: boolean; newPassword?: string } | null;
  if (!body || (body.active === undefined && body.newPassword === undefined)) {
    return NextResponse.json({ message: "잘못된 요청입니다." }, { status: 400 });
  }
  if (body.newPassword !== undefined && body.newPassword.length < 4) {
    return NextResponse.json({ message: "비밀번호는 4자 이상이어야 합니다." }, { status: 400 });
  }

  const before = await getStaffById(params.id);
  if (!before) {
    return NextResponse.json({ message: "계정을 찾을 수 없습니다." }, { status: 404 });
  }

  const actorLabel =
    actor?.kind === "staff" ? `${(await getStaffById(actor.staffId))?.name ?? "관리자"}(${actor.role})` : "관리자(공용계정)";
  const actorStaffId = actor?.kind === "staff" ? actor.staffId : undefined;

  if (body.active !== undefined) {
    await setStaffActive(params.id, body.active);
    await writeAuditLog({
      actorStaffId, actorLabel, action: "staff_active_toggled", targetTable: "staff", targetId: params.id,
      before: { active: before.active }, after: { active: body.active },
    });
  }

  if (body.newPassword !== undefined) {
    await setStaffPassword(params.id, body.newPassword);
    // [보안] 비밀번호 원문은 로그에 절대 남기지 않음 — 재설정했다는 사실만 기록
    await writeAuditLog({
      actorStaffId, actorLabel, action: "staff_password_reset", targetTable: "staff", targetId: params.id,
    });
  }

  return NextResponse.json({ ok: true });
}

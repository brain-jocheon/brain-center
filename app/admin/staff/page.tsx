/**
 * 관리자: 선생님 계정 관리 (전체 관리자 전용 — middleware.ts가 teacher 역할을 이미 차단)
 * 계정 생성/활성화 토글, 담당 아동 배정을 여기서 한다.
 */
import Link from "next/link";
import { notFound } from "next/navigation";
import { getStaffList, getAssignedChildIds, getChildren } from "@/lib/data";
import { getCurrentActor, isFullAdmin } from "@/lib/auth";
import StaffManager from "@/components/admin/StaffManager";

export const dynamic = "force-dynamic";

export default async function AdminStaffPage() {
  // [보안] middleware만 믿지 않고 화면 자체에서도 관리자 여부를 확인(이중 방어)
  if (!isFullAdmin(getCurrentActor())) notFound();

  const [staffList, allChildren] = await Promise.all([getStaffList(), getChildren()]);
  const staffWithAssignments = await Promise.all(
    staffList.map(async (s) => ({ ...s, assignedChildIds: await getAssignedChildIds(s.id) }))
  );
  const childOptions = allChildren
    .filter((c) => c.status === "active")
    .map((c) => ({ id: c.id, name: c.name, grade: c.grade }));

  return (
    <main className="min-h-screen">
      <header className="bg-white border-b border-sage-100 px-6 py-4">
        <Link href="/admin" className="text-sm text-sage-600">‹ 아동 목록</Link>
        <h1 className="text-lg font-bold mt-1">선생님 계정 관리</h1>
        <p className="text-sm text-ink/50 mt-1">
          선생님 계정을 만들고, 담당 아동을 배정하세요. 담당으로 배정된 아이의 자료만 그 선생님에게 보입니다.
        </p>
      </header>

      <div className="max-w-3xl mx-auto px-5 py-8">
        <StaffManager staffList={staffWithAssignments} childOptions={childOptions} />
      </div>
    </main>
  );
}

/**
 * 관리자: 보강 희망일 요청 확인/승인/거절
 */
import Link from "next/link";
import { getMakeupRequests, getChildren } from "@/lib/data";
import MakeupRequestList from "@/components/admin/MakeupRequestList";
import type { MakeupRequest } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function MakeupRequestsPage() {
  const children = await getChildren();
  const childNames: Record<string, { name: string; grade: string }> = Object.fromEntries(
    children.map((c) => [c.id, { name: c.name, grade: c.grade }])
  );

  // [주의] makeup_requests 테이블 마이그레이션 전이어도 이 페이지가 깨지지 않게 별도 처리
  let requests: MakeupRequest[] = [];
  try {
    requests = await getMakeupRequests();
  } catch {
    // makeup_requests 테이블 마이그레이션 전 — 빈 목록으로 대체
  }

  return (
    <main className="min-h-screen">
      <header className="bg-white border-b border-sage-100 px-6 py-4">
        <Link href="/admin" className="text-sm text-sage-600">‹ 아동 목록</Link>
        <h1 className="text-lg font-bold mt-1">보강 희망일 요청</h1>
        <p className="text-sm text-ink/50 mt-1">
          학부모가 결석일에 제안한 보강 날짜예요. 승인하면 해당 아이의 출결 기록에 바로 반영됩니다.
        </p>
      </header>

      <div className="max-w-3xl mx-auto px-5 py-8">
        <MakeupRequestList requests={requests} childNames={childNames} />
      </div>
    </main>
  );
}

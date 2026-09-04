/**
 * 관리자: 감사로그 조회 (전체 관리자 전용 — middleware.ts가 teacher 역할을 이미 차단)
 * [14단계] 로그인 성공/실패, 계정 생성·활성화, 담당 배정 변경, 아동/뇌기능검사 삭제 등
 * "실제로 의미있는" 보안·계정 이벤트만 기록한다(모든 API를 계측하지 않음).
 */
import Link from "next/link";
import { getAuditLogs } from "@/lib/data";
import AuditLogList from "@/components/admin/AuditLogList";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 50;

export default async function AuditLogsPage({
  searchParams,
}: {
  searchParams: { action?: string; targetTable?: string; offset?: string };
}) {
  const offset = Math.max(0, Number(searchParams.offset) || 0);
  const action = searchParams.action || undefined;
  const targetTable = searchParams.targetTable || undefined;
  const logs = await getAuditLogs({ limit: PAGE_SIZE, offset, action, targetTable });

  return (
    <main className="min-h-screen">
      <header className="bg-white border-b border-sage-100 px-6 py-4">
        <Link href="/admin" className="text-sm text-sage-600">‹ 아동 목록</Link>
        <h1 className="text-lg font-bold mt-1">감사로그</h1>
        <p className="text-sm text-ink/50 mt-1">
          로그인 성공/실패, 계정 생성·활성화, 담당 배정 변경, 아동·뇌기능검사 삭제 등 보안 관련 이벤트만 기록됩니다.
        </p>
      </header>

      <div className="max-w-5xl mx-auto px-5 py-8">
        <AuditLogList logs={logs} action={action} targetTable={targetTable} offset={offset} pageSize={PAGE_SIZE} />
      </div>
    </main>
  );
}

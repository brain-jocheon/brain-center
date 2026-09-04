/**
 * 감사로그 목록 — 쓰기 동작이 전혀 없는 순수 조회 화면이라 서버 컴포넌트 + GET 폼/링크로만
 * 필터·페이지네이션을 구현한다(클라이언트 fetch 없음, 별도 API 라우트 불필요).
 */
import type { AuditLog } from "@/lib/types";

const ACTION_LABEL: Record<string, string> = {
  admin_login_success: "관리자 로그인 성공",
  admin_login_failed: "관리자 로그인 실패",
  staff_login_success: "선생님 로그인 성공",
  staff_login_failed: "선생님 로그인 실패",
  staff_created: "선생님 계정 생성",
  staff_active_toggled: "선생님 계정 활성화 변경",
  staff_assignment_changed: "담당 아동 배정 변경",
  child_deleted: "아동 삭제",
  brain_test_deleted: "뇌기능검사 삭제",
};

const TARGET_TABLES = ["staff", "children", "brain_tests", "child_staff_assignments"];

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("ko-KR", { hour12: false });
}

function buildUrl(offset: number, action?: string, targetTable?: string): string {
  const params = new URLSearchParams();
  if (action) params.set("action", action);
  if (targetTable) params.set("targetTable", targetTable);
  if (offset > 0) params.set("offset", String(offset));
  const qs = params.toString();
  return `/admin/audit-logs${qs ? `?${qs}` : ""}`;
}

export default function AuditLogList({
  logs,
  action,
  targetTable,
  offset,
  pageSize,
}: {
  logs: AuditLog[];
  action?: string;
  targetTable?: string;
  offset: number;
  pageSize: number;
}) {
  return (
    <div className="space-y-4">
      <form method="get" className="card flex flex-wrap gap-3 items-end">
        <label className="text-sm">
          <span className="block text-xs text-ink/50 mb-1">행위</span>
          <select name="action" defaultValue={action ?? ""} className="input !py-1.5 text-sm">
            <option value="">전체</option>
            {Object.entries(ACTION_LABEL).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </label>
        <label className="text-sm">
          <span className="block text-xs text-ink/50 mb-1">대상 테이블</span>
          <select name="targetTable" defaultValue={targetTable ?? ""} className="input !py-1.5 text-sm">
            <option value="">전체</option>
            {TARGET_TABLES.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </label>
        <button type="submit" className="btn-primary text-sm">필터 적용</button>
        {(action || targetTable) && (
          <a href="/admin/audit-logs" className="btn-ghost text-sm">초기화</a>
        )}
      </form>

      {logs.length === 0 ? (
        <p className="text-sm text-ink/50 py-8 text-center">기록이 없습니다.</p>
      ) : (
        <div className="space-y-2">
          {logs.map((log) => (
            <div key={log.id} className="card !py-3">
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <span className="text-ink/40">{formatDateTime(log.createdAt)}</span>
                <span className="font-medium">{ACTION_LABEL[log.action] ?? log.action}</span>
                <span className="text-ink/50">{log.actorLabel ?? "—"}</span>
                <span className="text-ink/40 text-xs">
                  {log.targetTable}{log.targetId ? `#${log.targetId}` : ""}
                </span>
              </div>
              {(log.before || log.after) && (
                <details className="mt-2 text-xs text-ink/60">
                  <summary className="cursor-pointer">상세 보기</summary>
                  {log.before && (
                    <pre className="whitespace-pre-wrap break-all bg-linen rounded p-2 mt-1">
                      이전: {JSON.stringify(log.before, null, 2)}
                    </pre>
                  )}
                  {log.after && (
                    <pre className="whitespace-pre-wrap break-all bg-linen rounded p-2 mt-1">
                      이후: {JSON.stringify(log.after, null, 2)}
                    </pre>
                  )}
                </details>
              )}
            </div>
          ))}
        </div>
      )}

      <div className="flex justify-between text-sm">
        {offset > 0 ? (
          <a href={buildUrl(Math.max(0, offset - pageSize), action, targetTable)} className="btn-ghost">‹ 이전</a>
        ) : <span />}
        {logs.length === pageSize && (
          <a href={buildUrl(offset + pageSize, action, targetTable)} className="btn-ghost">더 보기 ›</a>
        )}
      </div>
    </div>
  );
}

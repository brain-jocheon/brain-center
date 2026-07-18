/**
 * 관리자: 학부모 접속 기록
 * ---------------------------------------------------------------------
 * access_logs(모든 학부모 링크 열람 시도)를 아이 이름과 묶어서 보여줍니다.
 * 성공한 시도만 "누가 들어왔는지"에 집계하고, 실패 시도는 참고용으로 아래
 * 원본 기록에서만 노출합니다(비밀번호 오답 등은 아이를 특정할 수 없음).
 */
import Link from "next/link";
import { getChildren, getRecentAccessLogs, summarizeVisitsByChild } from "@/lib/data";
import type { AccessLogEntry } from "@/lib/types";

export const dynamic = "force-dynamic";

function startOfToday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

function formatDateTime(iso: string): string {
  const d = new Date(iso);
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const mi = String(d.getMinutes()).padStart(2, "0");
  return `${mm}.${dd} ${hh}:${mi}`;
}

export default async function AdminVisitsPage() {
  const children = await getChildren();
  const activeChildren = children.filter((c) => c.status !== "ended");

  let logs: AccessLogEntry[] = [];
  try {
    logs = await getRecentAccessLogs(500);
  } catch {
    // access_logs 조회 실패해도(마이그레이션 전 등) 이 페이지가 깨지지 않게 대체
  }

  const visits = summarizeVisitsByChild(logs);

  const today = startOfToday();
  const weekAgo = new Date(today.getTime() - 6 * 24 * 60 * 60 * 1000);
  const successToday = logs.filter((l) => l.success && new Date(l.viewedAt) >= today).length;
  const successThisWeek = logs.filter((l) => l.success && new Date(l.viewedAt) >= weekAgo).length;
  const failedRecent = logs.filter((l) => !l.success).length;

  return (
    <main className="min-h-screen">
      <header className="bg-white border-b border-sage-100 px-6 py-4">
        <Link href="/admin" className="text-sm text-sage-600">‹ 아동 목록</Link>
        <h1 className="text-lg font-bold mt-1">학부모 접속 기록</h1>
        <p className="text-sm text-ink/50 mt-1">
          학부모가 결과지 링크로 들어온 기록이에요. 최근 500건 기준으로 집계합니다.
        </p>
      </header>

      <div className="max-w-3xl mx-auto px-5 py-8 space-y-8">
        <section className="grid grid-cols-3 gap-3">
          <div className="card text-center py-5">
            <p className="text-2xl font-bold text-sage-700">{successToday}</p>
            <p className="text-xs text-ink/50 mt-1">오늘 접속</p>
          </div>
          <div className="card text-center py-5">
            <p className="text-2xl font-bold text-sage-700">{successThisWeek}</p>
            <p className="text-xs text-ink/50 mt-1">최근 7일 접속</p>
          </div>
          <div className="card text-center py-5">
            <p className="text-2xl font-bold text-sage-700">
              {visits.length}
              <span className="text-sm font-normal text-ink/40">/{activeChildren.length}</span>
            </p>
            <p className="text-xs text-ink/50 mt-1">접속한 아이 수</p>
          </div>
        </section>

        <section>
          <p className="section-label mb-3">아이별 접속 현황</p>
          {visits.length === 0 ? (
            <p className="text-sm text-ink/50 py-8 text-center card">아직 접속 기록이 없습니다.</p>
          ) : (
            <div className="space-y-2">
              {visits.map((v) => (
                <div key={v.childId} className="card flex items-center justify-between gap-3 !py-3.5">
                  <div>
                    <Link href={`/admin/children/${v.childId}`} className="font-bold text-sage-700 hover:underline">
                      {v.childName}
                    </Link>
                    <span className="text-ink/40 text-sm ml-1.5">{v.childGrade}</span>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-xs text-ink/70">최근 {formatDateTime(v.lastVisitedAt)}</p>
                    <p className="text-[11px] text-ink/40 mt-0.5">총 {v.visitCount}회 접속</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <details className="text-sm">
          <summary className="text-ink/50 cursor-pointer select-none">
            원본 기록 전체 보기 (실패 시도 {failedRecent}건 포함)
          </summary>
          <div className="mt-4 space-y-1.5">
            {logs.map((l) => (
              <div
                key={l.id}
                className={`flex items-center justify-between gap-3 rounded-lg px-3 py-2 text-xs ${
                  l.success ? "bg-sage-50" : "bg-apricot-50"
                }`}
              >
                <span className={l.success ? "text-sage-700" : "text-apricot-600"}>
                  {l.success ? "성공" : "실패"}
                  {l.childName && ` · ${l.childName} ${l.childGrade ?? ""}`}
                </span>
                <span className="text-ink/40 shrink-0">{formatDateTime(l.viewedAt)}</span>
              </div>
            ))}
          </div>
        </details>
      </div>
    </main>
  );
}

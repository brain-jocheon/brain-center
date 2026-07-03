/**
 * 관리자: 아동 상세 (검사 이력 + 학부모 링크 관리)
 * 서술형 기질검사(reports.json)와 MT-PRIS(mtpris-reports.json) 리포트를
 * 검사일 기준으로 함께 나열합니다.
 */
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  getChild, getReportsByChild, getMtprisReportsByChild, getAccessTokens,
} from "@/lib/data";
import { CANONICAL_NAMES } from "@/lib/content/mtpris/types";
import AccessLinkPanel from "@/components/admin/AccessLinkPanel";
import ChildManagePanel from "@/components/admin/ChildManagePanel";

export const dynamic = "force-dynamic";

type TimelineItem =
  | { kind: "temperament"; id: string; testDate: string; counselor: string; status: string; title: string; editHref: string; printHref: string }
  | { kind: "mtpris"; id: string; testDate: string; counselor: string; status: string; title: string; editHref: string; printHref: string; memoPublic: boolean; hasMemo: boolean };

export default async function ChildDetail({ params }: { params: { id: string } }) {
  const child = await getChild(params.id);
  if (!child) notFound();

  const [reports, mtprisReports, tokens] = await Promise.all([
    getReportsByChild(child.id),
    getMtprisReportsByChild(child.id),
    getAccessTokens(),
  ]);

  const items: TimelineItem[] = [
    ...reports.map((r) => ({
      kind: "temperament" as const,
      id: r.id,
      testDate: r.testDate,
      counselor: r.counselor,
      status: r.status,
      title: r.testTypeName,
      editHref: `/admin/children/${child.id}/reports/${r.id}/edit`,
      printHref: `/admin/children/${child.id}/reports/${r.id}/print`,
    })),
    ...mtprisReports.map((r) => ({
      kind: "mtpris" as const,
      id: r.id,
      testDate: r.testDate,
      counselor: r.counselor,
      status: r.status,
      title: `다원재능 MT-PRIS (${r.mainType} ${CANONICAL_NAMES[r.mainType]})`,
      editHref: `/admin/children/${child.id}/mtpris/${r.id}/edit`,
      printHref: `/admin/children/${child.id}/mtpris/${r.id}/print`,
      memoPublic: r.memoPublic,
      hasMemo: !!r.memo,
    })),
  ].sort((a, b) => (a.testDate < b.testDate ? 1 : -1));

  return (
    <main className="min-h-screen">
      <header className="bg-white border-b border-sage-100 px-6 py-4">
        <Link href="/admin" className="text-sm text-sage-600">‹ 아동 목록</Link>
        <div className="flex items-center justify-between flex-wrap gap-3 mt-1">
          <h1 className="text-lg font-bold">
            {child.name} <span className="font-normal text-ink/50 text-base">{child.grade}</span>
          </h1>
          <ChildManagePanel childId={child.id} childName={child.name} status={child.status} />
        </div>
      </header>

      <div className="max-w-3xl mx-auto px-5 py-8 space-y-5">
        {items.length === 0 && (
          <div className="card text-center text-sm text-ink/50 py-10">
            아직 등록된 검사가 없습니다.
            <br />
            Supabase의 reports 또는 mtpris_reports 테이블에 항목을 추가하면 여기 표시됩니다. (README 참고)
          </div>
        )}

        {items.map((r) => {
          const access = tokens.find((t) => t.reportId === r.id && t.active);
          return (
            <section key={`${r.kind}-${r.id}`} className="card">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div>
                  <p className="font-bold flex items-center gap-2">
                    {r.title}
                    {r.kind === "mtpris" && (
                      <span className="text-[10px] bg-sage-100 text-sage-700 rounded-full px-2 py-0.5 font-medium">MT-PRIS</span>
                    )}
                  </p>
                  <p className="text-sm text-ink/60 mt-0.5">
                    검사일 {r.testDate} · 담당 {r.counselor} ·{" "}
                    <span className={r.status === "published" ? "text-sage-600" : "text-apricot-600"}>
                      {r.status === "published" ? "공개됨" : "작성 중"}
                    </span>
                    {r.kind === "mtpris" && r.hasMemo && (
                      <>
                        {" · "}
                        <span className={r.memoPublic ? "text-sage-600" : "text-ink/40"}>
                          메모 {r.memoPublic ? "공개" : "비공개"}
                        </span>
                      </>
                    )}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Link href={r.editHref} className="btn-ghost text-sm">수정</Link>
                  <Link href={r.printHref} className="btn-primary text-sm !py-2.5">인쇄 / PDF</Link>
                </div>
              </div>

              {/* 학부모 링크 */}
              <AccessLinkPanel
                reportId={r.id}
                reportKind={r.kind}
                active={access ? { token: access.token } : null}
              />
            </section>
          );
        })}
      </div>
    </main>
  );
}

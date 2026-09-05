import Link from "next/link";
import { notFound } from "next/navigation";
import { getChild, getReport } from "@/lib/data";
import { getCurrentActor, isFullAdmin } from "@/lib/auth";
import ReportEditForm from "@/components/ReportEditForm";

export const dynamic = "force-dynamic";

export default async function EditReportPage({
  params,
}: {
  params: { id: string; reportId: string };
}) {
  // [보안] 서술형 리포트 수정은 관리자 전용(PUT /api/admin/reports도 동일) — URL 직접 접근 차단
  if (!isFullAdmin(getCurrentActor())) notFound();

  const child = await getChild(params.id);
  const report = await getReport(params.reportId);
  if (!child || !report || report.childId !== child.id) notFound();

  return (
    <main className="min-h-screen pb-24">
      <header className="bg-white border-b border-sage-100 px-6 py-4">
        <Link href={`/admin/children/${child.id}`} className="text-sm text-sage-600">
          ‹ {child.name} 상세
        </Link>
        <h1 className="text-lg font-bold mt-1">
          {report.testTypeName} 결과 입력 · {child.name}
        </h1>
      </header>
      <div className="max-w-3xl mx-auto px-5 py-8">
        <ReportEditForm initial={report} />
      </div>
    </main>
  );
}

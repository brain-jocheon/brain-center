import Link from "next/link";
import { notFound } from "next/navigation";
import { getChild, getMtprisReport } from "@/lib/data";
import MtprisEditForm from "@/components/mtpris/MtprisEditForm";

export const dynamic = "force-dynamic";

export default async function EditMtprisPage({
  params,
}: {
  params: { id: string; reportId: string };
}) {
  const child = await getChild(params.id);
  const report = await getMtprisReport(params.reportId);
  if (!child || !report || report.childId !== child.id) notFound();

  return (
    <main className="min-h-screen pb-24">
      <header className="bg-white border-b border-sage-100 px-6 py-4">
        <Link href={`/admin/children/${child.id}`} className="text-sm text-sage-600">
          ‹ {child.name} 상세
        </Link>
        <h1 className="text-lg font-bold mt-1">
          MT-PRIS 결과 입력 · {child.name}
        </h1>
      </header>
      <div className="max-w-3xl mx-auto px-5 py-8">
        <MtprisEditForm initial={report} />
      </div>
    </main>
  );
}

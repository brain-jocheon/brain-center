/**
 * 관리자 홈: 아동 목록
 * (미들웨어가 로그인 여부를 검사하므로 이 페이지에 도달하면 이미 인증됨)
 */
import Link from "next/link";
import { getChildren, getReportsByChild, getMtprisReportsByChild } from "@/lib/data";
import LogoutButton from "@/components/LogoutButton";
import AddChildForm from "@/components/admin/AddChildForm";

export const dynamic = "force-dynamic";

export default async function AdminHome() {
  const children = await getChildren();
  const withReports = await Promise.all(
    children.map(async (c) => {
      const [reports, mtprisReports] = await Promise.all([
        getReportsByChild(c.id),
        getMtprisReportsByChild(c.id),
      ]);
      const dates = [...reports.map((r) => r.testDate), ...mtprisReports.map((r) => r.testDate)].sort();
      return { child: c, count: reports.length + mtprisReports.length, latest: dates[dates.length - 1] };
    })
  );

  return (
    <main className="min-h-screen">
      <header className="bg-white border-b border-sage-100 px-6 py-4 flex items-center justify-between">
        <div>
          <p className="section-label">학습심리브레인센터 관리자</p>
          <h1 className="text-lg font-bold">아동 목록</h1>
        </div>
        <LogoutButton />
      </header>

      <div className="max-w-3xl mx-auto px-5 py-8">
        <p className="text-sm text-ink/50 mb-5">
          아동을 선택하면 검사 이력, 학부모 링크, 결과지 인쇄로 이동할 수 있습니다.
        </p>
        <ul className="space-y-4">
          {withReports.map(({ child, count, latest }) => (
            <li key={child.id}>
              <Link href={`/admin/children/${child.id}`} className="card block hover:border-sage-400 transition-colors">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-bold text-lg">{child.name}</p>
                    <p className="text-sm text-ink/60 mt-0.5">
                      {child.grade} · 검사 {count}건
                      {latest && ` · 최근 ${latest}`}
                    </p>
                  </div>
                  <span className="text-sage-400 text-xl">›</span>
                </div>
              </Link>
            </li>
          ))}
        </ul>
        <div className="mt-8">
          <AddChildForm />
        </div>
      </div>
    </main>
  );
}

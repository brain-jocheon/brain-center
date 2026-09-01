/**
 * 관리자 홈: 아동 목록
 * (미들웨어가 로그인 여부를 검사하므로 이 페이지에 도달하면 이미 인증됨)
 */
import Link from "next/link";
import { getChildren, getReportsByChild, getMtprisReportsByChild, countPendingMakeupRequests, countPendingParentFeedback, countPendingConsultations, getDashboardSummary } from "@/lib/data";
import type { DashboardSummary } from "@/lib/types";
import LogoutButton from "@/components/LogoutButton";
import AddChildForm from "@/components/admin/AddChildForm";
import AddChildWithMtprisForm from "@/components/admin/AddChildWithMtprisForm";
import ChildListSection from "@/components/admin/ChildListSection";

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

  // [주의] makeup_requests/parent_feedback 테이블 마이그레이션 전이어도 이 페이지가 깨지지 않게 별도 처리
  let pendingMakeupCount = 0;
  try {
    pendingMakeupCount = await countPendingMakeupRequests();
  } catch {
    // makeup_requests 테이블 마이그레이션 전 — 0으로 대체
  }
  let pendingFeedbackCount = 0;
  try {
    pendingFeedbackCount = await countPendingParentFeedback();
  } catch {
    // parent_feedback 테이블 마이그레이션 전 — 0으로 대체
  }
  let pendingConsultationCount = 0;
  try {
    pendingConsultationCount = await countPendingConsultations();
  } catch {
    // consultations 테이블 마이그레이션 전 — 0으로 대체
  }

  let summary: DashboardSummary = {
    activeCount: 0, waitingCount: 0, endedCount: 0, newThisWeek: 0, todayClassCount: 0, recentPhotosCount: 0,
  };
  try {
    summary = await getDashboardSummary();
  } catch {
    // 집계 실패해도 아동 목록 자체는 그대로 보이게 기본값으로 대체
  }

  return (
    <main className="min-h-screen">
      <header className="bg-white border-b border-sage-100 px-6 py-4 flex items-center justify-between">
        <div>
          <p className="section-label">학습심리브레인센터 관리자</p>
          <h1 className="text-lg font-bold">아동 목록</h1>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/admin/consultations" className="btn-ghost text-sm relative">
            상담 신청
            {pendingConsultationCount > 0 && (
              <span className="absolute -top-1.5 -right-1.5 bg-apricot-500 text-white text-[10px] rounded-full w-4 h-4 flex items-center justify-center font-bold">
                {pendingConsultationCount}
              </span>
            )}
          </Link>
          <Link href="/admin/makeup-requests" className="btn-ghost text-sm relative">
            보강 요청
            {pendingMakeupCount > 0 && (
              <span className="absolute -top-1.5 -right-1.5 bg-apricot-500 text-white text-[10px] rounded-full w-4 h-4 flex items-center justify-center font-bold">
                {pendingMakeupCount}
              </span>
            )}
          </Link>
          <Link href="/admin/feedback" className="btn-ghost text-sm relative">
            학부모 문의
            {pendingFeedbackCount > 0 && (
              <span className="absolute -top-1.5 -right-1.5 bg-apricot-500 text-white text-[10px] rounded-full w-4 h-4 flex items-center justify-center font-bold">
                {pendingFeedbackCount}
              </span>
            )}
          </Link>
          <Link href="/admin/visits" className="btn-ghost text-sm">접속 기록</Link>
          <Link href="/admin/site" className="btn-ghost text-sm">홈페이지 관리</Link>
          <Link href="/admin/blog" className="btn-ghost text-sm">센터 소식 관리</Link>
          <Link href="/admin/parent-notices" className="btn-ghost text-sm">학부모 공지</Link>
          <LogoutButton />
        </div>
      </header>

      <div className="max-w-3xl mx-auto px-5 py-8">
        <section className="grid grid-cols-3 sm:grid-cols-6 gap-2.5 mb-8">
          <DashboardStat label="이용중" value={summary.activeCount} />
          <DashboardStat label="대기" value={summary.waitingCount} />
          <DashboardStat label="종결" value={summary.endedCount} />
          <DashboardStat label="오늘 수업 예정" value={summary.todayClassCount} />
          <DashboardStat label="이번주 신규" value={summary.newThisWeek} />
          <DashboardStat label="최근 7일 사진" value={summary.recentPhotosCount} />
        </section>

        <p className="text-sm text-ink/50 mb-5">
          아동을 선택하면 검사 이력, 학부모 링크, 결과지 인쇄로 이동할 수 있습니다.
        </p>

        <div className="mb-8 flex flex-wrap items-start gap-3">
          <Link href="/admin/class-records/new" className="btn-primary text-sm">+ 수업 기록 등록</Link>
          <AddChildWithMtprisForm />
          <AddChildForm />
        </div>

        <ChildListSection items={withReports} />
      </div>
    </main>
  );
}

function DashboardStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="card !p-3 text-center">
      <p className="text-xl font-bold text-sage-700">{value}</p>
      <p className="text-[11px] text-ink/50 mt-0.5 leading-snug">{label}</p>
    </div>
  );
}

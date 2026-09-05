/**
 * 관리자: 상담 신청 확인/처리
 */
import Link from "next/link";
import { notFound } from "next/navigation";
import { getConsultations } from "@/lib/data";
import { getCurrentActor, isFullAdmin } from "@/lib/auth";
import ConsultationList from "@/components/admin/ConsultationList";
import type { Consultation } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function AdminConsultationsPage() {
  // [보안] middleware만 믿지 않고 화면 자체에서도 관리자 여부를 확인(이중 방어)
  if (!isFullAdmin(getCurrentActor())) notFound();

  // [주의] consultations 테이블 마이그레이션 전이어도 이 페이지가 깨지지 않게 별도 처리
  let consultations: Consultation[] = [];
  try {
    consultations = await getConsultations();
  } catch {
    // consultations 테이블 마이그레이션 전 — 빈 목록으로 대체
  }

  return (
    <main className="min-h-screen">
      <header className="bg-white border-b border-sage-100 px-6 py-4">
        <Link href="/admin" className="text-sm text-sage-600">‹ 아동 목록</Link>
        <h1 className="text-lg font-bold mt-1">상담 신청</h1>
        <p className="text-sm text-ink/50 mt-1">
          홈페이지에서 접수된 상담 신청이에요. 상태를 바꾸며 진행 상황을 관리해 주세요.
        </p>
      </header>

      <div className="max-w-3xl mx-auto px-5 py-8">
        <ConsultationList consultations={consultations} />
      </div>
    </main>
  );
}

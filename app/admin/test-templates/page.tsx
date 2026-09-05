/**
 * 관리자: 검사 템플릿 관리 (전체 관리자 전용 — 뇌기능검사와 동일하게 8단계부터 관리자 전용)
 * 검사종류별 지표 기준(정상범위·방향성)·AI 해석지침을 여기서 설정한다.
 * AI 검사해석/검사변화비교 화면 모두 이 설정을 참고한다.
 */
import Link from "next/link";
import { notFound } from "next/navigation";
import { getEegTestTemplates, getBrainTestTypes } from "@/lib/data";
import { getCurrentActor, isFullAdmin } from "@/lib/auth";
import TestTemplateManager from "@/components/admin/TestTemplateManager";

export const dynamic = "force-dynamic";

export default async function TestTemplatesPage() {
  // [보안] 주석대로 관리자 전용인데 여태 화면/미들웨어 어디에도 확인이 없었음 — 추가
  if (!isFullAdmin(getCurrentActor())) notFound();

  const [templates, testTypeSuggestions] = await Promise.all([getEegTestTemplates(), getBrainTestTypes()]);

  return (
    <main className="min-h-screen">
      <header className="bg-white border-b border-sage-100 px-6 py-4">
        <Link href="/admin" className="text-sm text-sage-600">‹ 아동 목록</Link>
        <h1 className="text-lg font-bold mt-1">검사 템플릿 관리</h1>
        <p className="text-sm text-ink/50 mt-1">
          검사종류별로 지표의 정상범위·방향성(높을수록/낮을수록 좋음/기준없음)을 설정하면 AI 해석과 검사변화비교 화면에서 사용됩니다.
          기준이 없는 지표는 "기준없음"으로 두면 좋다/나쁘다 판정 없이 증감만 표시됩니다.
        </p>
      </header>

      <div className="max-w-3xl mx-auto px-5 py-8">
        <TestTemplateManager templates={templates} testTypeSuggestions={testTypeSuggestions} />
      </div>
    </main>
  );
}

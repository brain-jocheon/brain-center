/**
 * =====================================================================
 * 인쇄용 결과지 (A4)
 * ---------------------------------------------------------------------
 * - 관리자 전용 화면입니다. 학부모에게는 인쇄 기능을 제공하지 않으며,
 *   출력본은 상담 시 센터에서 직접 전달합니다. (개인정보 유출 방지)
 * - 사용법: [인쇄하기] 버튼 → 브라우저 인쇄 창 → 프린터 출력 또는 "PDF로 저장"
 * - A4 규격/여백/페이지 나눔은 app/globals.css의 인쇄 스타일에 정의
 * - 인쇄물에는 실명이 표기됩니다 (센터가 직접 전달하는 공식 문서이므로)
 * =====================================================================
 */
import { notFound } from "next/navigation";
import { getChild, getReport } from "@/lib/data";
import ScoreBars from "@/components/ScoreBars";
import PrintToolbar from "@/components/PrintToolbar";

export const dynamic = "force-dynamic";

export default async function PrintReportPage({
  params,
}: {
  params: { id: string; reportId: string };
}) {
  const child = await getChild(params.id);
  const report = await getReport(params.reportId);
  if (!child || !report || report.childId !== child.id) notFound();

  return (
    <div className="min-h-screen bg-sage-50/60 py-8 print:py-0 print:bg-white">
      {/* 화면에서만 보이는 도구 막대 */}
      <PrintToolbar backHref={`/admin/children/${child.id}`} />

      {/* ===== A4 용지 ===== */}
      <div className="print-sheet text-[13px] leading-relaxed">
        {/* 머리글 */}
        <header className="border-b-2 border-sage-700 pb-4 mb-6">
          <p className="text-[11px] tracking-[0.25em] text-sage-600 font-semibold mb-1">
            학습심리브레인센터
          </p>
          <h1 className="text-[22px] font-bold text-sage-800">
            {report.testTypeName} 결과 리포트
          </h1>
          <table className="w-full mt-4 text-[12px]">
            <tbody>
              <tr>
                <InfoCell label="아동 이름" value={child.name} />
                <InfoCell label="학년" value={child.grade} />
                <InfoCell label="검사일" value={report.testDate} />
              </tr>
              <tr>
                <InfoCell label="검사 종류" value={report.testTypeName} />
                <InfoCell label="담당자" value={report.counselor} />
                <InfoCell label="발행" value="학습심리브레인센터" />
              </tr>
            </tbody>
          </table>
        </header>

        {/* 1. 핵심 요약 */}
        <section className="avoid-break mb-6">
          <SectionTitle no="1" title="핵심 요약" />
          <p className="mb-3">{report.summary.headline}</p>
          <p className="mb-3">
            <strong className="text-sage-800">대표 기질:</strong> {report.summary.mainTemperament}
          </p>
          <div className="grid grid-cols-2 gap-4">
            <div className="rounded-lg border border-sage-200 p-3">
              <p className="font-bold text-sage-700 mb-1.5">현재 강점</p>
              <PrintList items={report.summary.strengths} />
            </div>
            <div className="rounded-lg border border-apricot-100 p-3">
              <p className="font-bold text-apricot-600 mb-1.5">성장 과제</p>
              <PrintList items={report.summary.growthAreas} />
            </div>
          </div>
        </section>

        {/* 2. 척도 프로필 */}
        {report.scores.length > 0 && (
          <section className="avoid-break mb-6">
            <SectionTitle no="2" title="기질 척도 프로필" />
            <p className="text-[11px] text-ink/50 mb-3">
              ※ 점수는 좋고 나쁨이 아니라 아이의 고유한 성향을 나타냅니다.
            </p>
            <ScoreBars scores={report.scores} compact />
          </section>
        )}

        {/* 3. 세부 해석 */}
        <section className="mb-6">
          <SectionTitle no="3" title="세부 해석" />
          <div className="space-y-3">
            {report.details.map((d) => (
              <div key={d.key} className="avoid-break">
                <p className="font-bold text-sage-800">{d.title}</p>
                <p>{d.content}</p>
              </div>
            ))}
          </div>
        </section>

        {/* 4. 부모님 가이드 — 새 페이지에서 시작 */}
        <section className="page-break mb-6">
          <SectionTitle no="4" title="부모님 가이드" />
          <div className="grid grid-cols-2 gap-4">
            <PrintGuide title="가정에서 도움이 되는 말" items={report.parentGuide.helpfulWords} />
            <PrintGuide title="피하면 좋은 반응" items={report.parentGuide.avoidReactions} />
            <PrintGuide title="학습 지도 팁" items={report.parentGuide.learningTips} />
            <PrintGuide title="정서 지도 팁" items={report.parentGuide.emotionTips} />
          </div>
        </section>

        {/* 5. 센터 지도 방향 */}
        <section className="avoid-break mb-8">
          <SectionTitle no="5" title="센터 지도 방향" />
          <div className="grid grid-cols-3 gap-4">
            <PrintGuide title="중점 지도 영역" items={report.centerPlan.focusAreas} />
            <PrintGuide title="추천 활동" items={report.centerPlan.activities} />
            <PrintGuide title="다음 상담 확인 사항" items={report.centerPlan.nextCheckpoints} />
          </div>
        </section>

        {/* 바닥글 — [보안] 고지 문구, 삭제하지 마세요 */}
        <footer className="border-t border-sage-200 pt-3 text-center text-[10px] text-ink/50">
          본 결과지는 보호자 상담 및 가정 지도 참고용이며, 외부 공유를 삼가 주세요.
          <span className="mx-2">|</span>ⓒ 학습심리브레인센터
        </footer>
      </div>
    </div>
  );
}

function SectionTitle({ no, title }: { no: string; title: string }) {
  return (
    <h2 className="flex items-center gap-2 text-[15px] font-bold text-sage-800 mb-2.5">
      <span
        className="inline-flex w-5 h-5 items-center justify-center rounded-full bg-sage-700 text-white text-[11px]"
        style={{ printColorAdjust: "exact", WebkitPrintColorAdjust: "exact" }}
      >
        {no}
      </span>
      {title}
    </h2>
  );
}

function InfoCell({ label, value }: { label: string; value: string }) {
  return (
    <>
      <td className="py-1 pr-2 text-ink/50 whitespace-nowrap w-[70px]">{label}</td>
      <td className="py-1 pr-6 font-medium">{value}</td>
    </>
  );
}

function PrintList({ items }: { items: string[] }) {
  return (
    <ul className="space-y-1">
      {items.map((s, i) => (
        <li key={i} className="flex gap-1.5">
          <span className="text-ink/40">·</span>
          <span>{s}</span>
        </li>
      ))}
    </ul>
  );
}

function PrintGuide({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="avoid-break rounded-lg border border-sage-100 p-3">
      <p className="font-bold text-sage-700 mb-1.5">{title}</p>
      <PrintList items={items} />
    </div>
  );
}

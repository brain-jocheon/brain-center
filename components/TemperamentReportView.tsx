"use client";

/**
 * 서술형 기질검사 결과 표시 (기존 ParentReportViewer의 화면 부분을 그대로 분리)
 */
import type { MaskedReport } from "@/lib/types";
import ScoreBars from "./ScoreBars";

export default function TemperamentReportView({ report }: { report: MaskedReport }) {
  return (
    <main className="min-h-screen pb-14">
      <header className="bg-sage-700 text-white px-6 pt-10 pb-14 rounded-b-[2rem]">
        <div className="max-w-md mx-auto">
          <p className="text-xs tracking-widest opacity-80 mb-2">학습심리브레인센터</p>
          <h1 className="text-2xl font-bold leading-snug">
            {report.childMaskedName} 어린이의
            <br />
            {report.testTypeName} 결과 리포트
          </h1>
          <p className="mt-4 text-sm opacity-85">
            {report.childGrade} · 검사일 {report.testDate} · 담당 {report.counselor}
          </p>
        </div>
      </header>

      <div className="max-w-md mx-auto px-5 -mt-6 space-y-5">
        <section className="card avoid-break">
          <p className="section-label mb-2">한눈에 보는 우리 아이</p>
          <p className="leading-relaxed">{report.summary.headline}</p>
          <div className="mt-4 rounded-xl bg-sage-50 px-4 py-3 text-sm">
            <span className="text-sage-700 font-semibold">대표 기질 · </span>
            {report.summary.mainTemperament}
          </div>
        </section>

        <section className="card">
          <p className="section-label mb-3">지금 빛나는 강점</p>
          <ul className="space-y-2.5">
            {report.summary.strengths.map((s, i) => (
              <li key={i} className="flex gap-2.5 text-[15px] leading-relaxed">
                <span className="text-sage-400 shrink-0">✦</span>
                <span>{s}</span>
              </li>
            ))}
          </ul>
          <p className="section-label mt-6 mb-3">함께 키워갈 부분</p>
          <ul className="space-y-2.5">
            {report.summary.growthAreas.map((s, i) => (
              <li key={i} className="flex gap-2.5 text-[15px] leading-relaxed">
                <span className="text-apricot-400 shrink-0">✿</span>
                <span>{s}</span>
              </li>
            ))}
          </ul>
        </section>

        {report.scores.length > 0 && (
          <section className="card">
            <p className="section-label mb-1">기질 척도 프로필</p>
            <p className="text-xs text-ink/50 mb-4">
              점수는 좋고 나쁨이 아니라 아이의 고유한 성향을 나타냅니다.
            </p>
            <ScoreBars scores={report.scores} />
          </section>
        )}

        <section className="card">
          <p className="section-label mb-4">조금 더 자세히 들여다보기</p>
          <div className="space-y-5">
            {report.details.map((d) => (
              <div key={d.key}>
                <h3 className="font-semibold text-sage-800 mb-1.5">{d.title}</h3>
                <p className="text-[15px] leading-relaxed text-ink/85">{d.content}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="card bg-apricot-50 border-apricot-100">
          <p className="section-label mb-4 !text-apricot-600">가정에서 이렇게 함께해 주세요</p>
          <GuideBlock title="힘이 되는 말" items={report.parentGuide.helpfulWords} />
          <GuideBlock title="피하면 좋은 반응" items={report.parentGuide.avoidReactions} />
          <GuideBlock title="학습 지도 팁" items={report.parentGuide.learningTips} />
          <GuideBlock title="정서 지도 팁" items={report.parentGuide.emotionTips} last />
        </section>

        <section className="card">
          <p className="section-label mb-4">센터에서는 이렇게 도와드릴게요</p>
          <GuideBlock title="중점 지도 영역" items={report.centerPlan.focusAreas} />
          <GuideBlock title="추천 활동" items={report.centerPlan.activities} />
          <GuideBlock title="다음 상담에서 함께 볼 부분" items={report.centerPlan.nextCheckpoints} last />
        </section>

        <footer className="text-center text-xs text-ink/45 leading-relaxed pt-2 px-4">
          본 결과지는 보호자 상담 및 가정 지도 참고용이며,
          <br />
          외부 공유를 삼가 주세요.
          <p className="mt-3">ⓒ 학습심리브레인센터</p>
        </footer>
      </div>
    </main>
  );
}

function GuideBlock({
  title,
  items,
  last = false,
}: {
  title: string;
  items: string[];
  last?: boolean;
}) {
  return (
    <div className={last ? "" : "mb-5"}>
      <h3 className="font-semibold text-sm mb-2">{title}</h3>
      <ul className="space-y-1.5">
        {items.map((item, i) => (
          <li key={i} className="flex gap-2 text-[14px] leading-relaxed text-ink/85">
            <span className="text-ink/30 shrink-0">·</span>
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

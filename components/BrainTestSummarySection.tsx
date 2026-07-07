/**
 * 학부모 화면 — 뇌기능검사 요약 (지표 + 상담사 의견만, 원본 파일은 포함하지 않음)
 * 지표 이름이 파낙토스 BQ 사전에 있으면 쉬운 설명을 함께 보여줍니다.
 */
import type { ParentBrainTest } from "@/lib/types";
import { findBrainIndicatorDescription } from "@/lib/content/brainTest";

export default function BrainTestSummarySection({ tests }: { tests: ParentBrainTest[] }) {
  if (tests.length === 0) return null;

  return (
    <section className="card">
      <p className="section-label mb-1">뇌기능검사</p>
      <p className="text-xs text-ink/50 mb-4">
        진단이 아닌 참고 자료이며, 자세한 내용은 상담 시 안내해 드립니다.
      </p>
      <div className="space-y-4">
        {tests.map((t, i) => (
          <div key={i} className={i > 0 ? "pt-4 border-t border-sage-100" : ""}>
            <p className="text-xs text-ink/40 mb-2">검사일 {t.testDate}</p>
            {t.indicators.length > 0 && (
              <ul className="space-y-2 mb-3">
                {t.indicators.map((ind, idx) => {
                  const desc = findBrainIndicatorDescription(ind.label);
                  return (
                    <li key={idx} className="rounded-xl bg-sage-50 px-3 py-2">
                      <p className="text-[13px] font-semibold text-sage-700">
                        {ind.label} <span className="font-bold">{ind.value}</span>
                      </p>
                      {desc && <p className="text-xs text-ink/55 mt-0.5">{desc}</p>}
                    </li>
                  );
                })}
              </ul>
            )}
            {t.opinion && <p className="text-[15px] leading-relaxed text-ink/85 whitespace-pre-wrap">{t.opinion}</p>}
          </div>
        ))}
      </div>
    </section>
  );
}

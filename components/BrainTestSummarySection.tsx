/**
 * 학부모 화면 — 뇌기능검사 요약 (지표 + 상담사 의견만, 원본 파일은 포함하지 않음)
 */
import type { ParentBrainTest } from "@/lib/types";

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
              <div className="flex flex-wrap gap-1.5 mb-2">
                {t.indicators.map((ind, idx) => (
                  <span key={idx} className="text-xs bg-sage-50 text-sage-700 rounded-full px-2.5 py-1">
                    {ind.label} {ind.value}
                  </span>
                ))}
              </div>
            )}
            {t.opinion && <p className="text-[15px] leading-relaxed text-ink/85 whitespace-pre-wrap">{t.opinion}</p>}
          </div>
        ))}
      </div>
    </section>
  );
}

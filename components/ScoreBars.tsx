import type { ScaleScore } from "@/lib/types";

/**
 * 척도 점수 그래프 (가로 막대)
 * - 학부모 모바일 화면과 인쇄용 A4 결과지에서 공용으로 사용
 * - 이미지가 아닌 CSS로 그려서 인쇄 시에도 선명하게 출력됨
 */
export default function ScoreBars({
  scores,
  compact = false,
}: {
  scores: ScaleScore[];
  compact?: boolean;
}) {
  if (!scores?.length) return null;
  return (
    <ul className={compact ? "space-y-2.5" : "space-y-4"}>
      {scores.map((s) => (
        <li key={s.label}>
          <div className="flex items-baseline justify-between mb-1">
            <span className={`font-medium ${compact ? "text-[13px]" : "text-sm"}`}>
              {s.label}
            </span>
            <span className="text-xs text-ink/60">
              {s.note ? `${s.note} · ` : ""}
              {s.score}/10
            </span>
          </div>
          <div
            className="h-2.5 rounded-full bg-sage-100 overflow-hidden"
            role="img"
            aria-label={`${s.label} ${s.score}점 (10점 만점)`}
          >
            <div
              className="h-full rounded-full bg-sage-400"
              style={{
                width: `${(s.score / 10) * 100}%`,
                // 인쇄 시 배경색이 사라지지 않도록
                printColorAdjust: "exact",
                WebkitPrintColorAdjust: "exact",
              }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}

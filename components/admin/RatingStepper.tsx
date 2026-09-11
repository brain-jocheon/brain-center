"use client";

/**
 * [15단계] 1~5 단계형 관찰 입력 — 탭 한 번으로 끝나는 버튼 5개.
 * 참여도/집중도/이해도/정서상태/상호작용처럼 "선생님이 긴 문장을 쓰지 않고
 * 빠르게 기록"해야 하는 항목에 공용으로 씀(QuickClassRecordForm, ChildCommentsHistory 재사용).
 */

export default function RatingStepper({
  label,
  value,
  onChange,
  disabled,
}: {
  label: string;
  value: number | null | undefined;
  onChange: (next: number | null) => void;
  disabled?: boolean;
}) {
  return (
    <div>
      <span className="block text-[11px] text-ink/50 mb-1">{label}</span>
      <div className="flex gap-1">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            disabled={disabled}
            onClick={() => onChange(value === n ? null : n)}
            className={`w-7 h-7 rounded-full text-xs font-medium transition-colors ${
              value === n ? "bg-sage-600 text-white" : "bg-sage-50 text-ink/50 hover:bg-sage-100"
            } ${disabled ? "opacity-50 cursor-not-allowed" : ""}`}
          >
            {n}
          </button>
        ))}
      </div>
    </div>
  );
}

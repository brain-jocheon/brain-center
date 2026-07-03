"use client";

import type { PrisCode } from "@/lib/content/mtpris/types";

/**
 * PRIS 현재성 사분면 그래프
 * 원본 MT-PRIS HTML의 arc() 로직을 그대로 이식했습니다.
 * P(좌상) · I(우상) · S(우하) · R(좌하) 4분면에 점수(0~100)만큼 면적을 그립니다.
 * 빨간 점 = 대표기능(선천), 노란 점 = 바탕기능/현재 최고 영역
 */

const POS: Record<PrisCode, { top: string; left: string }> = {
  P: { top: "25%", left: "25%" },
  I: { top: "25%", left: "75%" },
  S: { top: "75%", left: "75%" },
  R: { top: "75%", left: "25%" },
};

const QUADRANT_ANGLE: Record<PrisCode, [number, number]> = {
  P: [270, 360],
  I: [0, 90],
  S: [90, 180],
  R: [180, 270],
};

const QUADRANT_COLOR: Record<PrisCode, string> = {
  P: "#E8A87C", // apricot
  R: "#7FA98D", // sage
  I: "#8FB4D9",
  S: "#D98FA3",
};

function arcPath(score: number, start: number, end: number): string {
  if (score <= 0) return "M100,100";
  const r = Math.max(0, Math.min(100, score));
  const a = ((start - 90) * Math.PI) / 180;
  const b = ((end - 90) * Math.PI) / 180;
  const x1 = 100 + r * Math.cos(a);
  const y1 = 100 + r * Math.sin(a);
  const x2 = 100 + r * Math.cos(b);
  const y2 = 100 + r * Math.sin(b);
  return `M100,100 L${x1},${y1} A${r},${r} 0 0,1 ${x2},${y2} Z`;
}

export default function QuadrantChart({
  scores,
  nativeCode,
  currentCode,
  compact = false,
}: {
  scores: Record<PrisCode, number>;
  /** 대표기능(선천) 기질 — 빨간 점 */
  nativeCode: PrisCode;
  /** 현재성 최고 영역 — 노란 점 */
  currentCode: PrisCode;
  compact?: boolean;
}) {
  const size = compact ? 160 : 200;
  const nativePos = POS[nativeCode];
  const currentPos = POS[currentCode];
  const overlap = nativeCode === currentCode;

  return (
    <div
      className="relative mx-auto"
      style={{ width: size, height: size }}
      role="img"
      aria-label="PRIS 현재성 사분면 그래프"
    >
      {(["P", "I", "S", "R"] as PrisCode[]).map((code) => (
        <span
          key={code}
          className="absolute text-[10px] font-semibold text-ink/50"
          style={{
            top: code === "P" || code === "I" ? 2 : undefined,
            bottom: code === "S" || code === "R" ? 2 : undefined,
            left: code === "P" || code === "R" ? 2 : undefined,
            right: code === "I" || code === "S" ? 2 : undefined,
          }}
        >
          {code}
        </span>
      ))}

      <svg width={size} height={size} viewBox="0 0 200 200">
        <line x1="0" y1="100" x2="200" y2="100" stroke="#E2ECE5" strokeWidth="1" />
        <line x1="100" y1="0" x2="100" y2="200" stroke="#E2ECE5" strokeWidth="1" />
        <circle cx="100" cy="100" r="100" fill="none" stroke="#E2ECE5" strokeWidth="1" />
        <circle cx="100" cy="100" r="66" fill="none" stroke="#EEF3EF" strokeWidth="1" />
        <circle cx="100" cy="100" r="33" fill="none" stroke="#EEF3EF" strokeWidth="1" />
        {(["P", "I", "S", "R"] as PrisCode[]).map((code) => (
          <path
            key={code}
            d={arcPath(scores[code], ...QUADRANT_ANGLE[code])}
            fill={QUADRANT_COLOR[code]}
            fillOpacity={0.55}
            style={{ printColorAdjust: "exact", WebkitPrintColorAdjust: "exact" }}
          />
        ))}
      </svg>

      {/* 대표기능(선천) 마커 — 빨강 */}
      <div
        className="absolute w-3 h-3 rounded-full bg-rose-500 border-2 border-white shadow -translate-x-1/2 -translate-y-1/2"
        style={{ top: nativePos.top, left: nativePos.left, printColorAdjust: "exact", WebkitPrintColorAdjust: "exact" }}
        title="대표기능"
      />
      {/* 현재성 최고 영역 마커 — 노랑 (같은 위치면 살짝 오프셋) */}
      <div
        className="absolute w-3 h-3 rounded-full bg-amber-400 border-2 border-white shadow -translate-x-1/2 -translate-y-1/2"
        style={{
          top: overlap ? `calc(${currentPos.top} + 10px)` : currentPos.top,
          left: overlap ? `calc(${currentPos.left} + 16px)` : currentPos.left,
          printColorAdjust: "exact", WebkitPrintColorAdjust: "exact",
        }}
        title="현재성 최고 영역"
      />
    </div>
  );
}

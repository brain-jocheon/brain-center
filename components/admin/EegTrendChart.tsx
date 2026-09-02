"use client";

/**
 * 뇌파훈련 지표 기간별 추이 — 이 프로젝트엔 차트 라이브러리가 없어(package.json 확인)
 * components/mtpris/QuadrantChart.tsx와 같은 방식으로 순수 인라인 svg로 직접 그림.
 * [주의] 측정 안 한(null) 값은 0으로 잇지 않고 그래프에서 건너뜀 — 아래 표에 그대로 숫자로 병기.
 */

import { useMemo, useState } from "react";
import type { EegTrainingSession } from "@/lib/types";

const DURATION_KEY = "__duration";

export default function EegTrendChart({ sessions }: { sessions: EegTrainingSession[] }) {
  const chronological = useMemo(() => [...sessions].reverse(), [sessions]);

  const metricKeys = useMemo(() => {
    const keys = new Set<string>();
    for (const s of chronological) {
      if (!s.keyMetrics) continue;
      for (const [k, v] of Object.entries(s.keyMetrics)) {
        if (typeof v === "number" && Number.isFinite(v)) keys.add(k);
      }
    }
    return Array.from(keys);
  }, [chronological]);

  const hasDuration = chronological.some((s) => s.durationMinutes != null);
  const options = [
    ...(hasDuration ? [{ key: DURATION_KEY, label: "소요시간(분)" }] : []),
    ...metricKeys.map((k) => ({ key: k, label: k })),
  ];

  const [selected, setSelected] = useState(options[0]?.key ?? "");
  const activeKey = options.some((o) => o.key === selected) ? selected : options[0]?.key ?? "";

  if (options.length === 0) {
    return <p className="text-sm text-ink/40 text-center py-6">표시할 숫자 지표가 없습니다.</p>;
  }

  const points = chronological
    .map((s) => {
      const raw = activeKey === DURATION_KEY ? s.durationMinutes : s.keyMetrics?.[activeKey];
      const value = typeof raw === "number" && Number.isFinite(raw) ? raw : null;
      return { date: s.sessionDate, value };
    })
    .filter((p): p is { date: string; value: number } => p.value !== null);

  return (
    <div>
      <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
        <p className="text-sm font-medium">기간별 추이</p>
        <select className="input !py-1.5 !w-auto text-sm" value={activeKey} onChange={(e) => setSelected(e.target.value)}>
          {options.map((o) => (
            <option key={o.key} value={o.key}>{o.label}</option>
          ))}
        </select>
      </div>

      {points.length < 2 ? (
        <p className="text-sm text-ink/40 text-center py-6">표시할 데이터가 부족합니다.</p>
      ) : (
        <>
          <Chart points={points} />
          <table className="w-full text-xs mt-3 border-collapse">
            <thead>
              <tr className="text-ink/40 border-b border-sage-100">
                <th className="text-left font-medium py-1">날짜</th>
                <th className="text-right font-medium py-1">값</th>
              </tr>
            </thead>
            <tbody>
              {points.map((p) => (
                <tr key={p.date} className="border-b border-sage-50">
                  <td className="py-1 text-ink/60">{p.date}</td>
                  <td className="py-1 text-right text-ink/80">{p.value}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </div>
  );
}

function Chart({ points }: { points: { date: string; value: number }[] }) {
  const width = 600;
  const height = 180;
  const padding = 24;
  const values = points.map((p) => p.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;

  const xStep = (width - padding * 2) / Math.max(points.length - 1, 1);
  const coords = points.map((p, i) => ({
    x: padding + i * xStep,
    y: height - padding - ((p.value - min) / range) * (height - padding * 2),
    value: p.value,
  }));
  const path = coords.map((c, i) => `${i === 0 ? "M" : "L"}${c.x.toFixed(1)},${c.y.toFixed(1)}`).join(" ");

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full" style={{ maxHeight: 200 }}>
      <line x1={padding} y1={height - padding} x2={width - padding} y2={height - padding} stroke="#E2ECE5" strokeWidth={1} />
      <path d={path} fill="none" stroke="#7FA98D" strokeWidth={2} />
      {coords.map((c, i) => (
        <circle key={i} cx={c.x} cy={c.y} r={3} fill="#7FA98D" />
      ))}
    </svg>
  );
}

"use client";

/**
 * 검사 전후 비교 — EegTrendChart.tsx와 동일한 방식(차트 라이브러리 없이 인라인 svg + 표).
 * [주의] direction이 'higher_better'/'lower_better'인 지표만 개선/주의 판정을 보여준다.
 * direction:'none'이거나 매칭되는 템플릿이 없으면 절대 좋다/나쁘다 판정하지 않고 숫자
 * 변화만 보여준다 — eeg_test_templates 스키마 자체에 있는 원칙, 여기서도 반드시 지킴.
 */

import { useMemo, useState } from "react";
import type { BrainTest, EegTestTemplate } from "@/lib/types";

function parseNumeric(value: string): number | null {
  const n = Number(value.replace(/,/g, "").trim());
  return Number.isFinite(n) ? n : null;
}

export default function BrainTestComparison({ tests, templates }: { tests: BrainTest[]; templates: EegTestTemplate[] }) {
  const grouped = useMemo(() => {
    const map = new Map<string, BrainTest[]>();
    for (const t of tests) {
      if (!t.testType || t.indicators.length === 0) continue;
      const list = map.get(t.testType) ?? [];
      list.push(t);
      map.set(t.testType, list);
    }
    return Array.from(map.entries()).filter(([, list]) => list.length >= 2);
  }, [tests]);

  const [selectedType, setSelectedType] = useState(grouped[0]?.[0] ?? "");
  const activeType = grouped.some(([t]) => t === selectedType) ? selectedType : grouped[0]?.[0] ?? "";
  const activeTests = grouped.find(([t]) => t === activeType)?.[1] ?? [];

  const indicatorLabels = useMemo(() => {
    const labels = new Set<string>();
    for (const t of activeTests) for (const i of t.indicators) labels.add(i.label);
    return Array.from(labels);
  }, [activeTests]);

  const [selectedLabel, setSelectedLabel] = useState(indicatorLabels[0] ?? "");
  const activeLabel = indicatorLabels.includes(selectedLabel) ? selectedLabel : indicatorLabels[0] ?? "";

  if (grouped.length === 0) {
    return <p className="text-sm text-ink/40 text-center py-6">비교할 수 있는 검사가 아직 없습니다. (같은 검사종류로 2건 이상, 지표 입력 필요)</p>;
  }

  const template = templates.find((t) => t.testType === activeType && t.indicatorKey === activeLabel);

  const points = [...activeTests]
    .sort((a, b) => (a.testDate < b.testDate ? -1 : 1))
    .map((t) => {
      const indicator = t.indicators.find((i) => i.label === activeLabel);
      const value = indicator ? parseNumeric(indicator.value) : null;
      return { date: t.testDate, value };
    })
    .filter((p): p is { date: string; value: number } => p.value !== null);

  const latestTwo = points.slice(-2);
  const delta = latestTwo.length === 2 ? latestTwo[1].value - latestTwo[0].value : null;

  return (
    <div className="card">
      <div className="flex items-center gap-2 flex-wrap mb-3">
        {grouped.length > 1 && (
          <select className="input !py-1.5 !w-auto text-sm" value={activeType} onChange={(e) => setSelectedType(e.target.value)}>
            {grouped.map(([t]) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        )}
        <select className="input !py-1.5 !w-auto text-sm" value={activeLabel} onChange={(e) => setSelectedLabel(e.target.value)}>
          {indicatorLabels.map((l) => (
            <option key={l} value={l}>{l}</option>
          ))}
        </select>
        {!template && <span className="text-[10px] text-ink/40">이 지표는 등록된 기준이 없습니다</span>}
      </div>

      {points.length < 2 ? (
        <p className="text-sm text-ink/40 text-center py-6">표시할 데이터가 부족합니다. (숫자값 2건 이상 필요)</p>
      ) : (
        <>
          {delta !== null && (
            <div className="mb-3">
              {template && template.direction !== "none" ? (
                (() => {
                  const improved = template.direction === "higher_better" ? delta > 0 : delta < 0;
                  const worsened = template.direction === "higher_better" ? delta < 0 : delta > 0;
                  const label = improved ? "이전 대비 개선" : worsened ? "이전 대비 주의" : "변화 없음";
                  const color = improved ? "bg-sage-100 text-sage-700" : worsened ? "bg-apricot-50 text-apricot-600" : "bg-ink/5 text-ink/50";
                  return (
                    <span className={`text-xs rounded-full px-2.5 py-1 font-medium ${color}`}>
                      {label} ({delta > 0 ? "+" : ""}{delta})
                    </span>
                  );
                })()
              ) : (
                <span className="text-xs rounded-full px-2.5 py-1 font-medium bg-ink/5 text-ink/50">
                  변화 {delta > 0 ? "+" : ""}{delta} (판정 기준 없음)
                </span>
              )}
            </div>
          )}
          <Chart points={points} />
          <table className="w-full text-xs mt-3 border-collapse">
            <thead>
              <tr className="text-ink/40 border-b border-sage-100">
                <th className="text-left font-medium py-1">검사일</th>
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

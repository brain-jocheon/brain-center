"use client";

/**
 * 결과 입력·수정 폼
 * - 리포트의 5개 영역(요약/점수/세부해석/부모가이드/센터방향)을 모두 수정
 * - 여러 줄 항목(강점, 팁 등)은 "한 줄에 하나씩" 입력하는 방식
 * - 저장 시 /api/admin/reports 로 전송 → data/reports.json에 반영
 */

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Report } from "@/lib/types";

/** textarea의 줄 단위 입력 ↔ 배열 변환 */
const toLines = (arr: string[]) => arr.join("\n");
const toArray = (s: string) => s.split("\n").map((v) => v.trim()).filter(Boolean);

export default function ReportEditForm({ initial }: { initial: Report }) {
  const [report, setReport] = useState<Report>(initial);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const router = useRouter();

  function update(partial: Partial<Report>) {
    setReport((r) => ({ ...r, ...partial }));
  }

  async function handleSave() {
    setSaving(true);
    setMessage("");
    const res = await fetch("/api/admin/reports", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(report),
    });
    setSaving(false);
    if (res.ok) {
      setMessage("저장되었습니다.");
      router.refresh();
    } else {
      setMessage("저장에 실패했습니다. 다시 시도해 주세요.");
    }
  }

  return (
    <div className="space-y-5">
      {/* 기본 정보 */}
      <section className="card">
        <p className="section-label mb-4">기본 정보</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="검사일">
            <input className="input" type="date" value={report.testDate}
              onChange={(e) => update({ testDate: e.target.value })} />
          </Field>
          <Field label="담당자">
            <input className="input" value={report.counselor}
              onChange={(e) => update({ counselor: e.target.value })} />
          </Field>
          <Field label="검사 이름 (화면 표시용)">
            <input className="input" value={report.testTypeName}
              onChange={(e) => update({ testTypeName: e.target.value })} />
          </Field>
          <Field label="공개 상태">
            <select className="input" value={report.status}
              onChange={(e) => update({ status: e.target.value as Report["status"] })}>
              <option value="draft">작성 중 (학부모에게 안 보임)</option>
              <option value="published">공개 (학부모 열람 가능)</option>
            </select>
          </Field>
        </div>
      </section>

      {/* 핵심 요약 */}
      <section className="card">
        <p className="section-label mb-4">핵심 요약</p>
        <Field label="한눈에 보는 아이 특성 (2~3문장)">
          <textarea className="input min-h-24" value={report.summary.headline}
            onChange={(e) => update({ summary: { ...report.summary, headline: e.target.value } })} />
        </Field>
        <Field label="대표 기질">
          <input className="input" value={report.summary.mainTemperament}
            onChange={(e) => update({ summary: { ...report.summary, mainTemperament: e.target.value } })} />
        </Field>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="현재 강점 (한 줄에 하나씩)">
            <textarea className="input min-h-28" value={toLines(report.summary.strengths)}
              onChange={(e) => update({ summary: { ...report.summary, strengths: toArray(e.target.value) } })} />
          </Field>
          <Field label="성장 과제 (한 줄에 하나씩)">
            <textarea className="input min-h-28" value={toLines(report.summary.growthAreas)}
              onChange={(e) => update({ summary: { ...report.summary, growthAreas: toArray(e.target.value) } })} />
          </Field>
        </div>
      </section>

      {/* 척도 점수 */}
      <section className="card">
        <p className="section-label mb-1">척도 점수 (그래프)</p>
        <p className="text-xs text-ink/50 mb-4">1~10점. 점수는 보조 자료이며 해석 문장이 중심입니다.</p>
        <div className="space-y-3">
          {report.scores.map((s, i) => (
            <div key={i} className="grid grid-cols-[1fr_84px_1fr] gap-2 items-center">
              <input className="input !py-2" value={s.label} placeholder="척도 이름"
                onChange={(e) => {
                  const scores = [...report.scores];
                  scores[i] = { ...s, label: e.target.value };
                  update({ scores });
                }} />
              <input className="input !py-2 text-center" type="number" min={1} max={10} value={s.score}
                onChange={(e) => {
                  const scores = [...report.scores];
                  scores[i] = { ...s, score: Math.min(10, Math.max(1, Number(e.target.value) || 1)) };
                  update({ scores });
                }} />
              <input className="input !py-2" value={s.note ?? ""} placeholder="짧은 설명 (선택)"
                onChange={(e) => {
                  const scores = [...report.scores];
                  scores[i] = { ...s, note: e.target.value };
                  update({ scores });
                }} />
            </div>
          ))}
        </div>
      </section>

      {/* 세부 해석 */}
      <section className="card">
        <p className="section-label mb-1">세부 해석</p>
        <p className="text-xs text-ink/50 mb-4">
          작성 원칙: 강점을 먼저, 단정·낙인 표현 대신 &ldquo;연습이 필요하다&rdquo;는 표현으로.
        </p>
        <div className="space-y-4">
          {report.details.map((d, i) => (
            <Field key={d.key} label={d.title}>
              <textarea className="input min-h-24" value={d.content}
                onChange={(e) => {
                  const details = [...report.details];
                  details[i] = { ...d, content: e.target.value };
                  update({ details });
                }} />
            </Field>
          ))}
        </div>
      </section>

      {/* 부모님 가이드 */}
      <section className="card">
        <p className="section-label mb-4">부모님 가이드 (한 줄에 하나씩)</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <ListField label="가정에서 도움이 되는 말" value={report.parentGuide.helpfulWords}
            onChange={(v) => update({ parentGuide: { ...report.parentGuide, helpfulWords: v } })} />
          <ListField label="피하면 좋은 반응" value={report.parentGuide.avoidReactions}
            onChange={(v) => update({ parentGuide: { ...report.parentGuide, avoidReactions: v } })} />
          <ListField label="학습 지도 팁" value={report.parentGuide.learningTips}
            onChange={(v) => update({ parentGuide: { ...report.parentGuide, learningTips: v } })} />
          <ListField label="정서 지도 팁" value={report.parentGuide.emotionTips}
            onChange={(v) => update({ parentGuide: { ...report.parentGuide, emotionTips: v } })} />
        </div>
      </section>

      {/* 센터 지도 방향 */}
      <section className="card">
        <p className="section-label mb-4">센터 지도 방향 (한 줄에 하나씩)</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <ListField label="중점적으로 도와줄 부분" value={report.centerPlan.focusAreas}
            onChange={(v) => update({ centerPlan: { ...report.centerPlan, focusAreas: v } })} />
          <ListField label="추천 활동" value={report.centerPlan.activities}
            onChange={(v) => update({ centerPlan: { ...report.centerPlan, activities: v } })} />
          <ListField label="다음 상담 시 확인할 부분" value={report.centerPlan.nextCheckpoints}
            onChange={(v) => update({ centerPlan: { ...report.centerPlan, nextCheckpoints: v } })} />
        </div>
      </section>

      {/* 저장 */}
      <div className="sticky bottom-4 flex items-center justify-end gap-3">
        {message && <span className="text-sm bg-white rounded-full px-4 py-2 border border-sage-100">{message}</span>}
        <button className="btn-primary shadow-lg" onClick={handleSave} disabled={saving}>
          {saving ? "저장 중..." : "저장하기"}
        </button>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block mb-4 last:mb-0">
      <span className="block text-sm font-medium mb-1.5">{label}</span>
      {children}
    </label>
  );
}

function ListField({ label, value, onChange }: {
  label: string; value: string[]; onChange: (v: string[]) => void;
}) {
  return (
    <Field label={label}>
      <textarea className="input min-h-28" value={toLines(value)}
        onChange={(e) => onChange(toArray(e.target.value))} />
    </Field>
  );
}

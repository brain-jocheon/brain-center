"use client";

/**
 * 검사 템플릿(eeg_test_templates) 관리 — 검사종류별로 그룹핑해서 보여주고 생성/수정/삭제.
 * [주의] indicatorKey는 brain_tests.indicators의 label 문자열과 정확히 일치해야 매칭된다
 * (둘 다 자유텍스트라 완벽한 키가 아님) — 오타면 그냥 "기준 없음" 취급, 에러는 안 남.
 */

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { EegTestTemplate } from "@/lib/types";

const DIRECTION_LABEL: Record<EegTestTemplate["direction"], string> = {
  higher_better: "높을수록 좋음",
  lower_better: "낮을수록 좋음",
  none: "기준 없음",
};

export default function TestTemplateManager({
  templates,
  testTypeSuggestions,
}: {
  templates: EegTestTemplate[];
  testTypeSuggestions: string[];
}) {
  const [creating, setCreating] = useState(false);

  const grouped = useMemo(() => {
    const map = new Map<string, EegTestTemplate[]>();
    for (const t of templates) {
      const list = map.get(t.testType) ?? [];
      list.push(t);
      map.set(t.testType, list);
    }
    return Array.from(map.entries());
  }, [templates]);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <p className="section-label">템플릿 목록</p>
        {!creating && (
          <button className="btn-primary text-sm !px-4 !py-2" onClick={() => setCreating(true)}>
            + 템플릿 추가
          </button>
        )}
      </div>

      {creating && <TemplateEditor testTypeSuggestions={testTypeSuggestions} onDone={() => setCreating(false)} />}

      {grouped.length === 0 && !creating && (
        <p className="text-sm text-ink/40 text-center py-6">아직 등록된 템플릿이 없습니다.</p>
      )}

      {grouped.map(([testType, rows]) => (
        <section key={testType} className="card">
          <p className="font-bold text-sm mb-3">{testType}</p>
          <div className="space-y-3">
            {rows.map((t) => (
              <TemplateRow key={t.id} template={t} />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

function TemplateRow({ template }: { template: EegTestTemplate }) {
  const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const router = useRouter();

  async function handleDelete() {
    if (!confirm(`"${template.indicatorLabel}" 템플릿을 삭제하시겠습니까?`)) return;
    setDeleting(true);
    const res = await fetch(`/api/admin/test-templates/${template.id}`, { method: "DELETE" });
    setDeleting(false);
    if (res.ok) router.refresh();
    else alert("삭제에 실패했습니다.");
  }

  if (editing) {
    return <TemplateEditor template={template} onDone={() => setEditing(false)} />;
  }

  return (
    <div className="rounded-xl border border-sage-100 p-3">
      <div className="flex items-start justify-between gap-3 mb-1.5">
        <div>
          <p className="text-sm font-semibold">
            {template.indicatorLabel} <span className="text-ink/40 text-xs font-normal">({template.indicatorKey})</span>
          </p>
          <div className="flex items-center gap-1.5 mt-1 flex-wrap">
            <span className="text-[10px] rounded-full px-2 py-0.5 font-medium bg-sage-50 text-sage-700">
              {DIRECTION_LABEL[template.direction]}
            </span>
            {(template.normalRangeMin != null || template.normalRangeMax != null) && (
              <span className="text-[10px] text-ink/40">
                정상범위 {template.normalRangeMin ?? "-"} ~ {template.normalRangeMax ?? "-"}
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button className="text-xs text-sage-600 underline underline-offset-2" onClick={() => setEditing(true)}>수정</button>
          <button className="text-xs text-apricot-600 underline underline-offset-2" disabled={deleting} onClick={handleDelete}>삭제</button>
        </div>
      </div>
      {template.aiInstruction && <p className="text-xs text-ink/50 whitespace-pre-wrap">{template.aiInstruction}</p>}
    </div>
  );
}

function TemplateEditor({
  template,
  testTypeSuggestions,
  onDone,
}: {
  template?: EegTestTemplate;
  testTypeSuggestions?: string[];
  onDone: () => void;
}) {
  const [testType, setTestType] = useState(template?.testType ?? "");
  const [indicatorKey, setIndicatorKey] = useState(template?.indicatorKey ?? "");
  const [indicatorLabel, setIndicatorLabel] = useState(template?.indicatorLabel ?? "");
  const [direction, setDirection] = useState<EegTestTemplate["direction"]>(template?.direction ?? "none");
  const [normalRangeMin, setNormalRangeMin] = useState(template?.normalRangeMin != null ? String(template.normalRangeMin) : "");
  const [normalRangeMax, setNormalRangeMax] = useState(template?.normalRangeMax != null ? String(template.normalRangeMax) : "");
  const [aiInstruction, setAiInstruction] = useState(template?.aiInstruction ?? "");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const router = useRouter();

  const canSubmit = testType.trim() && indicatorKey.trim() && indicatorLabel.trim();

  async function handleSave() {
    if (!canSubmit) return;
    setSaving(true);
    setMessage("");
    const body = {
      indicatorLabel: indicatorLabel.trim(),
      direction,
      normalRangeMin: normalRangeMin.trim() === "" ? null : Number(normalRangeMin),
      normalRangeMax: normalRangeMax.trim() === "" ? null : Number(normalRangeMax),
      aiInstruction: aiInstruction.trim() || undefined,
    };
    const res = await fetch(
      template ? `/api/admin/test-templates/${template.id}` : "/api/admin/test-templates",
      {
        method: template ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(template ? body : { ...body, testType: testType.trim(), indicatorKey: indicatorKey.trim() }),
      }
    );
    setSaving(false);
    if (res.ok) {
      router.refresh();
      onDone();
    } else {
      const data = await res.json().catch(() => null);
      setMessage(data?.message || "저장에 실패했습니다.");
    }
  }

  return (
    <div className="card">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <label className="block">
          <span className="block text-xs font-medium mb-1">검사종류</span>
          <input
            className="input !py-2 text-sm"
            list="test-template-type-suggestions"
            value={testType}
            disabled={!!template}
            onChange={(e) => setTestType(e.target.value)}
            placeholder="예: 파낙토스 뇌기능검사"
          />
          <datalist id="test-template-type-suggestions">
            {(testTypeSuggestions ?? []).map((t) => <option key={t} value={t} />)}
          </datalist>
        </label>
        <label className="block">
          <span className="block text-xs font-medium mb-1">지표 key (indicators의 라벨과 정확히 일치해야 함)</span>
          <input className="input !py-2 text-sm" value={indicatorKey} disabled={!!template} onChange={(e) => setIndicatorKey(e.target.value)} placeholder="예: 집중지수" />
        </label>
        <label className="block">
          <span className="block text-xs font-medium mb-1">지표명(화면 표시용)</span>
          <input className="input !py-2 text-sm" value={indicatorLabel} onChange={(e) => setIndicatorLabel(e.target.value)} />
        </label>
        <label className="block">
          <span className="block text-xs font-medium mb-1">방향성</span>
          <select className="input !py-2 text-sm" value={direction} onChange={(e) => setDirection(e.target.value as EegTestTemplate["direction"])}>
            <option value="none">기준 없음(증감만 표시)</option>
            <option value="higher_better">높을수록 좋음</option>
            <option value="lower_better">낮을수록 좋음</option>
          </select>
        </label>
        <label className="block">
          <span className="block text-xs font-medium mb-1">정상범위 최소(선택)</span>
          <input className="input !py-2 text-sm" type="number" value={normalRangeMin} onChange={(e) => setNormalRangeMin(e.target.value)} />
        </label>
        <label className="block">
          <span className="block text-xs font-medium mb-1">정상범위 최대(선택)</span>
          <input className="input !py-2 text-sm" type="number" value={normalRangeMax} onChange={(e) => setNormalRangeMax(e.target.value)} />
        </label>
      </div>
      <label className="block mt-3">
        <span className="block text-xs font-medium mb-1">AI 해석 지침(선택 — 이 지표를 해석할 때 AI가 참고)</span>
        <textarea className="input min-h-16 text-sm" value={aiInstruction} onChange={(e) => setAiInstruction(e.target.value)} />
      </label>
      {message && <p className="text-xs text-apricot-600 mt-2">{message}</p>}
      <div className="flex items-center gap-2 mt-3">
        <button className="btn-primary text-sm !px-4 !py-2" disabled={saving || !canSubmit} onClick={handleSave}>
          {saving ? "저장 중..." : "저장"}
        </button>
        <button className="btn-ghost text-sm !px-4 !py-2" onClick={onDone}>취소</button>
      </div>
    </div>
  );
}

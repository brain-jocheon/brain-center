"use client";

/**
 * 아이 상세 "아동특성" 탭 — 담당 선생님/관리자 모두 자유롭게 작성.
 * (components/admin/ChildInfoPanel.tsx와 동일한 "읽기/편집 토글 + 전체 폼 PATCH" 패턴)
 * [보안] aiIncludeFields(AI에 실제로 보낼 항목)는 canManageAiFields(관리자)만 체크박스가 보임 —
 * 선생님 화면에는 현재 선택된 항목을 배지로만 보여주고 바꿀 수 없게 함.
 */

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { ChildTraits } from "@/lib/types";

type TraitFieldKey = "temperament" | "strengths" | "weaknesses" | "cautions" | "learningStyle" | "emotionalBehavior" | "counselingGoal" | "teacherMemo";

const TRAIT_FIELDS: { key: TraitFieldKey; label: string }[] = [
  { key: "temperament", label: "기질" },
  { key: "strengths", label: "강점" },
  { key: "weaknesses", label: "보완점" },
  { key: "cautions", label: "주의사항" },
  { key: "learningStyle", label: "학습특성" },
  { key: "emotionalBehavior", label: "정서행동특성" },
  { key: "counselingGoal", label: "상담목표" },
  { key: "teacherMemo", label: "담당 선생님 메모" },
];

const AI_FIELD_OPTIONS = [...TRAIT_FIELDS, { key: "aiGuidanceNote" as const, label: "AI 작성지침" }];

export default function ChildTraitsPanel({
  childId,
  traits,
  canManageAiFields,
}: {
  childId: string;
  traits: ChildTraits | null;
  canManageAiFields: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({
    temperament: traits?.temperament ?? "",
    strengths: traits?.strengths ?? "",
    weaknesses: traits?.weaknesses ?? "",
    cautions: traits?.cautions ?? "",
    learningStyle: traits?.learningStyle ?? "",
    emotionalBehavior: traits?.emotionalBehavior ?? "",
    counselingGoal: traits?.counselingGoal ?? "",
    teacherMemo: traits?.teacherMemo ?? "",
    aiGuidanceNote: traits?.aiGuidanceNote ?? "",
  });
  const [aiIncludeFields, setAiIncludeFields] = useState<string[]>(traits?.aiIncludeFields ?? []);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const router = useRouter();

  function update(partial: Partial<typeof form>) {
    setForm((f) => ({ ...f, ...partial }));
  }

  function toggleAiField(key: string) {
    setAiIncludeFields((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]));
  }

  async function handleSave() {
    setSaving(true);
    setMessage("");
    const body: Record<string, unknown> = { ...form };
    if (canManageAiFields) body.aiIncludeFields = aiIncludeFields;
    const res = await fetch(`/api/admin/child-traits/${childId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    setSaving(false);
    if (res.ok) {
      setEditing(false);
      router.refresh();
    } else {
      const data = await res.json().catch(() => null);
      setMessage(data?.message || "저장에 실패했습니다. 다시 시도해 주세요.");
    }
  }

  const aiFieldLabel = (key: string) => AI_FIELD_OPTIONS.find((f) => f.key === key)?.label ?? key;

  if (!editing) {
    return (
      <section className="card">
        <div className="flex items-center justify-between flex-wrap gap-2 mb-4">
          <p className="section-label">아동 특성</p>
          <button className="btn-ghost text-xs !px-3.5 !py-1.5" onClick={() => setEditing(true)}>수정</button>
        </div>
        {!traits && <p className="text-sm text-ink/40 text-center py-6">아직 작성된 특성 정보가 없습니다.</p>}
        {traits && (
          <>
            <dl className="space-y-3 text-sm">
              {TRAIT_FIELDS.map((f) => (
                <TraitRow key={f.key} label={f.label} value={form[f.key]} />
              ))}
            </dl>
            {form.aiGuidanceNote && (
              <div className="mt-4 pt-4 border-t border-sage-100">
                <p className="text-xs font-semibold text-ink/50 mb-1">AI 작성지침</p>
                <p className="text-sm whitespace-pre-wrap">{form.aiGuidanceNote}</p>
              </div>
            )}
            <div className="mt-4 pt-4 border-t border-sage-100">
              <p className="text-xs font-semibold text-ink/50 mb-1.5">AI에 반영되는 항목</p>
              {aiIncludeFields.length === 0 ? (
                <p className="text-xs text-ink/40">없음 (기본값 — 관리자가 선택해야 AI에 전달됩니다)</p>
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  {aiIncludeFields.map((k) => (
                    <span key={k} className="text-[11px] bg-sage-50 text-sage-700 rounded-full px-2.5 py-1">
                      {aiFieldLabel(k)}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
        {message && <p className="text-xs text-apricot-600 mt-3">{message}</p>}
      </section>
    );
  }

  return (
    <section className="card">
      <p className="section-label mb-4">아동 특성 수정</p>
      {TRAIT_FIELDS.map((f) => (
        <label key={f.key} className="block mb-3">
          <span className="block text-sm font-medium mb-1.5">{f.label}</span>
          <textarea className="input min-h-16" value={form[f.key]} onChange={(e) => update({ [f.key]: e.target.value })} />
        </label>
      ))}
      <label className="block mb-3">
        <span className="block text-sm font-medium mb-1.5">AI 작성지침 (수업기록·검사해석 초안을 작성할 때 AI가 참고할 핵심 지침)</span>
        <textarea className="input min-h-16" value={form.aiGuidanceNote} onChange={(e) => update({ aiGuidanceNote: e.target.value })} />
      </label>

      {canManageAiFields ? (
        <div className="mb-3">
          <span className="block text-sm font-medium mb-1.5">AI에 실제로 전달할 항목 (선택한 항목만 AI 초안 생성에 사용됩니다)</span>
          <div className="flex flex-wrap gap-x-4 gap-y-2">
            {AI_FIELD_OPTIONS.map((f) => (
              <label key={f.key} className="flex items-center gap-1.5 text-sm">
                <input type="checkbox" checked={aiIncludeFields.includes(f.key)} onChange={() => toggleAiField(f.key)} />
                {f.label}
              </label>
            ))}
          </div>
        </div>
      ) : (
        <p className="text-xs text-ink/40 mb-3">AI 반영 항목은 관리자만 변경할 수 있습니다.</p>
      )}

      {message && <p className="text-sm text-apricot-600 mt-2">{message}</p>}

      <div className="flex items-center gap-2 mt-4">
        <button className="btn-primary" disabled={saving} onClick={handleSave}>
          {saving ? "저장 중..." : "저장"}
        </button>
        <button className="btn-ghost" onClick={() => { setEditing(false); setMessage(""); }}>취소</button>
      </div>
    </section>
  );
}

function TraitRow({ label, value }: { label: string; value?: string }) {
  if (!value) return null;
  return (
    <div>
      <dt className="text-xs text-ink/40">{label}</dt>
      <dd className="text-ink/70 whitespace-pre-wrap leading-relaxed mt-0.5">{value}</dd>
    </div>
  );
}

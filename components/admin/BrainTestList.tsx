"use client";

/**
 * 뇌기능검사 목록 — 지표·의견 수정/삭제, 원본 PDF는 서버가 미리 서명한 URL로 열람.
 */

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { BrainTest, BrainIndicator } from "@/lib/types";

export type BrainTestWithFileUrl = BrainTest & { fileUrl?: string };

export default function BrainTestList({ tests }: { tests: BrainTestWithFileUrl[] }) {
  if (tests.length === 0) {
    return <p className="text-sm text-ink/50 py-4 text-center">아직 등록된 뇌기능검사가 없습니다.</p>;
  }

  return (
    <div className="space-y-4">
      {tests.map((t) => (
        <BrainTestCard key={t.id} test={t} />
      ))}
    </div>
  );
}

function BrainTestCard({ test }: { test: BrainTestWithFileUrl }) {
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [indicators, setIndicators] = useState<BrainIndicator[]>(test.indicators.length ? test.indicators : [{ label: "", value: "" }]);
  const [opinion, setOpinion] = useState(test.opinion ?? "");
  const [isPublicToParent, setIsPublicToParent] = useState(test.isPublicToParent);
  const router = useRouter();

  function updateIndicator(i: number, patch: Partial<BrainIndicator>) {
    setIndicators((prev) => prev.map((row, idx) => (idx === i ? { ...row, ...patch } : row)));
  }
  function addIndicator() {
    setIndicators((prev) => [...prev, { label: "", value: "" }]);
  }
  function removeIndicator(i: number) {
    setIndicators((prev) => prev.filter((_, idx) => idx !== i));
  }

  async function handleSave() {
    setSaving(true);
    setMessage("");
    const res = await fetch(`/api/admin/brain-tests/${test.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ indicators, opinion, isPublicToParent }),
    });
    setSaving(false);
    if (res.ok) {
      setEditing(false);
      router.refresh();
    } else {
      setMessage("저장에 실패했습니다.");
    }
  }

  async function handleDelete() {
    if (!confirm("이 뇌기능검사를 삭제하시겠습니까? 원본 파일도 함께 삭제되며 되돌릴 수 없습니다.")) return;
    setSaving(true);
    const res = await fetch(`/api/admin/brain-tests/${test.id}`, { method: "DELETE" });
    setSaving(false);
    if (res.ok) router.refresh();
    else setMessage("삭제에 실패했습니다.");
  }

  return (
    <div className="rounded-xl border border-sage-100 p-4 bg-white">
      <div className="flex items-center justify-between flex-wrap gap-2 mb-2">
        <div>
          <p className="font-bold text-sm">검사일 {test.testDate} · 담당 {test.counselor}</p>
          <span className={`text-[10px] rounded-full px-2 py-0.5 font-medium ${test.isPublicToParent ? "bg-sage-100 text-sage-700" : "bg-apricot-50 text-apricot-600"}`}>
            {test.isPublicToParent ? "학부모 공개" : "학부모 비공개"}
          </span>
        </div>
        <div className="flex gap-2">
          {test.fileUrl && (
            <a className="text-xs text-sage-600 underline underline-offset-2" href={test.fileUrl} target="_blank" rel="noreferrer">
              원본 PDF 보기
            </a>
          )}
          <button className="text-xs text-sage-600 underline underline-offset-2" onClick={() => setEditing((v) => !v)}>수정</button>
          <button className="text-xs text-apricot-600 underline underline-offset-2" disabled={saving} onClick={handleDelete}>삭제</button>
        </div>
      </div>

      {!editing && (
        <>
          {test.indicators.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mb-2">
              {test.indicators.map((i, idx) => (
                <span key={idx} className="text-xs bg-sage-50 text-sage-700 rounded-full px-2.5 py-1">
                  {i.label} {i.value}
                </span>
              ))}
            </div>
          )}
          {test.opinion && <p className="text-sm text-ink/80 whitespace-pre-wrap leading-relaxed">{test.opinion}</p>}
        </>
      )}

      {editing && (
        <div className="mt-2 space-y-2 border-t border-sage-100 pt-3">
          {indicators.map((row, i) => (
            <div key={i} className="flex gap-2">
              <input className="input !py-2 text-sm" placeholder="지표명" value={row.label} onChange={(e) => updateIndicator(i, { label: e.target.value })} />
              <input className="input !py-2 text-sm" placeholder="값" value={row.value} onChange={(e) => updateIndicator(i, { value: e.target.value })} />
              <button type="button" className="btn-ghost !px-3 text-xs shrink-0" onClick={() => removeIndicator(i)} disabled={indicators.length === 1}>삭제</button>
            </div>
          ))}
          <button type="button" className="text-xs text-sage-600 underline underline-offset-2" onClick={addIndicator}>+ 지표 추가</button>
          <textarea className="input min-h-24 text-sm" placeholder="의견" value={opinion} onChange={(e) => setOpinion(e.target.value)} />
          <label className="flex items-center gap-2 text-xs">
            <input type="checkbox" checked={isPublicToParent} onChange={(e) => setIsPublicToParent(e.target.checked)} />
            학부모에게 공개
          </label>
          {message && <p className="text-xs text-apricot-600">{message}</p>}
          <button className="btn-primary text-xs !px-3 !py-1.5" disabled={saving} onClick={handleSave}>
            {saving ? "저장 중..." : "저장"}
          </button>
        </div>
      )}
    </div>
  );
}

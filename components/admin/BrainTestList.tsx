"use client";

/**
 * 뇌기능검사 목록 — 지표·의견·8단계 신규 필드 수정/삭제, 원본 PDF는 서버가 미리 서명한 URL로 열람.
 * [7단계] canEdit=false(선생님)이면 수정/삭제 버튼 없이 읽기 전용으로만 보여줌 —
 * API 자체도 관리자 전용으로 막혀 있지만(app/api/admin/brain-tests), 애초에 못 누르게.
 */

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { BrainTest, BrainIndicator } from "@/lib/types";
import { STATUS_LABEL } from "./brainTestStatus";

export type BrainTestWithFileUrl = BrainTest & { fileUrl?: string };

export default function BrainTestList({ tests, canEdit }: { tests: BrainTestWithFileUrl[]; canEdit: boolean }) {
  if (tests.length === 0) {
    return <p className="text-sm text-ink/50 py-4 text-center">아직 등록된 뇌기능검사가 없습니다.</p>;
  }

  return (
    <div className="space-y-4">
      {tests.map((t) => (
        <BrainTestCard key={t.id} test={t} canEdit={canEdit} />
      ))}
    </div>
  );
}

function BrainTestCard({ test, canEdit }: { test: BrainTestWithFileUrl; canEdit: boolean }) {
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [testType, setTestType] = useState(test.testType ?? "");
  const [testName, setTestName] = useState(test.testName ?? "");
  const [measuringOrg, setMeasuringOrg] = useState(test.measuringOrg ?? "");
  const [measuredBy, setMeasuredBy] = useState(test.measuredBy ?? "");
  const [status, setStatus] = useState<BrainTest["status"]>(test.status ?? "draft");
  const [indicators, setIndicators] = useState<BrainIndicator[]>(test.indicators.length ? test.indicators : [{ label: "", value: "" }]);
  const [opinion, setOpinion] = useState(test.opinion ?? "");
  const [parentSummary, setParentSummary] = useState(test.parentSummary ?? "");
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
      body: JSON.stringify({
        indicators, opinion, isPublicToParent,
        testType, testName, measuringOrg, measuredBy, parentSummary, status,
      }),
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

  const currentStatus = test.status ?? "draft";

  return (
    <div className="rounded-xl border border-sage-100 p-4 bg-white">
      <div className="flex items-center justify-between flex-wrap gap-2 mb-2">
        <div>
          <p className="font-bold text-sm">
            검사일 {test.testDate} · 담당 {test.counselor}
            {test.testType && <span className="text-ink/40 font-normal"> · {test.testType}</span>}
          </p>
          <div className="flex items-center gap-1.5 mt-1 flex-wrap">
            <span className={`text-[10px] rounded-full px-2 py-0.5 font-medium ${test.isPublicToParent ? "bg-sage-100 text-sage-700" : "bg-apricot-50 text-apricot-600"}`}>
              {test.isPublicToParent ? "학부모 공개" : "학부모 비공개"}
            </span>
            <span className="text-[10px] rounded-full px-2 py-0.5 font-medium bg-ink/5 text-ink/50">
              {STATUS_LABEL[currentStatus]}
            </span>
            {test.approvedAt && (
              <span className="text-[10px] text-ink/35">승인 {test.approvedBy} · {test.approvedAt.slice(0, 10)}</span>
            )}
          </div>
        </div>
        <div className="flex gap-2">
          {test.fileUrl && (
            <a className="text-xs text-sage-600 underline underline-offset-2" href={test.fileUrl} target="_blank" rel="noreferrer">
              원본 PDF 보기
            </a>
          )}
          {canEdit && (
            <>
              <button className="text-xs text-sage-600 underline underline-offset-2" onClick={() => setEditing((v) => !v)}>수정</button>
              <button className="text-xs text-apricot-600 underline underline-offset-2" disabled={saving} onClick={handleDelete}>삭제</button>
            </>
          )}
        </div>
      </div>

      {!editing && (
        <>
          {(test.testName || test.measuringOrg || test.measuredBy) && (
            <p className="text-xs text-ink/50 mb-1.5">
              {[test.testName, test.measuringOrg, test.measuredBy].filter(Boolean).join(" · ")}
            </p>
          )}
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
          {test.parentSummary && (
            <p className="text-xs text-sage-700 bg-sage-50 rounded-lg p-2 mt-2 whitespace-pre-wrap leading-relaxed">
              <span className="font-medium">학부모 공개용 요약</span> {test.parentSummary}
            </p>
          )}
        </>
      )}

      {editing && canEdit && (
        <div className="mt-2 space-y-2 border-t border-sage-100 pt-3">
          <div className="grid grid-cols-2 gap-2">
            <input className="input !py-2 text-sm" placeholder="검사 종류" value={testType} onChange={(e) => setTestType(e.target.value)} />
            <input className="input !py-2 text-sm" placeholder="검사명" value={testName} onChange={(e) => setTestName(e.target.value)} />
            <input className="input !py-2 text-sm" placeholder="측정기관" value={measuringOrg} onChange={(e) => setMeasuringOrg(e.target.value)} />
            <input className="input !py-2 text-sm" placeholder="측정자" value={measuredBy} onChange={(e) => setMeasuredBy(e.target.value)} />
          </div>
          <select className="input !py-2 text-sm" value={status} onChange={(e) => setStatus(e.target.value as BrainTest["status"])}>
            {Object.entries(STATUS_LABEL).map(([v, label]) => (
              <option key={v} value={v}>{label}</option>
            ))}
          </select>
          {indicators.map((row, i) => (
            <div key={i} className="flex gap-2">
              <input className="input !py-2 text-sm" placeholder="지표명" value={row.label} onChange={(e) => updateIndicator(i, { label: e.target.value })} />
              <input className="input !py-2 text-sm" placeholder="값" value={row.value} onChange={(e) => updateIndicator(i, { value: e.target.value })} />
              <button type="button" className="btn-ghost !px-3 text-xs shrink-0" onClick={() => removeIndicator(i)} disabled={indicators.length === 1}>삭제</button>
            </div>
          ))}
          <button type="button" className="text-xs text-sage-600 underline underline-offset-2" onClick={addIndicator}>+ 지표 추가</button>
          <textarea className="input min-h-24 text-sm" placeholder="의견(내부용)" value={opinion} onChange={(e) => setOpinion(e.target.value)} />
          <textarea className="input min-h-16 text-sm" placeholder="학부모 공개용 요약(선택)" value={parentSummary} onChange={(e) => setParentSummary(e.target.value)} />
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

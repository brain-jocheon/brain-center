"use client";

/**
 * 뇌기능검사 등록 폼 — PDF 보고서 업로드(선택) + 지표(자유 입력) + 의견.
 * [흐름] 파일이 있으면: (1) 서명 업로드 URL 발급 → (2) 브라우저에서 Storage로 직접 업로드 →
 * (3) 서버에 메타데이터(지표·의견 포함) 저장. 파일 없이 지표·의견만 저장하는 것도 허용합니다.
 *
 * [주의] 장비마다 보고서 양식이 달라 파일에서 자동으로 숫자를 읽어오지 않습니다 —
 * 지표 이름/값과 의견은 상담사가 직접 입력합니다.
 */

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabaseBrowserClient";
import { BRAIN_INDICATOR_DESCRIPTIONS, BRAIN_INDICATOR_LABEL_SUGGESTIONS } from "@/lib/content/brainTest";

const BRAIN_TEST_BUCKET = "brain-test-files";
const MAIN_INDICATOR_LABELS = Object.keys(BRAIN_INDICATOR_DESCRIPTIONS);

export default function BrainTestForm({ childId }: { childId: string }) {
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [testDate, setTestDate] = useState("");
  const [counselor, setCounselor] = useState("");
  const [indicators, setIndicators] = useState<{ label: string; value: string }[]>([{ label: "", value: "" }]);
  const [opinion, setOpinion] = useState("");
  const [isPublicToParent, setIsPublicToParent] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  function updateIndicator(i: number, patch: Partial<{ label: string; value: string }>) {
    setIndicators((prev) => prev.map((row, idx) => (idx === i ? { ...row, ...patch } : row)));
  }
  function addIndicator() {
    setIndicators((prev) => [...prev, { label: "", value: "" }]);
  }
  function removeIndicator(i: number) {
    setIndicators((prev) => prev.filter((_, idx) => idx !== i));
  }
  function loadMainIndicators() {
    setIndicators((prev) => {
      const existingLabels = new Set(prev.map((r) => r.label));
      const rows = prev.filter((r) => r.label || r.value);
      const toAdd = MAIN_INDICATOR_LABELS.filter((l) => !existingLabels.has(l)).map((label) => ({ label, value: "" }));
      return [...rows, ...toAdd];
    });
  }

  function reset() {
    setFile(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
    setTestDate("");
    setCounselor("");
    setIndicators([{ label: "", value: "" }]);
    setOpinion("");
    setIsPublicToParent(true);
    setMessage("");
  }

  const canSubmit = !!testDate && !!counselor.trim();

  async function handleSave() {
    if (!canSubmit) return;
    setSaving(true);
    setMessage("");

    let fileStoragePath: string | undefined;
    let fileName: string | undefined;

    if (file) {
      const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
      if (ext !== "pdf") {
        setMessage("PDF 파일만 업로드할 수 있습니다.");
        setSaving(false);
        return;
      }
      const urlRes = await fetch("/api/admin/brain-tests/upload-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ childId, filename: file.name, contentType: file.type }),
      });
      if (!urlRes.ok) {
        const data = await urlRes.json().catch(() => null);
        setMessage(data?.message || "업로드 URL 발급에 실패했습니다.");
        setSaving(false);
        return;
      }
      const { path, token } = await urlRes.json();
      const { error: uploadError } = await supabaseBrowser().storage.from(BRAIN_TEST_BUCKET).uploadToSignedUrl(path, token, file);
      if (uploadError) {
        setMessage(`파일 업로드 실패: ${uploadError.message}`);
        setSaving(false);
        return;
      }
      fileStoragePath = path;
      fileName = file.name;
    }

    const res = await fetch("/api/admin/brain-tests", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        childId,
        testDate,
        counselor: counselor.trim(),
        fileStoragePath,
        fileName,
        indicators,
        opinion: opinion.trim() || undefined,
        isPublicToParent,
      }),
    });
    setSaving(false);
    if (res.ok) {
      router.refresh();
      reset();
      setOpen(false);
    } else {
      const data = await res.json().catch(() => null);
      setMessage(data?.message || "저장에 실패했습니다. 다시 시도해 주세요.");
    }
  }

  if (!open) {
    return <button className="btn-primary text-sm" onClick={() => setOpen(true)}>+ 뇌기능검사 등록</button>;
  }

  return (
    <div className="card">
      <p className="section-label mb-4">뇌기능검사 등록</p>

      <label className="block mb-4">
        <span className="block text-sm font-medium mb-1.5">검사 보고서 파일 (PDF, 선택)</span>
        <input
          ref={fileInputRef}
          className="input"
          type="file"
          accept="application/pdf"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
        />
        {file && <p className="text-xs text-ink/50 mt-1">{file.name}</p>}
      </label>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <label className="block">
          <span className="block text-sm font-medium mb-1.5">검사일</span>
          <input className="input" type="date" value={testDate} onChange={(e) => setTestDate(e.target.value)} />
        </label>
        <label className="block">
          <span className="block text-sm font-medium mb-1.5">담당자</span>
          <input className="input" value={counselor} onChange={(e) => setCounselor(e.target.value)} />
        </label>
      </div>

      <div className="mt-4">
        <div className="flex items-center justify-between mb-1.5">
          <span className="block text-sm font-medium">지표</span>
          <button type="button" className="text-xs text-sage-600 underline underline-offset-2" onClick={loadMainIndicators}>
            + 파낙토스 핵심 지표 8개 불러오기
          </button>
        </div>
        <div className="space-y-2">
          {indicators.map((row, i) => (
            <div key={i} className="flex gap-2">
              <input
                className="input !py-2 text-sm"
                list="brain-indicator-suggestions"
                placeholder="예: 주의지수"
                value={row.label}
                onChange={(e) => updateIndicator(i, { label: e.target.value })}
              />
              <input
                className="input !py-2 text-sm"
                placeholder="예: 65"
                value={row.value}
                onChange={(e) => updateIndicator(i, { value: e.target.value })}
              />
              <button
                type="button"
                className="btn-ghost !px-3 text-xs shrink-0"
                onClick={() => removeIndicator(i)}
                disabled={indicators.length === 1}
              >
                삭제
              </button>
            </div>
          ))}
        </div>
        <datalist id="brain-indicator-suggestions">
          {BRAIN_INDICATOR_LABEL_SUGGESTIONS.map((label) => <option key={label} value={label} />)}
        </datalist>
        <button type="button" className="text-xs text-sage-600 underline underline-offset-2 mt-2" onClick={addIndicator}>
          + 지표 추가
        </button>
      </div>

      <label className="block mt-4">
        <span className="block text-sm font-medium mb-1.5">의견 (쉬운 말로 정리해서 적어주세요)</span>
        <textarea className="input min-h-28" value={opinion} onChange={(e) => setOpinion(e.target.value)} />
      </label>

      <label className="flex items-center gap-2 text-sm mt-3">
        <input type="checkbox" checked={isPublicToParent} onChange={(e) => setIsPublicToParent(e.target.checked)} />
        학부모에게 공개 (원본 파일은 제외하고 지표·의견만 노출)
      </label>

      {message && <p className="text-sm text-apricot-600 mt-3">{message}</p>}

      <div className="flex items-center gap-2 mt-4">
        <button className="btn-primary" disabled={saving || !canSubmit} onClick={handleSave}>
          {saving ? "저장 중..." : "저장"}
        </button>
        <button className="btn-ghost" onClick={() => { reset(); setOpen(false); }}>취소</button>
      </div>
    </div>
  );
}

"use client";

/**
 * 새 아동 등록 폼 (관리자 목록 화면)
 * 등록 성공 시 /api/admin/children로 저장하고 화면을 새로고침합니다.
 */

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function AddChildForm() {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [grade, setGrade] = useState("");
  const [birthYear, setBirthYear] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const router = useRouter();

  function reset() {
    setName("");
    setGrade("");
    setBirthYear("");
    setMessage("");
  }

  async function handleSubmit() {
    setSaving(true);
    setMessage("");
    const res = await fetch("/api/admin/children", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        grade,
        birthYear: birthYear ? Number(birthYear) : undefined,
      }),
    });
    setSaving(false);
    if (res.ok) {
      reset();
      setOpen(false);
      router.refresh();
    } else {
      const data = await res.json().catch(() => null);
      setMessage(data?.message || "등록에 실패했습니다. 다시 시도해 주세요.");
    }
  }

  if (!open) {
    return (
      <button className="btn-primary" onClick={() => setOpen(true)}>
        + 새 아동 등록
      </button>
    );
  }

  return (
    <div className="card">
      <p className="section-label mb-4">새 아동 등록</p>
      <Field label="이름">
        <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="예: 박도윤" />
      </Field>
      <Field label="학년">
        <input className="input" value={grade} onChange={(e) => setGrade(e.target.value)} placeholder="예: 초등 2학년" />
      </Field>
      <Field label="출생연도 (선택)">
        <input
          className="input"
          type="number"
          value={birthYear}
          onChange={(e) => setBirthYear(e.target.value)}
          placeholder="예: 2018"
        />
      </Field>

      {message && <p className="text-sm text-apricot-600 mb-3">{message}</p>}

      <div className="flex items-center gap-2">
        <button
          className="btn-primary"
          disabled={saving || !name.trim() || !grade.trim()}
          onClick={handleSubmit}
        >
          {saving ? "등록 중..." : "등록"}
        </button>
        <button
          className="btn-ghost"
          onClick={() => {
            reset();
            setOpen(false);
          }}
        >
          취소
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

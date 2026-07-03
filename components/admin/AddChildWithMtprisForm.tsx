"use client";

/**
 * 아동 등록 + MT-PRIS 검사 결과를 한 번에 입력하는 폼
 * 제출하면 아동과 리포트를 함께 만들고, 바로 그 결과 화면(인쇄 미리보기)으로 이동합니다.
 */

import { useState } from "react";
import { useRouter } from "next/navigation";
import { MAIN_CODES, SUB_CODES, CANONICAL_NAMES } from "@/lib/content/mtpris/types";
import type { MainCode, SubCode } from "@/lib/content/mtpris/types";

const SUB_LABELS: Record<SubCode, string> = {
  p1: "p1 자랑/몰입", p2: "p2 환호/인정", p3: "p3 자유/의미",
  r1: "r1 질서/달성", r2: "r2 만족/여유", r3: "r3 정돈/도움",
  i1: "i1 평화/소통", i2: "i2 터득/토론", i3: "i3 재미/대화",
  s1: "s1 단란/보호", s2: "s2 배려/통제", s3: "s3 몽상/평온",
};

export default function AddChildWithMtprisForm() {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [grade, setGrade] = useState("");
  const [birthYear, setBirthYear] = useState("");
  const [testDate, setTestDate] = useState("");
  const [counselor, setCounselor] = useState("");
  const [mainType, setMainType] = useState<MainCode>("P1");
  const [subType, setSubType] = useState<SubCode>("p1");
  const [scores, setScores] = useState({ P: 50, R: 50, I: 50, S: 50 });
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const router = useRouter();

  function reset() {
    setName(""); setGrade(""); setBirthYear(""); setTestDate(""); setCounselor("");
    setMainType("P1"); setSubType("p1"); setScores({ P: 50, R: 50, I: 50, S: 50 });
    setMessage("");
  }

  async function handleSubmit() {
    setSaving(true);
    setMessage("");
    const res = await fetch("/api/admin/children-with-mtpris", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name, grade, birthYear: birthYear ? Number(birthYear) : undefined,
        testDate, counselor, mainType, subType, scores,
      }),
    });
    setSaving(false);
    if (res.ok) {
      const data = await res.json();
      reset();
      setOpen(false);
      router.push(`/admin/children/${data.child.id}/mtpris/${data.reportId}/print`);
    } else {
      const data = await res.json().catch(() => null);
      setMessage(data?.message || "등록에 실패했습니다. 다시 시도해 주세요.");
    }
  }

  const canSubmit = name.trim() && grade.trim() && testDate && counselor.trim();

  if (!open) {
    return (
      <button className="btn-primary" onClick={() => setOpen(true)}>
        + 검사 결과와 함께 등록
      </button>
    );
  }

  return (
    <div className="card">
      <p className="section-label mb-4">아동 등록 + MT-PRIS 검사 결과</p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label="이름">
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="예: 박도윤" />
        </Field>
        <Field label="학년">
          <input className="input" value={grade} onChange={(e) => setGrade(e.target.value)} placeholder="예: 초등 2학년" />
        </Field>
        <Field label="출생연도 (선택)">
          <input className="input" type="number" value={birthYear} onChange={(e) => setBirthYear(e.target.value)} placeholder="예: 2018" />
        </Field>
        <Field label="검사일">
          <input className="input" type="date" value={testDate} onChange={(e) => setTestDate(e.target.value)} />
        </Field>
        <Field label="담당자">
          <input className="input" value={counselor} onChange={(e) => setCounselor(e.target.value)} placeholder="예: 박지연 선생님" />
        </Field>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-2">
        <Field label="대표기능 (활동할 때의 나)">
          <select className="input" value={mainType} onChange={(e) => setMainType(e.target.value as MainCode)}>
            {MAIN_CODES.map((c) => (
              <option key={c} value={c}>{c} {CANONICAL_NAMES[c]}</option>
            ))}
          </select>
        </Field>
        <Field label="바탕기능 (회복할 때의 나)">
          <select className="input" value={subType} onChange={(e) => setSubType(e.target.value as SubCode)}>
            {SUB_CODES.map((c) => (
              <option key={c} value={c}>{SUB_LABELS[c]}</option>
            ))}
          </select>
        </Field>
      </div>

      <p className="text-sm font-medium mt-4 mb-2">PRIS 현재성 점수 (0~100)</p>
      <div className="grid grid-cols-4 gap-3">
        {(["P", "R", "I", "S"] as const).map((k) => (
          <Field key={k} label={k}>
            <input className="input text-center" type="number" min={0} max={100}
              value={scores[k]}
              onChange={(e) => setScores((s) => ({ ...s, [k]: Math.max(0, Math.min(100, Number(e.target.value) || 0)) }))} />
          </Field>
        ))}
      </div>

      {message && <p className="text-sm text-apricot-600 mt-3">{message}</p>}

      <div className="flex items-center gap-2 mt-5">
        <button className="btn-primary" disabled={saving || !canSubmit} onClick={handleSubmit}>
          {saving ? "등록 중..." : "등록하고 결과 보기"}
        </button>
        <button
          className="btn-ghost"
          onClick={() => { reset(); setOpen(false); }}
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

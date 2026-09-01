"use client";

/**
 * 상담 신청 목록 — 처리 중(신규접수~보류)은 위에, 등록완료/종결은 접어서 아래에.
 * 상태는 7단계 자유 전환이라(예: 어느 단계에서든 보류·종결로 갈 수 있음) 버튼
 * 나열이 아니라 select로 처리합니다. (components/admin/FeedbackList.tsx와
 * 같은 "카드 목록 + 인라인 저장" 구조, 상태 UI만 다름)
 */

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Consultation } from "@/lib/types";

const STATUS_LABEL: Record<Consultation["status"], string> = {
  new: "신규 접수",
  contact_scheduled: "연락 예정",
  consult_scheduled: "상담 일정 확정",
  consult_done: "상담 완료",
  enrolled: "등록 완료",
  on_hold: "보류",
  closed: "종결",
};
const STATUS_COLOR: Record<Consultation["status"], string> = {
  new: "bg-apricot-50 text-apricot-600",
  contact_scheduled: "bg-sage-100 text-sage-700",
  consult_scheduled: "bg-sage-100 text-sage-700",
  consult_done: "bg-sage-100 text-sage-700",
  enrolled: "bg-sage-600 text-white",
  on_hold: "bg-ink/10 text-ink/60",
  closed: "bg-ink/10 text-ink/40",
};

export default function ConsultationList({ consultations }: { consultations: Consultation[] }) {
  const active = consultations.filter((c) => c.status !== "enrolled" && c.status !== "closed");
  const done = consultations.filter((c) => c.status === "enrolled" || c.status === "closed");

  if (consultations.length === 0) {
    return <p className="text-sm text-ink/50 py-10 text-center">아직 상담 신청이 없습니다.</p>;
  }

  return (
    <div className="space-y-6">
      {active.length > 0 && (
        <div className="space-y-3">
          <p className="section-label">처리 중 ({active.length})</p>
          {active.map((c) => <ConsultationCard key={c.id} consultation={c} />)}
        </div>
      )}
      {done.length > 0 && (
        <details className="mt-8">
          <summary className="text-sm text-ink/50 cursor-pointer select-none">
            등록완료·종결 ({done.length}건)
          </summary>
          <div className="space-y-3 mt-4">
            {done.map((c) => <ConsultationCard key={c.id} consultation={c} />)}
          </div>
        </details>
      )}
    </div>
  );
}

function ConsultationCard({ consultation }: { consultation: Consultation }) {
  const [status, setStatus] = useState(consultation.status);
  const [memo, setMemo] = useState(consultation.adminMemo ?? "");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const router = useRouter();

  async function save() {
    setSaving(true);
    setMessage("");
    const res = await fetch(`/api/admin/consultations/${consultation.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status, adminMemo: memo }),
    });
    setSaving(false);
    if (res.ok) router.refresh();
    else setMessage("저장에 실패했습니다.");
  }

  return (
    <div className="card">
      <div className="flex items-start justify-between gap-3 mb-2">
        <div>
          <p className="font-bold">
            {consultation.childName} <span className="text-ink/40 font-normal text-sm">{consultation.childAgeGrade}</span>
          </p>
          <p className="text-xs text-sage-600 mt-0.5">
            보호자 {consultation.guardianName} · {consultation.guardianPhone}
            {consultation.isExistingMember && <span className="ml-1.5 text-apricot-600">(이용중 회원)</span>}
          </p>
        </div>
        <span className={`text-[11px] rounded-full px-2.5 py-1 font-medium shrink-0 ${STATUS_COLOR[consultation.status]}`}>
          {STATUS_LABEL[consultation.status]}
        </span>
      </div>

      <dl className="text-sm space-y-1.5 mt-3">
        <Row label="고민" value={consultation.concern} />
        <Row label="희망 프로그램" value={consultation.desiredProgram} />
        <Row label="희망 일시" value={consultation.desiredDatetime} />
        <Row label="알게 된 경로" value={consultation.referralSource} />
        <Row label="추가 전달사항" value={consultation.additionalMessage} />
      </dl>
      <p className="text-[11px] text-ink/35 mt-2">접수일 {consultation.createdAt.slice(0, 10)}</p>

      <div className="grid grid-cols-2 gap-2 mt-3">
        <label className="block">
          <span className="block text-xs font-medium text-ink/50 mb-1">처리 상태</span>
          <select className="input text-sm" value={status} onChange={(e) => setStatus(e.target.value as Consultation["status"])}>
            {(Object.keys(STATUS_LABEL) as Consultation["status"][]).map((s) => (
              <option key={s} value={s}>{STATUS_LABEL[s]}</option>
            ))}
          </select>
        </label>
        <a href={`tel:${consultation.guardianPhone.replace(/[^0-9+]/g, "")}`} className="btn-ghost text-sm self-end !py-2.5 text-center">
          📞 전화 걸기
        </a>
      </div>

      <label className="block mt-3">
        <span className="block text-xs font-medium text-ink/50 mb-1">관리자 메모 (내부용)</span>
        <textarea className="input min-h-16 text-sm" value={memo} onChange={(e) => setMemo(e.target.value)} />
      </label>

      {message && <p className="text-xs text-apricot-600 mt-2">{message}</p>}

      <div className="flex items-center gap-2 mt-3">
        <button className="btn-primary text-sm !py-2" disabled={saving} onClick={save}>
          {saving ? "저장 중..." : "저장"}
        </button>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value?: string }) {
  if (!value) return null;
  return (
    <div>
      <dt className="text-xs text-ink/40">{label}</dt>
      <dd className="text-ink/70 whitespace-pre-wrap leading-relaxed">{value}</dd>
    </div>
  );
}

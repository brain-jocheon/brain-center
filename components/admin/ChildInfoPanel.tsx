"use client";

/**
 * 아동 상세 화면 "기본 정보" 섹션 — 평소엔 읽기 전용, "수정" 누르면 편집 폼으로 전환.
 * 상태 변경(이용중/대기/종료)과 완전 삭제도 여기서 처리합니다.
 * [보안] guardianPhone은 관리자 화면에서만 사용 — 학부모 화면/URL에는 절대 내려가지 않습니다.
 */

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Child } from "@/lib/types";

const STATUS_LABEL: Record<Child["status"], string> = {
  active: "이용중",
  waiting: "대기",
  ended: "종료",
};

export default function ChildInfoPanel({ child }: { child: Child }) {
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({
    name: child.name,
    grade: child.grade,
    status: child.status,
    birthDate: child.birthDate ?? "",
    gender: child.gender ?? "",
    guardianName: child.guardianName ?? "",
    guardianPhone: child.guardianPhone ?? "",
    serviceType: child.serviceType ?? "",
    classDay: child.classDay ?? "",
    counselor: child.counselor ?? "",
    memo: child.memo ?? "",
  });
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const router = useRouter();

  function update(partial: Partial<typeof form>) {
    setForm((f) => ({ ...f, ...partial }));
  }

  async function handleSave() {
    setSaving(true);
    setMessage("");
    const res = await fetch(`/api/admin/children/${child.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
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

  async function handleDelete() {
    if (!confirm(`${child.name} 아동을 완전히 삭제하시겠습니까?\n검사 리포트와 학부모 링크가 모두 함께 삭제되며, 되돌릴 수 없습니다.`)) return;
    setSaving(true);
    setMessage("");
    const res = await fetch(`/api/admin/children/${child.id}`, { method: "DELETE" });
    setSaving(false);
    if (res.ok) {
      router.push("/admin");
    } else {
      setMessage("삭제에 실패했습니다. 다시 시도해 주세요.");
    }
  }

  if (!editing) {
    return (
      <section className="card">
        <div className="flex items-center justify-between flex-wrap gap-2 mb-4">
          <p className="section-label">기본 정보</p>
          <div className="flex items-center gap-2">
            <span className="text-[11px] bg-sage-50 text-sage-700 rounded-full px-2.5 py-1 font-medium">
              {STATUS_LABEL[child.status]}
            </span>
            <button className="btn-ghost text-xs !px-3.5 !py-1.5" onClick={() => setEditing(true)}>수정</button>
            <button className="btn-ghost text-xs !px-3.5 !py-1.5 !text-apricot-600 !border-apricot-200" disabled={saving} onClick={handleDelete}>
              완전히 삭제
            </button>
          </div>
        </div>
        <dl className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-3 text-sm">
          <InfoItem label="이름" value={child.name} />
          <InfoItem label="학년" value={child.grade} />
          <InfoItem label="생년월일" value={child.birthDate} />
          <InfoItem label="성별" value={child.gender === "M" ? "남" : child.gender === "F" ? "여" : undefined} />
          <InfoItem label="보호자명" value={child.guardianName} />
          <InfoItem label="보호자 연락처" value={child.guardianPhone} />
          <InfoItem label="이용 서비스" value={child.serviceType} />
          <InfoItem label="수업 요일" value={child.classDay} />
          <InfoItem label="담당자" value={child.counselor} />
          <InfoItem label="등록일" value={child.createdAt} />
        </dl>
        {child.memo && (
          <div className="mt-4 pt-4 border-t border-sage-100">
            <p className="text-xs font-semibold text-ink/50 mb-1">메모</p>
            <p className="text-sm whitespace-pre-wrap">{child.memo}</p>
          </div>
        )}
        {message && <p className="text-xs text-apricot-600 mt-3">{message}</p>}
      </section>
    );
  }

  return (
    <section className="card">
      <p className="section-label mb-4">기본 정보 수정</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label="이름">
          <input className="input" value={form.name} onChange={(e) => update({ name: e.target.value })} />
        </Field>
        <Field label="학년">
          <input className="input" value={form.grade} onChange={(e) => update({ grade: e.target.value })} />
        </Field>
        <Field label="생년월일">
          <input className="input" type="date" value={form.birthDate} onChange={(e) => update({ birthDate: e.target.value })} />
        </Field>
        <Field label="성별">
          <select className="input" value={form.gender} onChange={(e) => update({ gender: e.target.value })}>
            <option value="">선택 안 함</option>
            <option value="M">남</option>
            <option value="F">여</option>
          </select>
        </Field>
        <Field label="보호자명">
          <input className="input" value={form.guardianName} onChange={(e) => update({ guardianName: e.target.value })} />
        </Field>
        <Field label="보호자 연락처">
          <input className="input" value={form.guardianPhone} onChange={(e) => update({ guardianPhone: e.target.value })} placeholder="010-0000-0000" />
        </Field>
        <Field label="이용 서비스">
          <input className="input" value={form.serviceType} onChange={(e) => update({ serviceType: e.target.value })} placeholder="예: 뉴로피드백" />
        </Field>
        <Field label="수업 요일">
          <input className="input" value={form.classDay} onChange={(e) => update({ classDay: e.target.value })} placeholder="예: 월,수" />
        </Field>
        <Field label="담당자">
          <input className="input" value={form.counselor} onChange={(e) => update({ counselor: e.target.value })} />
        </Field>
        <Field label="현재 상태">
          <select className="input" value={form.status} onChange={(e) => update({ status: e.target.value as Child["status"] })}>
            <option value="active">이용중</option>
            <option value="waiting">대기</option>
            <option value="ended">종료</option>
          </select>
        </Field>
      </div>
      <Field label="메모">
        <textarea className="input min-h-20" value={form.memo} onChange={(e) => update({ memo: e.target.value })} />
      </Field>

      {message && <p className="text-sm text-apricot-600 mt-2">{message}</p>}

      <div className="flex items-center gap-2 mt-4">
        <button className="btn-primary" disabled={saving || !form.name.trim() || !form.grade.trim()} onClick={handleSave}>
          {saving ? "저장 중..." : "저장"}
        </button>
        <button className="btn-ghost" onClick={() => { setEditing(false); setMessage(""); }}>취소</button>
      </div>
    </section>
  );
}

function InfoItem({ label, value }: { label: string; value?: string }) {
  return (
    <div>
      <dt className="text-xs text-ink/40">{label}</dt>
      <dd className="mt-0.5">{value || <span className="text-ink/30">-</span>}</dd>
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

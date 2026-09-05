"use client";

/**
 * 선생님/스태프 계정 생성 + 활성화 토글 + 담당 아동 배정.
 * (components/admin/NoticeManager.tsx의 "생성/수정 토글 + router.refresh()" 패턴 재사용)
 */

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { Staff } from "@/lib/types";

type StaffWithAssignments = Staff & { assignedChildIds: string[] };
type ChildOption = { id: string; name: string; grade: string };

const ROLE_LABEL: Record<Staff["role"], string> = { admin: "관리자", teacher: "선생님" };

export default function StaffManager({
  staffList,
  childOptions,
}: {
  staffList: StaffWithAssignments[];
  childOptions: ChildOption[];
}) {
  const [creating, setCreating] = useState(false);

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="section-label">선생님 계정</p>
        {!creating && (
          <button className="btn-primary text-sm !px-4 !py-2" onClick={() => setCreating(true)}>
            + 새 계정 만들기
          </button>
        )}
      </div>

      {creating && <StaffCreateForm onDone={() => setCreating(false)} />}

      <div className="space-y-3">
        {staffList.length === 0 && !creating && (
          <p className="text-sm text-ink/40 text-center py-6">아직 등록된 선생님 계정이 없습니다.</p>
        )}
        {staffList.map((s) => (
          <StaffCard key={s.id} staff={s} childOptions={childOptions} />
        ))}
      </div>
    </section>
  );
}

function StaffCreateForm({ onDone }: { onDone: () => void }) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<Staff["role"]>("teacher");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const router = useRouter();

  async function handleSave() {
    setSaving(true);
    setMessage("");
    const res = await fetch("/api/admin/staff", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, phone, password, role }),
    });
    setSaving(false);
    if (res.ok) {
      router.refresh();
      onDone();
    } else {
      const data = await res.json().catch(() => null);
      setMessage(data?.message || "생성에 실패했습니다.");
    }
  }

  return (
    <div className="card">
      <label className="block mb-3">
        <span className="block text-sm font-medium mb-1.5">이름</span>
        <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="예: 임예림" />
      </label>
      <label className="block mb-3">
        <span className="block text-sm font-medium mb-1.5">전화번호 (로그인 아이디로 사용)</span>
        <input className="input" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="010-0000-0000" />
      </label>
      <label className="block mb-3">
        <span className="block text-sm font-medium mb-1.5">초기 비밀번호</span>
        <input className="input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="4자 이상" />
      </label>
      <label className="block mb-3">
        <span className="block text-sm font-medium mb-1.5">역할</span>
        <select className="input" value={role} onChange={(e) => setRole(e.target.value as Staff["role"])}>
          <option value="teacher">선생님 (담당 아동만 열람·작성)</option>
          <option value="admin">관리자 (전체 열람·관리)</option>
        </select>
      </label>
      {message && <p className="text-sm text-apricot-600 mb-2">{message}</p>}
      <div className="flex items-center gap-2">
        <button className="btn-primary" disabled={saving || !name.trim() || !phone.trim() || password.length < 4} onClick={handleSave}>
          {saving ? "생성 중..." : "생성"}
        </button>
        <button className="btn-ghost" onClick={onDone}>취소</button>
      </div>
    </div>
  );
}

function StaffCard({ staff, childOptions }: { staff: StaffWithAssignments; childOptions: ChildOption[] }) {
  const [assigning, setAssigning] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [toggling, setToggling] = useState(false);
  const router = useRouter();

  const assignedChildren = childOptions.filter((c) => staff.assignedChildIds.includes(c.id));

  async function toggleActive() {
    setToggling(true);
    const res = await fetch(`/api/admin/staff/${staff.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active: !staff.active }),
    });
    setToggling(false);
    if (res.ok) router.refresh();
    else alert("변경에 실패했습니다.");
  }

  return (
    <div className="card">
      <div className="flex items-start justify-between gap-3 mb-2">
        <div>
          <p className="font-bold">
            {staff.name} <span className="text-ink/40 font-normal text-sm">{staff.phone}</span>
          </p>
          <p className="text-xs text-sage-600 mt-0.5">{ROLE_LABEL[staff.role]}</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className={`text-[11px] rounded-full px-2.5 py-1 font-medium ${staff.active ? "bg-sage-100 text-sage-700" : "bg-ink/10 text-ink/40"}`}>
            {staff.active ? "활성" : "비활성"}
          </span>
          <button className="text-xs text-sage-600 underline underline-offset-2" disabled={toggling} onClick={toggleActive}>
            {staff.active ? "비활성화" : "다시 활성화"}
          </button>
        </div>
      </div>

      {resetting ? (
        <ResetPasswordPanel staffId={staff.id} onDone={() => setResetting(false)} />
      ) : (
        <button className="text-xs text-sage-600 underline underline-offset-2" onClick={() => setResetting(true)}>
          비밀번호 재설정
        </button>
      )}

      {staff.role === "teacher" && (
        <>
          <p className="text-xs text-ink/40 mt-3 mb-1.5">담당 아동 {assignedChildren.length}명</p>
          {assignedChildren.length > 0 && (
            <p className="text-sm text-ink/70 mb-2">
              {assignedChildren.map((c) => c.name).join(", ")}
            </p>
          )}
          {assigning ? (
            <AssignPanel staff={staff} childOptions={childOptions} onDone={() => setAssigning(false)} />
          ) : (
            <button className="text-xs text-sage-600 underline underline-offset-2" onClick={() => setAssigning(true)}>
              담당 아동 관리
            </button>
          )}
        </>
      )}
    </div>
  );
}

function AssignPanel({
  staff,
  childOptions,
  onDone,
}: {
  staff: StaffWithAssignments;
  childOptions: ChildOption[];
  onDone: () => void;
}) {
  const [filter, setFilter] = useState("");
  const [pending, setPending] = useState<string | null>(null);
  const router = useRouter();

  const filtered = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return childOptions;
    return childOptions.filter((c) => c.name.toLowerCase().includes(q));
  }, [childOptions, filter]);

  async function toggle(childId: string, currentlyAssigned: boolean) {
    setPending(childId);
    const res = await fetch(`/api/admin/staff/${staff.id}/assignments${currentlyAssigned ? `?childId=${childId}` : ""}`, {
      method: currentlyAssigned ? "DELETE" : "POST",
      headers: { "Content-Type": "application/json" },
      body: currentlyAssigned ? undefined : JSON.stringify({ childId }),
    });
    setPending(null);
    if (res.ok) router.refresh();
  }

  return (
    <div className="mt-2 rounded-xl border border-sage-100 p-3">
      <input
        className="input mb-2"
        placeholder="이름으로 검색"
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
      />
      <div className="max-h-48 overflow-y-auto space-y-1">
        {filtered.map((c) => {
          const assigned = staff.assignedChildIds.includes(c.id);
          return (
            <label key={c.id} className="flex items-center gap-2 text-sm px-2 py-1 rounded-lg hover:bg-sage-50">
              <input
                type="checkbox"
                checked={assigned}
                disabled={pending === c.id}
                onChange={() => toggle(c.id, assigned)}
              />
              {c.name} <span className="text-ink/40 text-xs">{c.grade}</span>
            </label>
          );
        })}
      </div>
      <button className="text-xs text-ink/40 mt-2" onClick={onDone}>닫기</button>
    </div>
  );
}

function ResetPasswordPanel({ staffId, onDone }: { staffId: string; onDone: () => void }) {
  const [newPassword, setNewPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const router = useRouter();

  async function handleReset() {
    setSaving(true);
    setMessage("");
    const res = await fetch(`/api/admin/staff/${staffId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ newPassword }),
    });
    setSaving(false);
    if (res.ok) {
      router.refresh();
      onDone();
    } else {
      const data = await res.json().catch(() => null);
      setMessage(data?.message || "재설정에 실패했습니다.");
    }
  }

  return (
    <div className="mt-2 rounded-xl border border-sage-100 p-3">
      <input
        className="input mb-2"
        type="password"
        placeholder="새 비밀번호 (4자 이상)"
        value={newPassword}
        onChange={(e) => setNewPassword(e.target.value)}
      />
      {message && <p className="text-xs text-apricot-600 mb-2">{message}</p>}
      <div className="flex items-center gap-2">
        <button
          className="btn-primary !px-3 !py-1.5 text-xs"
          disabled={saving || newPassword.length < 4}
          onClick={handleReset}
        >
          {saving ? "재설정 중..." : "재설정"}
        </button>
        <button className="text-xs text-ink/40" onClick={onDone}>취소</button>
      </div>
    </div>
  );
}

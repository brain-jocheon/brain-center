"use client";

/**
 * 형제자매(가족) 그룹 관리 — 같은 보호자 연락처(guardianPhone)를 쓰는 아이들을
 * "형제자매"로 취급합니다 (홈페이지 이름+비밀번호 로그인의 형제자매 자동 전환도
 * 이 값을 기준으로 동작). 여기서는 그 연락처를 맞춰주는 걸 도와줍니다 —
 * 새 스키마 컬럼 없이, 기존 "보호자 연락처" 필드를 그대로 그룹 키로 씁니다.
 */

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

interface ChildBasic {
  id: string;
  name: string;
  grade: string;
  guardianPhone?: string;
}

export default function FamilyGroupPanel({ child, allChildren }: { child: ChildBasic; allChildren: ChildBasic[] }) {
  const [adding, setAdding] = useState(false);
  const [query, setQuery] = useState("");
  const [phoneInput, setPhoneInput] = useState(child.guardianPhone ?? "");
  const [pendingChildId, setPendingChildId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const router = useRouter();

  const siblings = useMemo(
    () => allChildren.filter((c) => c.id !== child.id && c.guardianPhone && c.guardianPhone === child.guardianPhone),
    [allChildren, child]
  );

  const candidates = useMemo(() => {
    const excludeIds = new Set([child.id, ...siblings.map((s) => s.id)]);
    const q = query.trim().toLowerCase();
    return allChildren
      .filter((c) => !excludeIds.has(c.id))
      .filter((c) => !q || c.name.toLowerCase().includes(q))
      .slice(0, 8);
  }, [allChildren, child.id, siblings, query]);

  async function patchChild(id: string, guardianPhone: string): Promise<boolean> {
    const res = await fetch(`/api/admin/children/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ guardianPhone }),
    });
    return res.ok;
  }

  async function handleLink(otherChildId: string) {
    setSaving(true);
    setMessage("");

    let phone = child.guardianPhone;
    if (!phone) {
      // 현재 아이에게 아직 보호자 연락처가 없으면, 입력받은 값을 먼저 현재 아이에게도 저장
      if (!phoneInput.trim()) {
        setPendingChildId(otherChildId);
        setSaving(false);
        setMessage("먼저 보호자 연락처를 입력해 주세요.");
        return;
      }
      phone = phoneInput.trim();
      const ok = await patchChild(child.id, phone);
      if (!ok) {
        setSaving(false);
        setMessage("저장에 실패했습니다.");
        return;
      }
    }

    const ok = await patchChild(otherChildId, phone);
    setSaving(false);
    if (ok) {
      setAdding(false);
      setQuery("");
      setPendingChildId(null);
      router.refresh();
    } else {
      setMessage("저장에 실패했습니다.");
    }
  }

  async function handleUnlink(siblingId: string) {
    if (!confirm("이 아이를 가족 그룹에서 뺄까요? (보호자 연락처만 지워지고, 다른 정보는 그대로예요)")) return;
    setSaving(true);
    const ok = await patchChild(siblingId, "");
    setSaving(false);
    if (ok) router.refresh();
    else setMessage("제외에 실패했습니다.");
  }

  return (
    <section className="card">
      <div className="flex items-center justify-between mb-3">
        <p className="section-label">가족 그룹 (형제자매)</p>
        {!adding && (
          <button className="btn-ghost text-xs !px-3.5 !py-1.5" onClick={() => setAdding(true)}>+ 다른 아이 추가</button>
        )}
      </div>

      {siblings.length === 0 && !adding && (
        <p className="text-sm text-ink/40">아직 연결된 형제자매가 없습니다.</p>
      )}

      {siblings.length > 0 && (
        <ul className="space-y-2 mb-2">
          {siblings.map((s) => (
            <li key={s.id} className="flex items-center justify-between rounded-xl bg-sage-50 px-3 py-2 text-sm">
              <Link href={`/admin/children/${s.id}`} className="text-sage-700 font-medium hover:underline">
                {s.name} <span className="text-ink/40 font-normal">{s.grade}</span>
              </Link>
              <button className="text-xs text-apricot-600 underline underline-offset-2" disabled={saving} onClick={() => handleUnlink(s.id)}>
                제외
              </button>
            </li>
          ))}
        </ul>
      )}

      {adding && (
        <div className="mt-3 pt-3 border-t border-sage-100">
          {!child.guardianPhone && (
            <label className="block mb-3">
              <span className="block text-sm font-medium mb-1.5">이 아이의 보호자 연락처 (그룹 기준값)</span>
              <input
                className="input text-sm"
                placeholder="010-0000-0000"
                value={phoneInput}
                onChange={(e) => setPhoneInput(e.target.value)}
              />
            </label>
          )}
          <input
            className="input text-sm mb-2"
            placeholder="이름으로 검색"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <div className="max-h-48 overflow-y-auto rounded-xl border border-sage-100 p-2 space-y-1">
            {candidates.length === 0 && <p className="text-xs text-ink/40 px-2 py-1">검색 결과가 없습니다.</p>}
            {candidates.map((c) => (
              <button
                key={c.id}
                className="w-full flex items-center justify-between text-sm px-2 py-1.5 rounded-lg hover:bg-sage-50 text-left"
                disabled={saving}
                onClick={() => handleLink(c.id)}
              >
                <span>{c.name} <span className="text-ink/40 text-xs">{c.grade}</span></span>
                <span className="text-xs text-sage-600">추가</span>
              </button>
            ))}
          </div>
          {message && <p className="text-xs text-apricot-600 mt-2">{message}</p>}
          <button className="btn-ghost text-xs mt-3" onClick={() => { setAdding(false); setMessage(""); setQuery(""); }}>
            닫기
          </button>
        </div>
      )}

      {!adding && message && <p className="text-xs text-apricot-600 mt-2">{message}</p>}

      <p className="text-[11px] text-ink/35 mt-3 pt-3 border-t border-sage-100">
        같은 보호자 연락처를 쓰는 아이끼리 형제자매로 인식돼요 — 홈페이지에서 아이 이름+비밀번호로 로그인할 때,
        같은 비밀번호로도 확인되는 형제자매는 자동으로 함께 보여집니다.
      </p>
    </section>
  );
}

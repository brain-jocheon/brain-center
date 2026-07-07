"use client";

/**
 * 홈페이지 "센터소개 / 위치 / 연락처" 문구 편집 — 평소엔 읽기 전용, "수정" 누르면 편집 폼으로 전환.
 * 여기서 저장한 내용은 로그인 없이 누구나 보는 공개 홈페이지(app/page.tsx)에 그대로 노출됩니다.
 */

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { SiteSettings } from "@/lib/types";

export default function SiteSettingsForm({ settings }: { settings: SiteSettings }) {
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({
    aboutText: settings.aboutText,
    address: settings.address ?? "",
    phone: settings.phone ?? "",
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
    const res = await fetch("/api/admin/site-settings", {
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

  if (!editing) {
    return (
      <section className="card">
        <div className="flex items-center justify-between mb-4">
          <p className="section-label">센터소개 / 위치 / 연락처</p>
          <button className="btn-ghost text-xs !px-3.5 !py-1.5" onClick={() => setEditing(true)}>수정</button>
        </div>
        <p className="text-sm whitespace-pre-wrap leading-relaxed mb-4">{settings.aboutText}</p>
        <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
          <div>
            <dt className="text-xs text-ink/40">위치</dt>
            <dd className="mt-0.5">{settings.address || <span className="text-ink/30">아직 입력 안 함</span>}</dd>
          </div>
          <div>
            <dt className="text-xs text-ink/40">연락처</dt>
            <dd className="mt-0.5">{settings.phone || <span className="text-ink/30">아직 입력 안 함</span>}</dd>
          </div>
        </dl>
      </section>
    );
  }

  return (
    <section className="card">
      <p className="section-label mb-4">센터소개 / 위치 / 연락처 수정</p>
      <label className="block mb-4">
        <span className="block text-sm font-medium mb-1.5">센터 소개 문구</span>
        <textarea
          className="input min-h-32"
          value={form.aboutText}
          onChange={(e) => update({ aboutText: e.target.value })}
        />
      </label>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <label className="block">
          <span className="block text-sm font-medium mb-1.5">위치</span>
          <input
            className="input"
            value={form.address}
            onChange={(e) => update({ address: e.target.value })}
            placeholder="예: 제주시 ○○로 12, 3층"
          />
        </label>
        <label className="block">
          <span className="block text-sm font-medium mb-1.5">연락처</span>
          <input
            className="input"
            value={form.phone}
            onChange={(e) => update({ phone: e.target.value })}
            placeholder="예: 064-000-0000"
          />
        </label>
      </div>

      {message && <p className="text-sm text-apricot-600 mt-3">{message}</p>}

      <div className="flex items-center gap-2 mt-4">
        <button className="btn-primary" disabled={saving || !form.aboutText.trim()} onClick={handleSave}>
          {saving ? "저장 중..." : "저장"}
        </button>
        <button className="btn-ghost" onClick={() => { setEditing(false); setMessage(""); }}>취소</button>
      </div>
    </section>
  );
}

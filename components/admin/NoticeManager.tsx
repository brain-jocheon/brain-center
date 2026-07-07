"use client";

/**
 * 공지사항(블로그 글) 작성/수정/삭제 — 로그인 없이 보이는 공개 홈페이지에 즉시 노출됩니다.
 * [주의] 아이 개인정보나 활동 사진은 여기 넣지 마세요 — 그건 "센터 소식 관리"(학부모 전용)로.
 */

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Notice } from "@/lib/types";

export default function NoticeManager({ notices }: { notices: Notice[] }) {
  const [creating, setCreating] = useState(false);

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="section-label">공지사항</p>
        {!creating && (
          <button className="btn-primary text-sm !px-4 !py-2" onClick={() => setCreating(true)}>
            + 새 공지 작성
          </button>
        )}
      </div>

      {creating && <NoticeEditor onDone={() => setCreating(false)} />}

      <div className="space-y-3">
        {notices.length === 0 && !creating && (
          <p className="text-sm text-ink/40 text-center py-6">아직 작성된 공지가 없습니다.</p>
        )}
        {notices.map((n) => (
          <NoticeCard key={n.id} notice={n} />
        ))}
      </div>
    </section>
  );
}

function NoticeCard({ notice }: { notice: Notice }) {
  const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const router = useRouter();

  async function handleDelete() {
    if (!confirm(`"${notice.title}" 공지를 삭제하시겠습니까?`)) return;
    setDeleting(true);
    const res = await fetch(`/api/admin/notices/${notice.id}`, { method: "DELETE" });
    setDeleting(false);
    if (res.ok) router.refresh();
    else alert("삭제에 실패했습니다. 다시 시도해 주세요.");
  }

  if (editing) {
    return <NoticeEditor notice={notice} onDone={() => setEditing(false)} />;
  }

  return (
    <div className="card">
      <div className="flex items-start justify-between gap-3 mb-2">
        <p className="font-bold">{notice.title}</p>
        <div className="flex items-center gap-2 shrink-0">
          <button className="text-xs text-sage-600 underline underline-offset-2" onClick={() => setEditing(true)}>수정</button>
          <button className="text-xs text-apricot-600 underline underline-offset-2" disabled={deleting} onClick={handleDelete}>삭제</button>
        </div>
      </div>
      <p className="text-sm text-ink/70 whitespace-pre-wrap leading-relaxed mb-2">{notice.body}</p>
      <p className="text-xs text-ink/35">{notice.createdAt.slice(0, 10)}</p>
    </div>
  );
}

function NoticeEditor({ notice, onDone }: { notice?: Notice; onDone: () => void }) {
  const [title, setTitle] = useState(notice?.title ?? "");
  const [body, setBody] = useState(notice?.body ?? "");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const router = useRouter();

  async function handleSave() {
    setSaving(true);
    setMessage("");
    const res = await fetch(notice ? `/api/admin/notices/${notice.id}` : "/api/admin/notices", {
      method: notice ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, body }),
    });
    setSaving(false);
    if (res.ok) {
      router.refresh();
      onDone();
    } else {
      const data = await res.json().catch(() => null);
      setMessage(data?.message || "저장에 실패했습니다. 다시 시도해 주세요.");
    }
  }

  return (
    <div className="card">
      <label className="block mb-3">
        <span className="block text-sm font-medium mb-1.5">제목</span>
        <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="예: 여름방학 특별 프로그램 안내" />
      </label>
      <label className="block mb-3">
        <span className="block text-sm font-medium mb-1.5">내용</span>
        <textarea className="input min-h-28" value={body} onChange={(e) => setBody(e.target.value)} />
      </label>
      {message && <p className="text-sm text-apricot-600 mb-2">{message}</p>}
      <div className="flex items-center gap-2">
        <button className="btn-primary" disabled={saving || !title.trim() || !body.trim()} onClick={handleSave}>
          {saving ? "저장 중..." : "저장"}
        </button>
        <button className="btn-ghost" onClick={onDone}>취소</button>
      </div>
    </div>
  );
}

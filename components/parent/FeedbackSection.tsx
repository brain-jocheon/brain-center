"use client";

/**
 * 학부모 마이페이지 — 문의/건의사항 남기기 + 내가 남긴 문의 내역 확인
 * [보안] childId는 클라이언트가 넣지 않고, 서버가 token으로 확인합니다.
 */

import { useState } from "react";
import type { ParentFeedback } from "@/lib/types";

const TYPE_OPTIONS: { value: ParentFeedback["type"]; label: string }[] = [
  { value: "class", label: "수업 관련" },
  { value: "makeup", label: "보강/출결 관련" },
  { value: "share", label: "아이 상태 공유" },
  { value: "suggestion", label: "건의사항" },
  { value: "other", label: "기타" },
];
const STATUS_LABEL: Record<ParentFeedback["status"], string> = {
  pending: "확인 전",
  reviewed: "확인 완료",
  answered: "답변 완료",
};
const STATUS_COLOR: Record<ParentFeedback["status"], string> = {
  pending: "bg-apricot-50 text-apricot-600",
  reviewed: "bg-sage-100 text-sage-700",
  answered: "bg-sage-600 text-white",
};

export default function FeedbackSection({
  token,
  items,
  onSubmitted,
}: {
  token: string;
  items: ParentFeedback[];
  onSubmitted: (feedback: ParentFeedback) => void;
}) {
  const [type, setType] = useState<ParentFeedback["type"]>("class");
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || !content.trim()) return;
    setSaving(true);
    setError("");
    setDone(false);
    try {
      const res = await fetch("/api/report/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, type, title: title.trim(), content: content.trim() }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.message || "제출에 실패했습니다. 잠시 후 다시 시도해 주세요.");
        return;
      }
      onSubmitted(data.feedback as ParentFeedback);
      setTitle("");
      setContent("");
      setDone(true);
    } catch {
      setError("연결에 문제가 있습니다. 잠시 후 다시 시도해 주세요.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-5">
      <section className="card">
        <p className="section-label mb-1">문의/건의사항 남기기</p>
        <p className="text-xs text-ink/50 mb-4 leading-relaxed">
          선생님께 전달하고 싶은 내용이나 요청사항을 남겨주시면 확인 후 답변드릴게요.
        </p>
        <form onSubmit={handleSubmit} className="space-y-3">
          <label className="block">
            <span className="block text-sm font-medium mb-1.5">문의 유형</span>
            <select className="input" value={type} onChange={(e) => setType(e.target.value as ParentFeedback["type"])}>
              {TYPE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="block text-sm font-medium mb-1.5">제목</span>
            <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="제목을 입력해 주세요" />
          </label>
          <label className="block">
            <span className="block text-sm font-medium mb-1.5">내용</span>
            <textarea
              className="input min-h-28"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="전달하고 싶은 내용을 자유롭게 적어주세요"
            />
          </label>
          {error && <p className="text-sm text-apricot-600">{error}</p>}
          {done && <p className="text-sm text-sage-700">문의가 접수되었어요. 확인 후 답변드릴게요.</p>}
          <button type="submit" className="btn-primary w-full" disabled={saving || !title.trim() || !content.trim()}>
            {saving ? "제출 중..." : "제출하기"}
          </button>
        </form>
      </section>

      <section className="card">
        <p className="section-label mb-4">내가 남긴 문의 내역</p>
        {items.length === 0 ? (
          <p className="text-sm text-ink/40 text-center py-6">아직 남긴 문의가 없어요.</p>
        ) : (
          <div className="space-y-3">
            {items.map((f) => (
              <div key={f.id} className="rounded-xl border border-sage-100 p-3.5">
                <div className="flex items-start justify-between gap-2 mb-1.5">
                  <p className="font-semibold text-sm">{f.title}</p>
                  <span className={`text-[11px] rounded-full px-2 py-0.5 font-medium shrink-0 ${STATUS_COLOR[f.status]}`}>
                    {STATUS_LABEL[f.status]}
                  </span>
                </div>
                <p className="text-sm text-ink/70 leading-relaxed whitespace-pre-wrap">{f.content}</p>
                <p className="text-[11px] text-ink/35 mt-2">{f.createdAt.slice(0, 10)}</p>
                {f.adminReply && (
                  <div className="mt-2.5 rounded-lg bg-sage-50 px-3 py-2.5">
                    <p className="text-xs font-semibold text-sage-700 mb-1">센터 답변</p>
                    <p className="text-sm text-ink/80 leading-relaxed whitespace-pre-wrap">{f.adminReply}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

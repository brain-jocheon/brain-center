"use client";

/**
 * 학부모 문의/건의사항 목록 — 확인 전/확인 완료/답변 완료 구분, 답변 작성 가능.
 */

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { ParentFeedback } from "@/lib/types";

const TYPE_LABEL: Record<ParentFeedback["type"], string> = {
  class: "수업 관련",
  makeup: "보강/출결 관련",
  share: "아이 상태 공유",
  suggestion: "건의사항",
  other: "기타",
};
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

export default function FeedbackList({
  feedback,
  childNames,
}: {
  feedback: ParentFeedback[];
  childNames: Record<string, { name: string; grade: string }>;
}) {
  const pending = feedback.filter((f) => f.status !== "answered");
  const answered = feedback.filter((f) => f.status === "answered");

  if (feedback.length === 0) {
    return <p className="text-sm text-ink/50 py-10 text-center">아직 학부모 문의가 없습니다.</p>;
  }

  return (
    <div className="space-y-6">
      {pending.length > 0 && (
        <div className="space-y-3">
          <p className="section-label">확인 필요 ({pending.length})</p>
          {pending.map((f) => (
            <FeedbackCard key={f.id} feedback={f} child={childNames[f.childId]} />
          ))}
        </div>
      )}
      {answered.length > 0 && (
        <details className="mt-8">
          <summary className="text-sm text-ink/50 cursor-pointer select-none">
            답변 완료 ({answered.length}건)
          </summary>
          <div className="space-y-3 mt-4">
            {answered.map((f) => (
              <FeedbackCard key={f.id} feedback={f} child={childNames[f.childId]} />
            ))}
          </div>
        </details>
      )}
    </div>
  );
}

function FeedbackCard({ feedback, child }: { feedback: ParentFeedback; child?: { name: string; grade: string } }) {
  const [reply, setReply] = useState(feedback.adminReply ?? "");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const router = useRouter();

  async function updateStatus(status: ParentFeedback["status"]) {
    setSaving(true);
    setMessage("");
    const res = await fetch(`/api/admin/feedback/${feedback.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status, adminReply: reply.trim() || undefined }),
    });
    setSaving(false);
    if (res.ok) router.refresh();
    else setMessage("처리에 실패했습니다.");
  }

  return (
    <div className="card">
      <div className="flex items-start justify-between gap-3 mb-2">
        <div>
          {child ? (
            <Link href={`/admin/children/${feedback.childId}`} className="font-bold text-sage-700 hover:underline">
              {child.name} <span className="text-ink/40 font-normal text-sm">{child.grade}</span>
            </Link>
          ) : (
            <p className="font-bold text-ink/40">(삭제된 아이)</p>
          )}
          <p className="text-xs text-sage-600 mt-0.5">{TYPE_LABEL[feedback.type]}</p>
        </div>
        <span className={`text-[11px] rounded-full px-2.5 py-1 font-medium shrink-0 ${STATUS_COLOR[feedback.status]}`}>
          {STATUS_LABEL[feedback.status]}
        </span>
      </div>

      <p className="font-semibold text-sm mt-3">{feedback.title}</p>
      <p className="text-sm text-ink/70 mt-1 leading-relaxed whitespace-pre-wrap">{feedback.content}</p>
      <p className="text-[11px] text-ink/35 mt-2">작성일 {feedback.createdAt.slice(0, 10)}</p>

      <label className="block mt-3">
        <span className="block text-xs font-medium text-ink/50 mb-1">답변 (선택)</span>
        <textarea
          className="input min-h-16 text-sm"
          value={reply}
          onChange={(e) => setReply(e.target.value)}
          placeholder="학부모님께 전달할 답변을 입력해 주세요."
        />
      </label>

      {message && <p className="text-xs text-apricot-600 mt-2">{message}</p>}

      <div className="flex items-center gap-2 mt-3">
        {feedback.status === "pending" && (
          <button className="btn-ghost text-sm !py-2" disabled={saving} onClick={() => updateStatus("reviewed")}>
            확인함
          </button>
        )}
        <button className="btn-primary text-sm !py-2" disabled={saving || !reply.trim()} onClick={() => updateStatus("answered")}>
          답변 저장
        </button>
      </div>
    </div>
  );
}

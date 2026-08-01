"use client";

/**
 * 아이 상세 "수업 코멘트" 탭 — 이 아이가 참여한 수업기록들을 최신순으로 보여주고,
 * 코멘트 텍스트/공개여부를 바로 수정할 수 있게 합니다(관리자 실수 수정 대비).
 */

import { useState } from "react";

const ACTIVITY_TYPE_LABEL: Record<string, string> = {
  class: "수업", craft: "만들기", cooking: "요리", neurofeedback: "뉴로피드백", event: "행사", other: "기타",
};

export interface ChildCommentItem {
  childCommentId?: string;
  classDate: string;
  activityName: string;
  activityType: string;
  comment: string;
  isPublicToParent: boolean;
}

export default function ChildCommentsHistory({ items }: { items: ChildCommentItem[] }) {
  if (items.length === 0) {
    return (
      <div className="card text-center text-sm text-ink/50 py-10">
        아직 등록된 수업 코멘트가 없습니다.
        <br />
        관리자 홈의 "+ 수업 기록 등록"에서 사진/코멘트를 남길 수 있습니다.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {items.map((item, i) => (
        <CommentCard key={item.childCommentId ?? i} item={item} />
      ))}
    </div>
  );
}

function CommentCard({ item }: { item: ChildCommentItem }) {
  const [editing, setEditing] = useState(false);
  const [comment, setComment] = useState(item.comment);
  const [isPublic, setIsPublic] = useState(item.isPublicToParent);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  async function save() {
    if (!item.childCommentId) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/child-comments/${item.childCommentId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ comment, isPublicToParent: isPublic }),
      });
      if (res.ok) {
        setSaved(true);
        setEditing(false);
        setTimeout(() => setSaved(false), 1500);
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="card">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <p className="text-sm font-semibold">
          {item.classDate} · {item.activityName}
          <span className="text-xs text-ink/40 font-normal ml-2">{ACTIVITY_TYPE_LABEL[item.activityType] ?? item.activityType}</span>
        </p>
        <span className={`text-xs ${isPublic ? "text-sage-600" : "text-ink/40"}`}>
          {isPublic ? "학부모 공개" : "비공개"}
        </span>
      </div>

      {editing ? (
        <div className="mt-2 space-y-2">
          <textarea className="input min-h-16" value={comment} onChange={(e) => setComment(e.target.value)} />
          <label className="flex items-center gap-2 text-xs">
            <input type="checkbox" checked={isPublic} onChange={(e) => setIsPublic(e.target.checked)} />
            이 아이 학부모에게 공개
          </label>
          <div className="flex gap-2">
            <button className="btn-primary text-sm !py-2" disabled={saving} onClick={save}>
              {saving ? "저장 중..." : "저장"}
            </button>
            <button className="btn-ghost text-sm !py-2" onClick={() => { setEditing(false); setComment(item.comment); setIsPublic(item.isPublicToParent); }}>
              취소
            </button>
          </div>
        </div>
      ) : (
        <>
          <p className="text-sm text-ink/70 mt-1.5 leading-relaxed whitespace-pre-wrap">{comment || "(코멘트 없음)"}</p>
          <div className="flex items-center gap-3 mt-2">
            {item.childCommentId && (
              <button className="text-xs text-sage-600" onClick={() => setEditing(true)}>수정</button>
            )}
            {saved && <span className="text-xs text-sage-600">저장됨</span>}
          </div>
        </>
      )}
    </div>
  );
}

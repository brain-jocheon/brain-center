"use client";

/**
 * 아이 상세 "수업 코멘트" 탭 — 이 아이가 참여한 수업기록들을 최신순으로 보여주고,
 * [15단계] 단계형 관찰(참여도/집중도/이해도/정서상태/상호작용)·내부메모·학부모 공개초안을
 * 조회·수정하고, 관리자만 학부모 공개를 승인/취소할 수 있게 합니다.
 *
 * [보안/중요] "이 아이 학부모에게 공개" 같은 즉시공개 체크박스는 여기 없습니다 — 학부모 공개용
 * 내용은 별도 초안 칸에 적고, isFullAdmin인 사람만 명시적으로 "승인"을 눌러야 실제로
 * 공개됩니다(자동 공개 금지). 선생님은 내용 작성·수정까지만 가능합니다.
 */

import { useState } from "react";
import RatingStepper from "./RatingStepper";

const ACTIVITY_TYPE_LABEL: Record<string, string> = {
  class: "수업", craft: "만들기", cooking: "요리", neurofeedback: "뉴로피드백", event: "행사", other: "기타",
};

const RATING_LABELS: { key: keyof RatingLevels; label: string }[] = [
  { key: "participationLevel", label: "참여도" },
  { key: "concentrationLevel", label: "집중도" },
  { key: "understandingLevel", label: "이해도" },
  { key: "emotionalStateLevel", label: "정서상태" },
  { key: "interactionLevel", label: "상호작용" },
];

interface RatingLevels {
  participationLevel?: number;
  concentrationLevel?: number;
  understandingLevel?: number;
  emotionalStateLevel?: number;
  interactionLevel?: number;
}

export interface ChildCommentItem {
  childCommentId?: string;
  classDate: string;
  activityName: string;
  activityType: string;
  comment: string;
  isPublicToParent: boolean;
  parentApprovedAt?: string;
  parentApprovedBy?: string;
  strengthsNote?: string;
  difficultiesNote?: string;
  teacherMemo?: string;
  specialNote?: string;
  nextSessionGoal?: string;
  parentActivitySummary?: string;
  parentPositiveMoment?: string;
  parentObservedChange?: string;
  parentNextGoal?: string;
  parentHomeTip?: string;
  participationLevel?: number;
  concentrationLevel?: number;
  understandingLevel?: number;
  emotionalStateLevel?: number;
  interactionLevel?: number;
  /** [16단계] AI가 생성한 5분할 초안 원본(적용 전까지는 위 parent* 라이브 필드와 별개) */
  aiParentDraft?: {
    activitySummary: string;
    positiveMoment: string;
    observedChange: string;
    nextGoal: string;
    homeTip: string;
  };
}

export default function ChildCommentsHistory({ items, canApprove }: { items: ChildCommentItem[]; canApprove: boolean }) {
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
        <CommentCard key={item.childCommentId ?? i} item={item} canApprove={canApprove} />
      ))}
    </div>
  );
}

function RatingRow({
  values,
  editing,
  onChange,
}: {
  values: RatingLevels;
  editing: boolean;
  onChange: (key: keyof RatingLevels, v: number | null) => void;
}) {
  if (!editing) {
    const filled = RATING_LABELS.filter((r) => values[r.key] !== undefined && values[r.key] !== null);
    if (filled.length === 0) return null;
    return (
      <div className="flex flex-wrap gap-1.5 mt-2">
        {filled.map((r) => (
          <span key={r.key} className="text-[11px] bg-sage-50 text-sage-700 rounded-full px-2 py-0.5">
            {r.label} {values[r.key]}
          </span>
        ))}
      </div>
    );
  }
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mt-2">
      {RATING_LABELS.map((r) => (
        <RatingStepper key={r.key} label={r.label} value={values[r.key]} onChange={(v) => onChange(r.key, v)} />
      ))}
    </div>
  );
}

function CommentCard({ item, canApprove }: { item: ChildCommentItem; canApprove: boolean }) {
  const [editing, setEditing] = useState(false);
  const [comment, setComment] = useState(item.comment);
  const [ratings, setRatings] = useState<RatingLevels>({
    participationLevel: item.participationLevel,
    concentrationLevel: item.concentrationLevel,
    understandingLevel: item.understandingLevel,
    emotionalStateLevel: item.emotionalStateLevel,
    interactionLevel: item.interactionLevel,
  });
  const [strengthsNote, setStrengthsNote] = useState(item.strengthsNote ?? "");
  const [difficultiesNote, setDifficultiesNote] = useState(item.difficultiesNote ?? "");
  const [teacherMemo, setTeacherMemo] = useState(item.teacherMemo ?? "");
  const [specialNote, setSpecialNote] = useState(item.specialNote ?? "");
  const [nextSessionGoal, setNextSessionGoal] = useState(item.nextSessionGoal ?? "");
  const [parentActivitySummary, setParentActivitySummary] = useState(item.parentActivitySummary ?? "");
  const [parentPositiveMoment, setParentPositiveMoment] = useState(item.parentPositiveMoment ?? "");
  const [parentObservedChange, setParentObservedChange] = useState(item.parentObservedChange ?? "");
  const [parentNextGoal, setParentNextGoal] = useState(item.parentNextGoal ?? "");
  const [parentHomeTip, setParentHomeTip] = useState(item.parentHomeTip ?? "");
  const [isPublic, setIsPublic] = useState(item.isPublicToParent);
  const [approvedAt, setApprovedAt] = useState(item.parentApprovedAt);
  const [approvedBy, setApprovedBy] = useState(item.parentApprovedBy);
  const [saving, setSaving] = useState(false);
  const [approving, setApproving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [message, setMessage] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [aiDraft, setAiDraft] = useState(item.aiParentDraft ?? null);
  const [aiMessage, setAiMessage] = useState("");

  async function patch(body: Record<string, unknown>): Promise<boolean> {
    if (!item.childCommentId) return false;
    const res = await fetch(`/api/admin/child-comments/${item.childCommentId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => null);
      setMessage(data?.message || "저장에 실패했습니다.");
      return false;
    }
    return true;
  }

  async function save() {
    setSaving(true);
    setMessage("");
    const ok = await patch({
      comment,
      ...ratings,
      strengthsNote,
      difficultiesNote,
      teacherMemo,
      specialNote,
      nextSessionGoal,
      parentActivitySummary,
      parentPositiveMoment,
      parentObservedChange,
      parentNextGoal,
      parentHomeTip,
    });
    setSaving(false);
    if (ok) {
      setSaved(true);
      setEditing(false);
      setTimeout(() => setSaved(false), 1500);
    }
  }

  async function generateAiDraft() {
    if (!item.childCommentId) return;
    setAiLoading(true);
    setAiMessage("");
    try {
      const res = await fetch("/api/admin/ai/parent-comment-draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          childCommentId: item.childCommentId,
          activityName: item.activityName,
          activityType: item.activityType,
          classDate: item.classDate,
          ...ratings,
          strengthsNote, difficultiesNote, specialNote, nextSessionGoal,
        }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.ok) {
        setAiMessage(data?.message || "AI 초안 생성에 실패했습니다.");
        return;
      }
      setAiDraft(data.draft);
    } catch {
      setAiMessage("네트워크 오류로 AI 초안 생성에 실패했습니다.");
    } finally {
      setAiLoading(false);
    }
  }

  function applyAiDraft() {
    if (!aiDraft) return;
    setParentActivitySummary(aiDraft.activitySummary);
    setParentPositiveMoment(aiDraft.positiveMoment);
    setParentObservedChange(aiDraft.observedChange);
    setParentNextGoal(aiDraft.nextGoal);
    setParentHomeTip(aiDraft.homeTip);
  }

  async function togglePublish(action: "approve" | "revoke") {
    setApproving(true);
    setMessage("");
    const ok = await patch({ parentPublishAction: action });
    setApproving(false);
    if (ok) {
      setIsPublic(action === "approve");
      if (action === "approve") {
        setApprovedAt(new Date().toISOString());
      }
    }
  }

  return (
    <div className="card">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <p className="text-sm font-semibold">
          {item.classDate} · {item.activityName}
          <span className="text-xs text-ink/40 font-normal ml-2">{ACTIVITY_TYPE_LABEL[item.activityType] ?? item.activityType}</span>
        </p>
        <span className={`text-xs rounded-full px-2.5 py-1 font-medium ${isPublic ? "bg-sage-100 text-sage-700" : "bg-ink/10 text-ink/40"}`}>
          {isPublic ? `학부모 공개됨${approvedAt ? ` (${approvedAt.slice(0, 10)})` : ""}` : "학부모 미공개(승인 대기)"}
        </span>
      </div>

      <RatingRow values={ratings} editing={false} onChange={() => {}} />

      {editing ? (
        <div className="mt-3 space-y-3">
          <RatingRow values={ratings} editing onChange={(key, v) => setRatings((prev) => ({ ...prev, [key]: v ?? undefined }))} />

          <label className="block">
            <span className="block text-[11px] text-ink/50 mb-1">코멘트(내부 작업용 — 아이별 오버라이드)</span>
            <textarea className="input min-h-16 text-sm" value={comment} onChange={(e) => setComment(e.target.value)} />
          </label>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <input className="input !py-1.5 text-xs" placeholder="잘한 점" value={strengthsNote} onChange={(e) => setStrengthsNote(e.target.value)} />
            <input className="input !py-1.5 text-xs" placeholder="어려워한 점" value={difficultiesNote} onChange={(e) => setDifficultiesNote(e.target.value)} />
            <input className="input !py-1.5 text-xs" placeholder="특이사항" value={specialNote} onChange={(e) => setSpecialNote(e.target.value)} />
            <input className="input !py-1.5 text-xs" placeholder="다음 시간 목표" value={nextSessionGoal} onChange={(e) => setNextSessionGoal(e.target.value)} />
          </div>
          <textarea className="input !py-1.5 text-xs min-h-12" placeholder="자유메모" value={teacherMemo} onChange={(e) => setTeacherMemo(e.target.value)} />

          <details className="rounded-lg border border-sage-100 p-2.5">
            <summary className="text-xs font-medium text-sage-700 cursor-pointer select-none">
              학부모 공개용 초안 (관리자 승인 전까지 학부모에게 보이지 않습니다)
            </summary>
            <div className="mt-2 space-y-2">
              <input className="input !py-1.5 text-xs" placeholder="오늘의 활동" value={parentActivitySummary} onChange={(e) => setParentActivitySummary(e.target.value)} />
              <input className="input !py-1.5 text-xs" placeholder="아이의 긍정적인 반응" value={parentPositiveMoment} onChange={(e) => setParentPositiveMoment(e.target.value)} />
              <input className="input !py-1.5 text-xs" placeholder="관찰된 변화" value={parentObservedChange} onChange={(e) => setParentObservedChange(e.target.value)} />
              <input className="input !py-1.5 text-xs" placeholder="다음 목표" value={parentNextGoal} onChange={(e) => setParentNextGoal(e.target.value)} />
              <input className="input !py-1.5 text-xs" placeholder="가정에서 참고할 내용" value={parentHomeTip} onChange={(e) => setParentHomeTip(e.target.value)} />

              <button
                type="button"
                className="btn-ghost !px-3 !py-1.5 text-xs"
                disabled={aiLoading}
                onClick={generateAiDraft}
              >
                {aiLoading ? "AI 초안 생성 중..." : "AI 초안 생성"}
              </button>
              {aiMessage && <p className="text-xs text-ink/50">{aiMessage}</p>}
              {aiDraft && (
                <div className="rounded-lg bg-sage-50 p-2.5 space-y-1.5">
                  <p className="text-[11px] font-medium text-sage-700">AI 제안 (검토 후 적용하세요)</p>
                  <p className="text-xs text-ink/70"><span className="text-ink/40">오늘의 활동:</span> {aiDraft.activitySummary}</p>
                  <p className="text-xs text-ink/70"><span className="text-ink/40">긍정적인 반응:</span> {aiDraft.positiveMoment}</p>
                  <p className="text-xs text-ink/70"><span className="text-ink/40">관찰된 변화:</span> {aiDraft.observedChange}</p>
                  <p className="text-xs text-ink/70"><span className="text-ink/40">다음 목표:</span> {aiDraft.nextGoal}</p>
                  <p className="text-xs text-ink/70"><span className="text-ink/40">가정에서 참고할 내용:</span> {aiDraft.homeTip}</p>
                  <button type="button" className="text-[11px] text-sage-600 underline underline-offset-2" onClick={applyAiDraft}>
                    이 초안 적용
                  </button>
                </div>
              )}
            </div>
          </details>

          {message && <p className="text-xs text-apricot-600">{message}</p>}
          <div className="flex gap-2">
            <button className="btn-primary text-sm !py-2" disabled={saving} onClick={save}>
              {saving ? "저장 중..." : "저장"}
            </button>
            <button className="btn-ghost text-sm !py-2" onClick={() => setEditing(false)}>취소</button>
          </div>
        </div>
      ) : (
        <>
          <p className="text-sm text-ink/70 mt-1.5 leading-relaxed whitespace-pre-wrap">{comment || "(코멘트 없음)"}</p>
          <div className="flex items-center gap-3 mt-2 flex-wrap">
            {item.childCommentId && (
              <button className="text-xs text-sage-600" onClick={() => setEditing(true)}>수정</button>
            )}
            {canApprove && item.childCommentId && (
              isPublic ? (
                <button className="text-xs text-apricot-600" disabled={approving} onClick={() => togglePublish("revoke")}>
                  {approving ? "처리 중..." : "공개 취소"}
                </button>
              ) : (
                <button className="text-xs text-sage-600 font-medium" disabled={approving} onClick={() => togglePublish("approve")}>
                  {approving ? "처리 중..." : "학부모 공개 승인"}
                </button>
              )
            )}
            {saved && <span className="text-xs text-sage-600">저장됨</span>}
          </div>
          {message && <p className="text-xs text-apricot-600 mt-1">{message}</p>}
        </>
      )}
    </div>
  );
}

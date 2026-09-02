"use client";

/**
 * 아이 상세 "뇌파훈련기록" 탭 — 세션별 훈련 기록 CRUD + 기간별 추이 차트.
 * (components/admin/MonthlyReportsPanel.tsx와 동일한 "목록 카드 + 등록/수정 공용 폼" 패턴)
 * [주의] 담당 아동이면 선생님도 등록/수정/삭제 가능 — brain_tests(정식 검사결과)와는 권한이 다름.
 */

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { EegTrainingSession } from "@/lib/types";
import EegTrendChart from "./EegTrendChart";

function today() {
  return new Date().toISOString().slice(0, 10);
}

function metricsToRows(metrics?: Record<string, number | string | null>): { label: string; value: string }[] {
  if (!metrics || Object.keys(metrics).length === 0) return [{ label: "", value: "" }];
  return Object.entries(metrics).map(([label, value]) => ({ label, value: value === null ? "" : String(value) }));
}

export default function EegTrainingPanel({ childId, sessions }: { childId: string; sessions: EegTrainingSession[] }) {
  const [creating, setCreating] = useState(false);

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="section-label">뇌파훈련기록</p>
        {!creating && (
          <button className="btn-primary text-sm !px-4 !py-2" onClick={() => setCreating(true)}>
            + 훈련기록 등록
          </button>
        )}
      </div>

      {sessions.length > 0 && (
        <div className="card">
          <EegTrendChart sessions={sessions} />
        </div>
      )}

      {creating && <SessionEditor childId={childId} onDone={() => setCreating(false)} />}

      <div className="space-y-3">
        {sessions.length === 0 && !creating && (
          <p className="text-sm text-ink/40 text-center py-6">아직 등록된 훈련기록이 없습니다.</p>
        )}
        {sessions.map((s) => (
          <SessionCard key={s.id} childId={childId} session={s} />
        ))}
      </div>
    </section>
  );
}

function SessionCard({ childId, session }: { childId: string; session: EegTrainingSession }) {
  const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const router = useRouter();

  async function handleDelete() {
    if (!confirm(`${session.sessionDate} 훈련기록을 삭제하시겠습니까?`)) return;
    setDeleting(true);
    const res = await fetch(`/api/admin/eeg-training/${session.id}`, { method: "DELETE" });
    setDeleting(false);
    if (res.ok) router.refresh();
    else alert("삭제에 실패했습니다. 다시 시도해 주세요.");
  }

  if (editing) {
    return <SessionEditor childId={childId} session={session} onDone={() => setEditing(false)} />;
  }

  return (
    <div className="card">
      <div className="flex items-start justify-between gap-3 mb-2">
        <div>
          <p className="font-bold text-sm">
            {session.sessionDate}
            {session.durationMinutes != null && <span className="text-ink/40 font-normal"> · {session.durationMinutes}분</span>}
            {session.trainingMode && <span className="text-ink/40 font-normal"> · {session.trainingMode}</span>}
          </p>
          {session.trainingStage && <p className="text-xs text-ink/40 mt-0.5">{session.trainingStage}</p>}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className={`text-xs ${session.isPublicToParent ? "text-sage-600" : "text-ink/40"}`}>
            {session.isPublicToParent ? "학부모 공개" : "비공개"}
          </span>
          <button className="text-xs text-sage-600 underline underline-offset-2" onClick={() => setEditing(true)}>수정</button>
          <button className="text-xs text-apricot-600 underline underline-offset-2" disabled={deleting} onClick={handleDelete}>삭제</button>
        </div>
      </div>
      {session.keyMetrics && Object.keys(session.keyMetrics).length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-2">
          {Object.entries(session.keyMetrics).map(([label, value]) => (
            <span key={label} className="text-xs bg-sage-50 text-sage-700 rounded-full px-2.5 py-1">
              {label} {value === null ? "(미측정)" : String(value)}
            </span>
          ))}
        </div>
      )}
      <dl className="text-sm space-y-1.5">
        <SessionRow label="컨디션" value={session.conditionNote} />
        <SessionRow label="참여도" value={session.engagementNote} />
        <SessionRow label="관찰" value={session.observation} />
        <SessionRow label="특이사항" value={session.specialNote} />
        <SessionRow label="학부모 코멘트" value={session.parentComment} />
      </dl>
    </div>
  );
}

function SessionRow({ label, value }: { label: string; value?: string }) {
  if (!value) return null;
  return (
    <div>
      <dt className="text-xs text-ink/40">{label}</dt>
      <dd className="text-ink/70 whitespace-pre-wrap leading-relaxed">{value}</dd>
    </div>
  );
}

function SessionEditor({
  childId,
  session,
  onDone,
}: {
  childId: string;
  session?: EegTrainingSession;
  onDone: () => void;
}) {
  const [sessionDate, setSessionDate] = useState(session?.sessionDate ?? today());
  const [durationMinutes, setDurationMinutes] = useState(session?.durationMinutes != null ? String(session.durationMinutes) : "");
  const [trainingMode, setTrainingMode] = useState(session?.trainingMode ?? "");
  const [trainingStage, setTrainingStage] = useState(session?.trainingStage ?? "");
  const [equipment, setEquipment] = useState(session?.equipment ?? "");
  const [metricRows, setMetricRows] = useState(metricsToRows(session?.keyMetrics));
  const [conditionNote, setConditionNote] = useState(session?.conditionNote ?? "");
  const [engagementNote, setEngagementNote] = useState(session?.engagementNote ?? "");
  const [observation, setObservation] = useState(session?.observation ?? "");
  const [specialNote, setSpecialNote] = useState(session?.specialNote ?? "");
  const [parentComment, setParentComment] = useState(session?.parentComment ?? "");
  const [isPublicToParent, setIsPublicToParent] = useState(session?.isPublicToParent ?? false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const router = useRouter();

  function updateRow(i: number, patch: Partial<{ label: string; value: string }>) {
    setMetricRows((prev) => prev.map((row, idx) => (idx === i ? { ...row, ...patch } : row)));
  }
  function addRow() {
    setMetricRows((prev) => [...prev, { label: "", value: "" }]);
  }
  function removeRow(i: number) {
    setMetricRows((prev) => prev.filter((_, idx) => idx !== i));
  }

  async function handleSave() {
    if (!sessionDate) return;
    setSaving(true);
    setMessage("");

    const keyMetrics: Record<string, number | string | null> = {};
    for (const row of metricRows) {
      const label = row.label.trim();
      if (!label) continue;
      const trimmedValue = row.value.trim();
      if (trimmedValue === "") {
        keyMetrics[label] = null; // 측정 안 함 — 0으로 대체하지 않음
      } else {
        const num = Number(trimmedValue);
        keyMetrics[label] = Number.isFinite(num) ? num : trimmedValue;
      }
    }

    const body = {
      sessionDate,
      durationMinutes: durationMinutes.trim() === "" ? null : Number(durationMinutes),
      trainingMode,
      trainingStage,
      equipment,
      keyMetrics,
      conditionNote,
      engagementNote,
      observation,
      specialNote,
      parentComment,
      isPublicToParent,
    };

    const res = await fetch(
      session ? `/api/admin/eeg-training/${session.id}` : "/api/admin/eeg-training",
      {
        method: session ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(session ? body : { ...body, childId }),
      }
    );
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
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <label className="block">
          <span className="block text-sm font-medium mb-1.5">세션일자</span>
          <input className="input" type="date" value={sessionDate} onChange={(e) => setSessionDate(e.target.value)} />
        </label>
        <label className="block">
          <span className="block text-sm font-medium mb-1.5">소요시간(분)</span>
          <input className="input" type="number" min="0" value={durationMinutes} onChange={(e) => setDurationMinutes(e.target.value)} placeholder="측정 안 했으면 비워두세요" />
        </label>
        <label className="block">
          <span className="block text-sm font-medium mb-1.5">훈련 모드</span>
          <input className="input" value={trainingMode} onChange={(e) => setTrainingMode(e.target.value)} />
        </label>
        <label className="block">
          <span className="block text-sm font-medium mb-1.5">훈련 단계</span>
          <input className="input" value={trainingStage} onChange={(e) => setTrainingStage(e.target.value)} />
        </label>
        <label className="block sm:col-span-2">
          <span className="block text-sm font-medium mb-1.5">장비</span>
          <input className="input" value={equipment} onChange={(e) => setEquipment(e.target.value)} />
        </label>
      </div>

      <div className="mt-4">
        <span className="block text-sm font-medium mb-1.5">훈련 지표 (자유 입력 — 값을 비우면 "측정 안 함"으로 저장됩니다)</span>
        <div className="space-y-2">
          {metricRows.map((row, i) => (
            <div key={i} className="flex gap-2">
              <input className="input !py-2 text-sm" placeholder="예: 집중지수" value={row.label} onChange={(e) => updateRow(i, { label: e.target.value })} />
              <input className="input !py-2 text-sm" placeholder="예: 72" value={row.value} onChange={(e) => updateRow(i, { value: e.target.value })} />
              <button type="button" className="btn-ghost !px-3 text-xs shrink-0" onClick={() => removeRow(i)} disabled={metricRows.length === 1}>삭제</button>
            </div>
          ))}
        </div>
        <button type="button" className="text-xs text-sage-600 underline underline-offset-2 mt-2" onClick={addRow}>+ 지표 추가</button>
      </div>

      <label className="block mt-4">
        <span className="block text-sm font-medium mb-1.5">컨디션</span>
        <textarea className="input min-h-16" value={conditionNote} onChange={(e) => setConditionNote(e.target.value)} />
      </label>
      <label className="block mt-3">
        <span className="block text-sm font-medium mb-1.5">참여도</span>
        <textarea className="input min-h-16" value={engagementNote} onChange={(e) => setEngagementNote(e.target.value)} />
      </label>
      <label className="block mt-3">
        <span className="block text-sm font-medium mb-1.5">관찰</span>
        <textarea className="input min-h-16" value={observation} onChange={(e) => setObservation(e.target.value)} />
      </label>
      <label className="block mt-3">
        <span className="block text-sm font-medium mb-1.5">특이사항</span>
        <textarea className="input min-h-16" value={specialNote} onChange={(e) => setSpecialNote(e.target.value)} />
      </label>
      <label className="block mt-3">
        <span className="block text-sm font-medium mb-1.5">학부모 코멘트</span>
        <textarea className="input min-h-16" value={parentComment} onChange={(e) => setParentComment(e.target.value)} />
      </label>
      <label className="flex items-center gap-2 text-sm mt-3">
        <input type="checkbox" checked={isPublicToParent} onChange={(e) => setIsPublicToParent(e.target.checked)} />
        학부모에게 공개 (지금은 저장만 되고, 학부모 화면에는 아직 연결되지 않았습니다)
      </label>

      {message && <p className="text-sm text-apricot-600 mt-3">{message}</p>}

      <div className="flex items-center gap-2 mt-4">
        <button className="btn-primary" disabled={saving || !sessionDate} onClick={handleSave}>
          {saving ? "저장 중..." : "저장"}
        </button>
        <button className="btn-ghost" onClick={onDone}>취소</button>
      </div>
    </div>
  );
}

"use client";

/**
 * 아이 상세 "월간리포트" 탭 — 월간 성장 리포트 작성/수정/삭제.
 * 한 아이에 한 달 최대 1건(month unique) — 이미 있으면 서버가 400으로 안내하므로
 * 그 경우 새로 만들지 말고 기존 카드의 "수정"을 쓰라고 사용자에게 보여줌.
 * (components/admin/NoticeManager.tsx와 동일한 "생성/수정 토글 + router.refresh()" 패턴)
 */

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { MonthlyReport } from "@/lib/types";

function currentMonth() {
  return new Date().toISOString().slice(0, 7);
}

export default function MonthlyReportsPanel({ childId, reports }: { childId: string; reports: MonthlyReport[] }) {
  const [creating, setCreating] = useState(false);

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="section-label">월간 성장 리포트</p>
        {!creating && (
          <button className="btn-primary text-sm !px-4 !py-2" onClick={() => setCreating(true)}>
            + 이번달 리포트 작성
          </button>
        )}
      </div>

      {creating && <ReportEditor childId={childId} onDone={() => setCreating(false)} />}

      <div className="space-y-3">
        {reports.length === 0 && !creating && (
          <p className="text-sm text-ink/40 text-center py-6">아직 작성된 월간 리포트가 없습니다.</p>
        )}
        {reports.map((r) => (
          <ReportCard key={r.id} childId={childId} report={r} />
        ))}
      </div>
    </section>
  );
}

function ReportCard({ childId, report }: { childId: string; report: MonthlyReport }) {
  const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const router = useRouter();

  async function handleDelete() {
    if (!confirm(`${report.month} 리포트를 삭제하시겠습니까?`)) return;
    setDeleting(true);
    const res = await fetch(`/api/admin/monthly-reports/${report.id}`, { method: "DELETE" });
    setDeleting(false);
    if (res.ok) router.refresh();
    else alert("삭제에 실패했습니다. 다시 시도해 주세요.");
  }

  if (editing) {
    return <ReportEditor childId={childId} report={report} onDone={() => setEditing(false)} />;
  }

  return (
    <div className="card">
      <div className="flex items-start justify-between gap-3 mb-2">
        <p className="font-bold">{report.month}</p>
        <div className="flex items-center gap-2 shrink-0">
          <span className={`text-xs ${report.isPublicToParent ? "text-sage-600" : "text-ink/40"}`}>
            {report.isPublicToParent ? "학부모 공개" : "비공개"}
          </span>
          <button className="text-xs text-sage-600 underline underline-offset-2" onClick={() => setEditing(true)}>수정</button>
          <button className="text-xs text-apricot-600 underline underline-offset-2" disabled={deleting} onClick={handleDelete}>삭제</button>
        </div>
      </div>
      <dl className="text-sm space-y-1.5">
        <ReportRow label="참여 모습" value={report.participation} />
        <ReportRow label="강점" value={report.strengths} />
        <ReportRow label="보완점" value={report.improvements} />
        <ReportRow label="가정 지도" value={report.homeGuidance} />
        <ReportRow label="다음달 목표" value={report.nextMonthGoals} />
      </dl>
    </div>
  );
}

function ReportRow({ label, value }: { label: string; value?: string }) {
  if (!value) return null;
  return (
    <div>
      <dt className="text-xs text-ink/40">{label}</dt>
      <dd className="text-ink/70 whitespace-pre-wrap leading-relaxed">{value}</dd>
    </div>
  );
}

function ReportEditor({
  childId,
  report,
  onDone,
}: {
  childId: string;
  report?: MonthlyReport;
  onDone: () => void;
}) {
  const [month, setMonth] = useState(report?.month ?? currentMonth());
  const [participation, setParticipation] = useState(report?.participation ?? "");
  const [strengths, setStrengths] = useState(report?.strengths ?? "");
  const [improvements, setImprovements] = useState(report?.improvements ?? "");
  const [homeGuidance, setHomeGuidance] = useState(report?.homeGuidance ?? "");
  const [nextMonthGoals, setNextMonthGoals] = useState(report?.nextMonthGoals ?? "");
  const [isPublicToParent, setIsPublicToParent] = useState(report?.isPublicToParent ?? false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const router = useRouter();

  async function handleSave() {
    setSaving(true);
    setMessage("");
    const body = { participation, strengths, improvements, homeGuidance, nextMonthGoals, isPublicToParent };
    const res = await fetch(
      report ? `/api/admin/monthly-reports/${report.id}` : "/api/admin/monthly-reports",
      {
        method: report ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(report ? body : { ...body, childId, month }),
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
      <label className="block mb-3">
        <span className="block text-sm font-medium mb-1.5">대상 월</span>
        <input
          className="input"
          type="month"
          value={month}
          disabled={!!report}
          onChange={(e) => setMonth(e.target.value)}
        />
      </label>
      <label className="block mb-3">
        <span className="block text-sm font-medium mb-1.5">참여 모습</span>
        <textarea className="input min-h-16" value={participation} onChange={(e) => setParticipation(e.target.value)} />
      </label>
      <label className="block mb-3">
        <span className="block text-sm font-medium mb-1.5">강점</span>
        <textarea className="input min-h-16" value={strengths} onChange={(e) => setStrengths(e.target.value)} />
      </label>
      <label className="block mb-3">
        <span className="block text-sm font-medium mb-1.5">보완점</span>
        <textarea className="input min-h-16" value={improvements} onChange={(e) => setImprovements(e.target.value)} />
      </label>
      <label className="block mb-3">
        <span className="block text-sm font-medium mb-1.5">가정 지도</span>
        <textarea className="input min-h-16" value={homeGuidance} onChange={(e) => setHomeGuidance(e.target.value)} />
      </label>
      <label className="block mb-3">
        <span className="block text-sm font-medium mb-1.5">다음달 목표</span>
        <textarea className="input min-h-16" value={nextMonthGoals} onChange={(e) => setNextMonthGoals(e.target.value)} />
      </label>
      <label className="flex items-center gap-2 text-sm mb-3">
        <input type="checkbox" checked={isPublicToParent} onChange={(e) => setIsPublicToParent(e.target.checked)} />
        학부모에게 공개 (성장기록 타임라인에 노출)
      </label>
      {message && <p className="text-sm text-apricot-600 mb-2">{message}</p>}
      <div className="flex items-center gap-2">
        <button className="btn-primary" disabled={saving} onClick={handleSave}>
          {saving ? "저장 중..." : "저장"}
        </button>
        <button className="btn-ghost" onClick={onDone}>취소</button>
      </div>
    </div>
  );
}

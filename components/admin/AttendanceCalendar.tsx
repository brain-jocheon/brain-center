"use client";

/**
 * 관리자 출결 관리 — 달력에서 날짜를 클릭해 출석/결석/보강을 기록합니다.
 * 같은 날짜를 다시 클릭해서 저장하면 그 날짜의 기록이 덮어써집니다(upsert).
 *
 * "수업 요일" 자동 표시: 아직 출결 기록이 없는 날짜라도, 아이(또는 형제자매)의
 * 등록된 수업 요일에 해당하면 아래쪽에 작은 색 점으로 표시합니다 — 실제 출결
 * 기록이 생기면 그 표시(출석/결석 배경색)가 우선합니다.
 */

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import MonthCalendar from "../MonthCalendar";
import type { AttendanceRecord } from "@/lib/types";
import { parseClassDays, CHILD_DOT_COLORS } from "@/lib/classSchedule";

interface ScheduleChild {
  id: string;
  name: string;
  classDay?: string;
}

export default function AttendanceCalendar({
  childId,
  records,
  child,
  siblings = [],
}: {
  childId: string;
  records: AttendanceRecord[];
  child: ScheduleChild;
  siblings?: ScheduleChild[];
}) {
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth() + 1);
  const [editingDate, setEditingDate] = useState<string | null>(null);
  const router = useRouter();

  const byDate = useMemo(() => {
    const map = new Map<string, AttendanceRecord>();
    for (const r of records) map.set(r.classDate, r);
    return map;
  }, [records]);

  const scheduleChildren = useMemo(() => [child, ...siblings], [child, siblings]);

  // 요일(0~6) → 그 요일에 수업이 있는 아이 목록(색 포함)
  const scheduleByWeekday = useMemo(() => {
    const map = new Map<number, { name: string; color: string }[]>();
    scheduleChildren.forEach((c, i) => {
      const color = CHILD_DOT_COLORS[i % CHILD_DOT_COLORS.length];
      for (const weekday of parseClassDays(c.classDay)) {
        const list = map.get(weekday) ?? [];
        list.push({ name: c.name, color });
        map.set(weekday, list);
      }
    });
    return map;
  }, [scheduleChildren]);

  const hasAnySchedule = scheduleByWeekday.size > 0;

  function shiftMonth(delta: number) {
    let m = month + delta;
    let y = year;
    if (m > 12) { m = 1; y += 1; }
    if (m < 1) { m = 12; y -= 1; }
    setMonth(m);
    setYear(y);
  }

  return (
    <div className="card">
      <MonthCalendar
        year={year}
        month={month}
        onPrevMonth={() => shiftMonth(-1)}
        onNextMonth={() => shiftMonth(1)}
        renderDay={(dateStr, day) => {
          const rec = byDate.get(dateStr);
          const weekday = new Date(`${dateStr}T00:00:00`).getDay();
          const scheduled = !rec ? scheduleByWeekday.get(weekday) : undefined;
          return (
            <button
              type="button"
              onClick={() => setEditingDate(dateStr)}
              className={`w-full aspect-square rounded-lg text-xs flex flex-col items-center justify-center gap-0.5 relative ${
                rec?.status === "present"
                  ? rec.isMakeup ? "bg-sky-100 text-sky-700" : "bg-sage-100 text-sage-700"
                  : rec?.status === "absent"
                  ? "bg-apricot-50 text-apricot-600"
                  : "hover:bg-sage-50 text-ink/60"
              }`}
            >
              <span>{day}</span>
              {rec?.status === "present" && <span className="text-[9px]">{rec.isMakeup ? "보강" : "출석"}</span>}
              {rec?.status === "absent" && <span className="text-[9px]">결석</span>}
              {scheduled && scheduled.length > 0 && (
                <span className="flex gap-0.5 absolute bottom-1">
                  {scheduled.map((s, i) => (
                    <span key={i} className={`w-1.5 h-1.5 rounded-full ${s.color}`} />
                  ))}
                </span>
              )}
            </button>
          );
        }}
      />

      {hasAnySchedule && (
        <div className="flex flex-wrap items-center gap-3 mt-3 text-[11px] text-ink/50">
          {scheduleChildren
            .filter((c) => parseClassDays(c.classDay).length > 0)
            .map((c, i) => (
              <span key={c.id} className="flex items-center gap-1">
                <span className={`w-2.5 h-2.5 rounded-full inline-block ${CHILD_DOT_COLORS[i % CHILD_DOT_COLORS.length]}`} />
                {c.name}{c.id === child.id ? " (이 아이)" : ""}
              </span>
            ))}
        </div>
      )}

      {editingDate && (
        <DayEditor
          childId={childId}
          dateStr={editingDate}
          existing={byDate.get(editingDate) ?? null}
          onClose={() => setEditingDate(null)}
          onSaved={() => { setEditingDate(null); router.refresh(); }}
        />
      )}
    </div>
  );
}

function DayEditor({
  childId,
  dateStr,
  existing,
  onClose,
  onSaved,
}: {
  childId: string;
  dateStr: string;
  existing: AttendanceRecord | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [status, setStatus] = useState<"present" | "absent">(existing?.status ?? "present");
  const [isMakeup, setIsMakeup] = useState(existing?.isMakeup ?? false);
  const [makeupDate, setMakeupDate] = useState(existing?.makeupDate ?? "");
  const [memo, setMemo] = useState(existing?.memo ?? "");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  async function handleSave() {
    setSaving(true);
    setMessage("");
    const res = await fetch("/api/admin/attendance", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        childId,
        classDate: dateStr,
        status,
        isMakeup,
        makeupDate: status === "absent" ? makeupDate || undefined : undefined,
        memo: memo || undefined,
      }),
    });
    setSaving(false);
    if (res.ok) onSaved();
    else setMessage("저장에 실패했습니다.");
  }

  async function handleDelete() {
    if (!existing) return;
    if (!confirm(`${dateStr} 출결 기록을 삭제하시겠습니까?`)) return;
    setSaving(true);
    const res = await fetch(`/api/admin/attendance/${existing.id}`, { method: "DELETE" });
    setSaving(false);
    if (res.ok) onSaved();
    else setMessage("삭제에 실패했습니다.");
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="card max-w-sm w-full" onClick={(e) => e.stopPropagation()}>
        <p className="section-label mb-3">{dateStr} 출결</p>

        <div className="flex gap-2 mb-3">
          <button
            type="button"
            className={`flex-1 rounded-xl py-2 text-sm font-medium border ${status === "present" ? "bg-sage-600 text-white border-sage-600" : "border-sage-200 text-ink/60"}`}
            onClick={() => setStatus("present")}
          >
            출석
          </button>
          <button
            type="button"
            className={`flex-1 rounded-xl py-2 text-sm font-medium border ${status === "absent" ? "bg-apricot-500 text-white border-apricot-500" : "border-sage-200 text-ink/60"}`}
            onClick={() => setStatus("absent")}
          >
            결석
          </button>
        </div>

        {status === "present" && (
          <label className="flex items-center gap-2 text-sm mb-3">
            <input type="checkbox" checked={isMakeup} onChange={(e) => setIsMakeup(e.target.checked)} />
            이 날짜는 보강 수업이에요
          </label>
        )}

        {status === "absent" && (
          <label className="block mb-3">
            <span className="block text-sm font-medium mb-1.5">보강 예정일 (선택)</span>
            <input className="input" type="date" value={makeupDate} onChange={(e) => setMakeupDate(e.target.value)} />
          </label>
        )}

        <label className="block mb-3">
          <span className="block text-sm font-medium mb-1.5">메모 (관리자 전용, 학부모에게 안 보임)</span>
          <textarea className="input min-h-16 text-sm" value={memo} onChange={(e) => setMemo(e.target.value)} />
        </label>

        {message && <p className="text-sm text-apricot-600 mb-2">{message}</p>}

        <div className="flex items-center gap-2">
          <button className="btn-primary" disabled={saving} onClick={handleSave}>
            {saving ? "저장 중..." : "저장"}
          </button>
          {existing && (
            <button className="text-xs text-apricot-600 underline underline-offset-2" disabled={saving} onClick={handleDelete}>
              기록 삭제
            </button>
          )}
          <button className="btn-ghost ml-auto" onClick={onClose}>닫기</button>
        </div>
      </div>
    </div>
  );
}

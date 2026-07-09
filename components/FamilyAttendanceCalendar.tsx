"use client";

/**
 * 학부모용 출결 달력 — 출석/결석/보강 상태를 보여주고, 사진이 있는 출석일을
 * 클릭하면 그날 찍은 활동 사진을 바로 볼 수 있습니다. 결석일을 클릭하면
 * 보강 희망일을 제안할 수 있고, 관리자가 승인하면 실제 보강 예정일에 반영됩니다.
 */

import { useMemo, useState } from "react";
import MonthCalendar from "./MonthCalendar";
import type { ParentAttendanceRecord, ParentPhoto } from "@/lib/types";

export default function FamilyAttendanceCalendar({
  attendance,
  photos,
  token,
}: {
  attendance: ParentAttendanceRecord[];
  photos: ParentPhoto[];
  token: string;
}) {
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth() + 1);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [requestedDates, setRequestedDates] = useState<Set<string>>(new Set());

  const byDate = useMemo(() => {
    const map = new Map<string, ParentAttendanceRecord>();
    for (const r of attendance) map.set(r.classDate, r);
    return map;
  }, [attendance]);

  const photosByDate = useMemo(() => {
    const map = new Map<string, ParentPhoto[]>();
    for (const p of photos) {
      const list = map.get(p.activityDate) ?? [];
      list.push(p);
      map.set(p.activityDate, list);
    }
    return map;
  }, [photos]);

  function shiftMonth(delta: number) {
    let m = month + delta;
    let y = year;
    if (m > 12) { m = 1; y += 1; }
    if (m < 1) { m = 12; y -= 1; }
    setMonth(m);
    setYear(y);
  }

  const selectedPhotos = selectedDate ? photosByDate.get(selectedDate) ?? [] : [];
  const selectedRecord = selectedDate ? byDate.get(selectedDate) : undefined;
  const isAbsentSelected = selectedRecord?.status === "absent";

  if (attendance.length === 0) return null;

  return (
    <section className="card">
      <p className="section-label mb-1">출결 · 보강 일정</p>
      <p className="text-xs text-ink/50 mb-4">
        사진이 있는 출석일은 눌러서 바로 보실 수 있고, 결석일을 누르면 보강 희망일을 요청할 수 있어요.
      </p>

      <MonthCalendar
        year={year}
        month={month}
        onPrevMonth={() => shiftMonth(-1)}
        onNextMonth={() => shiftMonth(1)}
        renderDay={(dateStr, day) => {
          const rec = byDate.get(dateStr);
          const hasPhotos = (photosByDate.get(dateStr)?.length ?? 0) > 0;
          const clickable = hasPhotos || rec?.status === "absent";
          return (
            <button
              type="button"
              disabled={!clickable}
              onClick={() => clickable && setSelectedDate(dateStr)}
              className={`w-full aspect-square rounded-lg text-xs flex flex-col items-center justify-center gap-0.5 ${
                rec?.status === "present"
                  ? rec.isMakeup ? "bg-sky-100 text-sky-700" : "bg-sage-100 text-sage-700"
                  : rec?.status === "absent"
                  ? "bg-apricot-50 text-apricot-600"
                  : "text-ink/30"
              } ${clickable ? "ring-1 ring-sage-300" : ""}`}
            >
              <span>{day}</span>
              {rec?.status === "present" && <span className="text-[9px]">{rec.isMakeup ? "보강" : "출석"}</span>}
              {rec?.status === "absent" && (
                <span className="text-[9px]">
                  {rec.makeupDate ? "결석·보강예정" : requestedDates.has(dateStr) ? "결석·요청함" : "결석"}
                </span>
              )}
            </button>
          );
        }}
      />

      <div className="flex items-center gap-3 mt-3 text-[11px] text-ink/50 flex-wrap">
        <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-sage-400 inline-block" />출석</span>
        <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-sky-400 inline-block" />보강</span>
        <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-apricot-400 inline-block" />결석</span>
        <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full ring-1 ring-sage-400 inline-block" />누를 수 있음</span>
      </div>

      {selectedDate && selectedPhotos.length > 0 && (
        <div
          className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4"
          onClick={() => setSelectedDate(null)}
        >
          <div className="max-w-lg w-full max-h-[85vh] overflow-y-auto bg-white rounded-lg p-4" onClick={(e) => e.stopPropagation()}>
            <p className="font-semibold text-sm mb-3">{selectedDate}</p>
            <div className="grid grid-cols-2 gap-2">
              {selectedPhotos.map((p) => (
                <div key={p.id} className="rounded-lg overflow-hidden">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={p.url} alt={p.activityName} className="w-full aspect-square object-cover" />
                  <p className="text-[11px] text-ink/50 mt-1">{p.activityName}</p>
                </div>
              ))}
            </div>
            <button className="btn-ghost text-xs mt-3" onClick={() => setSelectedDate(null)}>닫기</button>
          </div>
        </div>
      )}

      {selectedDate && selectedPhotos.length === 0 && isAbsentSelected && (
        <MakeupRequestModal
          token={token}
          dateStr={selectedDate}
          alreadyHasMakeupDate={!!selectedRecord?.makeupDate}
          alreadyRequested={requestedDates.has(selectedDate)}
          onSubmitted={() => setRequestedDates((prev) => new Set(prev).add(selectedDate))}
          onClose={() => setSelectedDate(null)}
        />
      )}
    </section>
  );
}

function MakeupRequestModal({
  token,
  dateStr,
  alreadyHasMakeupDate,
  alreadyRequested,
  onSubmitted,
  onClose,
}: {
  token: string;
  dateStr: string;
  alreadyHasMakeupDate: boolean;
  alreadyRequested: boolean;
  onSubmitted: () => void;
  onClose: () => void;
}) {
  const [requestedDate, setRequestedDate] = useState("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(alreadyRequested);

  async function handleSubmit() {
    if (!requestedDate) return;
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/report/makeup-request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, originalClassDate: dateStr, requestedDate, parentMemo: note.trim() || undefined }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.message || "요청에 실패했습니다. 잠시 후 다시 시도해 주세요.");
        return;
      }
      setDone(true);
      onSubmitted();
    } catch {
      setError("연결에 문제가 있습니다. 잠시 후 다시 시도해 주세요.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="card max-w-sm w-full" onClick={(e) => e.stopPropagation()}>
        <p className="section-label mb-1">{dateStr} 결석</p>

        {done ? (
          <>
            <p className="text-sm text-ink/70 leading-relaxed mt-3">
              보강 희망일 요청을 보내드렸어요. 센터에서 확인 후 반영해 드릴게요.
            </p>
            <button className="btn-ghost mt-4" onClick={onClose}>닫기</button>
          </>
        ) : (
          <>
            <p className="text-sm text-ink/60 mb-4 leading-relaxed">
              {alreadyHasMakeupDate
                ? "이미 보강 예정일이 있어요. 날짜를 바꾸고 싶으시면 새로 요청해 주세요."
                : "보강을 희망하시는 날짜를 알려주시면 센터에서 확인 후 반영해 드릴게요."}
            </p>
            <label className="block mb-3">
              <span className="block text-sm font-medium mb-1.5">보강 희망일</span>
              <input className="input" type="date" value={requestedDate} onChange={(e) => setRequestedDate(e.target.value)} />
            </label>
            <label className="block mb-3">
              <span className="block text-sm font-medium mb-1.5">전달할 말 (선택)</span>
              <textarea className="input min-h-16 text-sm" value={note} onChange={(e) => setNote(e.target.value)} />
            </label>
            {error && <p className="text-sm text-apricot-600 mb-2">{error}</p>}
            <div className="flex items-center gap-2">
              <button className="btn-primary" disabled={saving || !requestedDate} onClick={handleSubmit}>
                {saving ? "보내는 중..." : "요청 보내기"}
              </button>
              <button className="btn-ghost" onClick={onClose}>취소</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

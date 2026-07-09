"use client";

/**
 * 학부모용 출결 달력 — 출석/결석/보강 상태를 보여주고, 사진이 있는 출석일을
 * 클릭하면 그날 찍은 활동 사진을 바로 볼 수 있습니다.
 */

import { useMemo, useState } from "react";
import MonthCalendar from "./MonthCalendar";
import type { ParentAttendanceRecord, ParentPhoto } from "@/lib/types";

export default function FamilyAttendanceCalendar({
  attendance,
  photos,
}: {
  attendance: ParentAttendanceRecord[];
  photos: ParentPhoto[];
}) {
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth() + 1);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

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

  if (attendance.length === 0) return null;

  return (
    <section className="card">
      <p className="section-label mb-1">출결 · 보강 일정</p>
      <p className="text-xs text-ink/50 mb-4">사진이 있는 출석일은 눌러서 바로 보실 수 있어요.</p>

      <MonthCalendar
        year={year}
        month={month}
        onPrevMonth={() => shiftMonth(-1)}
        onNextMonth={() => shiftMonth(1)}
        renderDay={(dateStr, day) => {
          const rec = byDate.get(dateStr);
          const hasPhotos = (photosByDate.get(dateStr)?.length ?? 0) > 0;
          const clickable = hasPhotos;
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
                <span className="text-[9px]">{rec.makeupDate ? "결석·보강예정" : "결석"}</span>
              )}
            </button>
          );
        }}
      />

      <div className="flex items-center gap-3 mt-3 text-[11px] text-ink/50">
        <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-sage-400 inline-block" />출석</span>
        <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-sky-400 inline-block" />보강</span>
        <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-apricot-400 inline-block" />결석</span>
        <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full ring-1 ring-sage-400 inline-block" />사진 있음</span>
      </div>

      {selectedDate && (
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
    </section>
  );
}

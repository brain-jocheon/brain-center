"use client";

/**
 * 월 단위 달력 그리드 — 관리자 출결 입력 화면과 학부모 출결 확인 화면에서 공용으로 씁니다.
 * 이 컴포넌트는 레이아웃만 담당하고, 각 날짜 칸의 내용은 renderDay가 결정합니다.
 */

const WEEKDAY_LABELS = ["일", "월", "화", "수", "목", "금", "토"];

function toDateStr(year: number, month: number, day: number): string {
  const mm = String(month).padStart(2, "0");
  const dd = String(day).padStart(2, "0");
  return `${year}-${mm}-${dd}`;
}

export default function MonthCalendar({
  year,
  month,
  onPrevMonth,
  onNextMonth,
  renderDay,
}: {
  /** 1~12 */
  year: number;
  month: number;
  onPrevMonth: () => void;
  onNextMonth: () => void;
  renderDay: (dateStr: string, day: number) => React.ReactNode;
}) {
  const firstWeekday = new Date(year, month - 1, 1).getDay(); // 0=일
  const daysInMonth = new Date(year, month, 0).getDate();
  const cells: (number | null)[] = [
    ...Array.from({ length: firstWeekday }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <button type="button" className="btn-ghost text-xs !px-3 !py-1.5" onClick={onPrevMonth}>‹ 이전달</button>
        <p className="font-semibold text-sm">{year}년 {month}월</p>
        <button type="button" className="btn-ghost text-xs !px-3 !py-1.5" onClick={onNextMonth}>다음달 ›</button>
      </div>
      <div className="grid grid-cols-7 gap-1 text-center text-xs text-ink/40 mb-1">
        {WEEKDAY_LABELS.map((w) => <div key={w}>{w}</div>)}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {cells.map((day, i) =>
          day === null ? (
            <div key={`pad-${i}`} />
          ) : (
            <div key={day}>{renderDay(toDateStr(year, month, day), day)}</div>
          )
        )}
      </div>
    </div>
  );
}

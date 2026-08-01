"use client";

/**
 * 학부모 화면 — 성장기록 타임라인
 * 출결·활동사진·수업 코멘트·뇌기능검사·월간 성장 리포트를 날짜순으로 합쳐서 보여줍니다.
 * 전부 서버가 이미 공개 설정된 것만 필터링해서 내려준 배열이라, 여기서는 병합·정렬만 합니다.
 * [주의] 기질검사/MT-PRIS 결과지는 포함하지 않습니다 — 학부모 링크 하나가 검사 결과지
 * "한 건"에만 연결되는 구조라 아이의 전체 검사 이력을 여기서 모을 방법이 아직 없습니다
 * (3단계 보호자 계정에서 자연스럽게 풀릴 예정).
 */

import type { ParentAttendanceRecord, ParentPhoto, ParentChildComment, ParentBrainTest, ParentMonthlyReport } from "@/lib/types";

type Entry =
  | { date: string; kind: "attendance"; data: ParentAttendanceRecord }
  | { date: string; kind: "photo"; data: ParentPhoto }
  | { date: string; kind: "comment"; data: ParentChildComment }
  | { date: string; kind: "brain"; data: ParentBrainTest }
  | { date: string; kind: "monthly"; data: ParentMonthlyReport };

export default function GrowthTimelineSection({
  attendance,
  photos,
  comments,
  brainTests,
  monthlyReports,
}: {
  attendance: ParentAttendanceRecord[];
  photos: ParentPhoto[];
  comments: ParentChildComment[];
  brainTests: ParentBrainTest[];
  monthlyReports: ParentMonthlyReport[];
}) {
  const entries: Entry[] = [
    ...attendance.map((a) => ({ date: a.classDate, kind: "attendance" as const, data: a })),
    ...photos.map((p) => ({ date: p.activityDate, kind: "photo" as const, data: p })),
    ...comments.map((c) => ({ date: c.classDate, kind: "comment" as const, data: c })),
    ...brainTests.map((t) => ({ date: t.testDate, kind: "brain" as const, data: t })),
    ...monthlyReports.map((m) => ({ date: `${m.month}-01`, kind: "monthly" as const, data: m })),
  ].sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));

  if (entries.length === 0) {
    return (
      <section className="card text-center text-sm text-ink/50 py-10">
        아직 기록된 성장 기록이 없습니다.
      </section>
    );
  }

  return (
    <section>
      <p className="text-xs text-ink/50 mb-4 leading-relaxed px-1">
        출결·활동사진·수업 코멘트·검사자료·월간 리포트를 한 곳에서 시간순으로 확인할 수 있어요.
      </p>
      <div className="space-y-3">
        {entries.map((e, i) => (
          <TimelineCard key={`${e.kind}-${i}`} entry={e} />
        ))}
      </div>
    </section>
  );
}

function Card({
  icon,
  dateLabel,
  title,
  children,
}: {
  icon: string;
  dateLabel: string;
  title: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="card !p-4">
      <div className="flex items-start gap-3">
        <span className="text-xl leading-none shrink-0">{icon}</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <p className="font-semibold text-sm">{title}</p>
            <span className="text-[11px] text-sage-600 shrink-0">{dateLabel}</span>
          </div>
          {children}
        </div>
      </div>
    </div>
  );
}

function TimelineCard({ entry }: { entry: Entry }) {
  if (entry.kind === "attendance") {
    const a = entry.data;
    return (
      <Card icon="📅" dateLabel={a.classDate} title={a.status === "present" ? "출석" : "결석"}>
        {a.isMakeup && <p className="text-xs text-ink/50 mt-1">보강 수업</p>}
        {a.status === "absent" && !a.makeupDate && <p className="text-xs text-apricot-600 mt-1">보강 일정 미정</p>}
        {a.makeupDate && <p className="text-xs text-ink/50 mt-1">보강 예정일: {a.makeupDate}</p>}
      </Card>
    );
  }
  if (entry.kind === "photo") {
    const p = entry.data;
    return (
      <Card icon="📷" dateLabel={p.activityDate} title={p.activityName}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={p.url} alt={p.activityName} className="w-20 h-20 rounded-lg object-cover mt-2" />
        {p.description && <p className="text-xs text-ink/60 mt-1.5 leading-relaxed">{p.description}</p>}
      </Card>
    );
  }
  if (entry.kind === "comment") {
    const c = entry.data;
    return (
      <Card icon="💬" dateLabel={c.classDate} title={c.activityName}>
        <p className="text-xs text-ink/70 mt-1 leading-relaxed whitespace-pre-wrap">{c.comment}</p>
      </Card>
    );
  }
  if (entry.kind === "brain") {
    const t = entry.data;
    return (
      <Card icon="🧾" dateLabel={t.testDate} title="뇌기능검사">
        {t.opinion && <p className="text-xs text-ink/60 mt-1 leading-relaxed">{t.opinion}</p>}
      </Card>
    );
  }
  const m = entry.data;
  return (
    <Card icon="🌱" dateLabel={m.month} title="월간 성장 리포트">
      <div className="text-xs text-ink/70 space-y-1 mt-1.5 leading-relaxed">
        {m.participation && <p><span className="font-medium">참여 모습</span> {m.participation}</p>}
        {m.strengths && <p><span className="font-medium">강점</span> {m.strengths}</p>}
        {m.improvements && <p><span className="font-medium">보완점</span> {m.improvements}</p>}
        {m.homeGuidance && <p><span className="font-medium">가정 지도</span> {m.homeGuidance}</p>}
        {m.nextMonthGoals && <p><span className="font-medium">다음달 목표</span> {m.nextMonthGoals}</p>}
      </div>
    </Card>
  );
}

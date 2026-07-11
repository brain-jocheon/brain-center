"use client";

/**
 * =====================================================================
 * 학부모 마이페이지 대시보드
 * ---------------------------------------------------------------------
 * 로그인(비밀번호 검증) 직후 기질검사/MT-PRIS 결과지가 곧바로 길게
 * 펼쳐지는 대신, 먼저 카드형 홈 화면을 보여주고 출결·활동사진·검사자료·
 * 결과지·문의사항을 각각 눌러서 확인하도록 구성합니다.
 *
 * 화면 자체는 새로 만들지 않고, 기존 섹션 컴포넌트(FamilyAttendanceCalendar,
 * ActivityAlbumSection, BrainTestSummarySection, TemperamentReportView,
 * MtprisReportView)를 탭 콘텐츠로 그대로 재사용합니다.
 * =====================================================================
 */

import { useState } from "react";
import type { VerifyPayload } from "@/lib/reportPayload";
import type { ParentFeedback } from "@/lib/types";
import { parseClassDays } from "@/lib/classSchedule";
import FamilyAttendanceCalendar from "../FamilyAttendanceCalendar";
import ActivityAlbumSection from "../ActivityAlbumSection";
import CenterNewsSection from "../CenterNewsSection";
import BrainTestSummarySection from "../BrainTestSummarySection";
import TemperamentReportView from "../TemperamentReportView";
import MtprisReportView from "../mtpris/MtprisReportView";
import FeedbackSection from "./FeedbackSection";

type TabKey = "home" | "attendance" | "photos" | "brain" | "report" | "feedback";

const WEEKDAY_LABEL = ["일", "월", "화", "수", "목", "금", "토"];

/** classDay 자유 텍스트(예: "월,수")에서 오늘 이후 가장 가까운 수업 요일을 찾음 */
function nextClassDateLabel(classDay?: string): string | null {
  const days = parseClassDays(classDay);
  if (days.length === 0) return null;
  const today = new Date();
  for (let i = 0; i <= 7; i++) {
    const d = new Date(today.getFullYear(), today.getMonth(), today.getDate() + i);
    if (days.includes(d.getDay())) {
      const mm = String(d.getMonth() + 1).padStart(2, "0");
      const dd = String(d.getDate()).padStart(2, "0");
      return `${d.getFullYear()}-${mm}-${dd} (${WEEKDAY_LABEL[d.getDay()]})`;
    }
  }
  return null;
}

export default function ParentDashboard({ payload, token }: { payload: VerifyPayload; token: string }) {
  const [tab, setTab] = useState<TabKey>("home");
  const [feedback, setFeedback] = useState<ParentFeedback[]>(payload.feedback);

  const isMtpris = payload.kind === "mtpris";
  const maskedName = isMtpris ? payload.childMaskedName : payload.report.childMaskedName;
  const grade = isMtpris ? payload.childGrade : payload.report.childGrade;
  const counselor = isMtpris ? payload.counselor : payload.report.counselor;
  const reportLabel = isMtpris ? "다원재능 기질검사" : payload.report.testTypeName;

  const recentClassDate = [...payload.attendance]
    .filter((a) => a.status === "present")
    .map((a) => a.classDate)
    .sort()
    .at(-1);
  const nextClass = nextClassDateLabel(payload.classDay);

  const hasAttendance = payload.attendance.length > 0;
  const hasPhotos = payload.photos.length > 0 || payload.blogPhotos.length > 0;
  const hasBrainTests = payload.brainTests.length > 0;

  const CARDS: { key: Exclude<TabKey, "home">; emoji: string; title: string; desc: string; show: boolean }[] = [
    { key: "attendance", emoji: "📅", title: "출결 확인", desc: "아이의 수업 출석 및 보강 현황을 확인할 수 있어요.", show: hasAttendance },
    { key: "photos", emoji: "📷", title: "활동사진", desc: "센터에서 참여한 활동사진과 수업 모습을 확인할 수 있어요.", show: hasPhotos },
    { key: "brain", emoji: "🧾", title: "검사 자료", desc: "진행한 검사자료와 상담 의견을 확인할 수 있어요.", show: hasBrainTests },
    { key: "report", emoji: "📋", title: "결과지 확인", desc: `${reportLabel} 결과지를 확인할 수 있어요.`, show: true },
    { key: "feedback", emoji: "✍️", title: "문의·건의사항", desc: "선생님께 전달하고 싶은 내용을 남길 수 있어요.", show: true },
  ];

  const TAB_TITLE: Record<Exclude<TabKey, "home">, string> = {
    attendance: "출결 확인",
    photos: "활동사진",
    brain: "검사 자료",
    report: "결과지 확인",
    feedback: "문의·건의사항",
  };

  if (tab === "home") {
    return (
      <div className="pb-14">
        <header className="bg-sage-700 text-white px-6 pt-10 pb-12 rounded-b-[2rem]">
          <div className="max-w-md mx-auto">
            <p className="text-xs tracking-widest opacity-80 mb-2">학습심리브레인센터</p>
            <h1 className="text-2xl font-bold leading-snug">{maskedName} 학부모님, 안녕하세요.</h1>
            <p className="mt-3 text-sm opacity-85 leading-relaxed">
              출결, 활동사진, 검사자료, 결과지를 한 곳에서 확인하실 수 있습니다.
            </p>
          </div>
        </header>

        <div className="max-w-md mx-auto px-5 -mt-6 space-y-5">
          <section className="card">
            <p className="section-label mb-3">{maskedName} 어린이 정보</p>
            <dl className="grid grid-cols-2 gap-x-3 gap-y-2.5 text-sm">
              <InfoRow label="학년" value={grade} />
              {payload.serviceType && <InfoRow label="이용 프로그램" value={payload.serviceType} />}
              {counselor && <InfoRow label="담당 선생님" value={counselor} />}
              {recentClassDate && <InfoRow label="최근 수업일" value={recentClassDate} />}
              {nextClass && <InfoRow label="다음 수업일" value={nextClass} />}
            </dl>
          </section>

          <section>
            <p className="text-sm text-ink/50 mb-3 px-1">확인할 항목을 선택해주세요.</p>
            <div className="grid grid-cols-2 gap-3">
              {CARDS.filter((c) => c.show).map((c) => (
                <button
                  key={c.key}
                  onClick={() => setTab(c.key)}
                  className="card !p-4 text-left hover:border-sage-300 transition-colors"
                >
                  <p className="text-2xl mb-2">{c.emoji}</p>
                  <p className="font-bold text-[15px] mb-1">{c.title}</p>
                  <p className="text-xs text-ink/55 leading-relaxed">{c.desc}</p>
                </button>
              ))}
            </div>
          </section>

          <footer className="text-center text-xs text-ink/45 leading-relaxed pt-2 px-4">
            본 마이페이지는 보호자 확인용이며, 외부 공유를 삼가 주세요.
            <p className="mt-3">ⓒ 학습심리브레인센터</p>
          </footer>
        </div>
      </div>
    );
  }

  return (
    <div className="pb-14">
      {/* [주의] sticky로 두지 않음 — /family(형제자매) 화면에서는 이 위에 이미
          sticky 탭 바가 있어서, 둘 다 sticky top-0이면 스크롤 시 서로 겹칩니다. */}
      <div className="bg-sage-700 text-white px-5 py-3.5 flex items-center gap-3">
        <button onClick={() => setTab("home")} className="text-sm font-medium opacity-90 hover:opacity-100">
          ‹ 마이페이지
        </button>
        <p className="text-sm font-bold">{TAB_TITLE[tab]}</p>
      </div>

      {/* [주의] 결과지 탭은 자체적으로 전체 폭 헤더(rounded-b-[2rem])를 그리므로
          아래의 max-w-md 컨테이너 밖에서 렌더링합니다. */}
      {tab === "report" ? (
        isMtpris ? (
          <MtprisReportView
            content={payload.content}
            childMaskedName={payload.childMaskedName}
            childGrade={payload.childGrade}
            testDate={payload.testDate}
            counselor={payload.counselor}
          />
        ) : (
          <TemperamentReportView report={payload.report} />
        )
      ) : (
        <div className="max-w-md mx-auto px-5 pt-5 space-y-5">
          {tab === "attendance" && <FamilyAttendanceCalendar attendance={payload.attendance} photos={payload.photos} token={token} />}
          {tab === "photos" && (
            <>
              <ActivityAlbumSection photos={payload.photos} />
              <CenterNewsSection photos={payload.blogPhotos} />
            </>
          )}
          {tab === "brain" && <BrainTestSummarySection tests={payload.brainTests} />}
          {tab === "feedback" && (
            <FeedbackSection
              token={token}
              items={feedback}
              onSubmitted={(f) => setFeedback((prev) => [f, ...prev])}
            />
          )}
        </div>
      )}
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-ink/40">{label}</dt>
      <dd className="mt-0.5 font-medium">{value}</dd>
    </div>
  );
}

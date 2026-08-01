"use client";

/**
 * 아이 상세 페이지 탭 셸 — 데이터 페칭은 전부 서버 컴포넌트(app/admin/children/[id]/page.tsx)가
 * 하고, 이 컴포넌트는 이미 만들어진 JSX를 탭별로 넘겨받아 전환만 담당합니다.
 * (components/parent/ParentDashboard.tsx와 동일한 "서버가 준비 → 클라이언트는 전환만" 패턴)
 */

import { useState, type ReactNode } from "react";

type TabKey = "info" | "reports" | "attendance" | "brain" | "photos" | "comments";

const TABS: { key: TabKey; label: string }[] = [
  { key: "info", label: "기본정보" },
  { key: "reports", label: "결과지" },
  { key: "attendance", label: "출결·보강" },
  { key: "brain", label: "뇌기능검사" },
  { key: "photos", label: "활동사진" },
  { key: "comments", label: "수업 코멘트" },
];

export default function ChildDetailTabs({
  info,
  reports,
  attendance,
  brain,
  photos,
  comments,
}: {
  info: ReactNode;
  reports: ReactNode;
  attendance: ReactNode;
  brain: ReactNode;
  photos: ReactNode;
  comments: ReactNode;
}) {
  const [tab, setTab] = useState<TabKey>("info");
  const content: Record<TabKey, ReactNode> = { info, reports, attendance, brain, photos, comments };

  return (
    <div>
      <div className="flex gap-1.5 overflow-x-auto pb-1 mb-5 -mx-1 px-1">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            className={`shrink-0 px-4 py-2 rounded-full text-sm font-medium transition-colors ${
              tab === t.key ? "bg-sage-600 text-white" : "bg-white border border-sage-200 text-ink/60"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div className="space-y-5">{content[tab]}</div>
    </div>
  );
}

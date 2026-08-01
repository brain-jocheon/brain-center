"use client";

/**
 * 학부모 마이페이지 "공지사항" 탭 — 대상 조건에 맞게 이미 필터링되어 내려온 공지만 표시.
 * 처음 펼쳐볼 때 POST /api/report/notices/read로 읽음 처리(무상태 구조라 매번 토큰으로 재확인).
 */

import { useState } from "react";
import type { ParentFacingNotice } from "@/lib/types";

export default function NoticeSection({ token, notices: initialNotices }: { token: string; notices: ParentFacingNotice[] }) {
  const [notices, setNotices] = useState(initialNotices);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  async function toggle(n: ParentFacingNotice) {
    const opening = expandedId !== n.id;
    setExpandedId(opening ? n.id : null);
    if (opening && !n.isRead) {
      setNotices((prev) => prev.map((x) => (x.id === n.id ? { ...x, isRead: true } : x)));
      try {
        await fetch("/api/report/notices/read", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token, noticeId: n.id }),
        });
      } catch {
        // 무시 — 읽음 표시 요청이 실패해도 공지 내용은 이미 확인했으므로 화면 흐름은 막지 않음
      }
    }
  }

  if (notices.length === 0) {
    return <section className="card text-center text-sm text-ink/50 py-10">등록된 공지가 없습니다.</section>;
  }

  return (
    <section className="space-y-3">
      {notices.map((n) => (
        <button key={n.id} onClick={() => toggle(n)} className="card !p-4 text-left w-full block">
          <div className="flex items-center justify-between gap-2">
            <p className="font-semibold text-sm flex items-center gap-1.5">
              {!n.isRead && <span className="w-2 h-2 rounded-full bg-apricot-500 shrink-0" />}
              {n.title}
            </p>
            <span className="text-[11px] text-ink/40 shrink-0">{n.createdAt.slice(0, 10)}</span>
          </div>
          {expandedId === n.id && (
            <p className="text-sm text-ink/70 mt-2 leading-relaxed whitespace-pre-wrap">{n.body}</p>
          )}
        </button>
      ))}
    </section>
  );
}

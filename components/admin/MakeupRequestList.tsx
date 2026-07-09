"use client";

/**
 * 보강 희망일 요청 목록 — 대기중/승인됨/거절됨 구분해서 보여주고, 대기중인 것만 처리 버튼 표시.
 */

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { MakeupRequest } from "@/lib/types";

const STATUS_LABEL: Record<MakeupRequest["status"], string> = {
  pending: "대기중",
  approved: "승인됨",
  rejected: "거절됨",
};
const STATUS_COLOR: Record<MakeupRequest["status"], string> = {
  pending: "bg-apricot-50 text-apricot-600",
  approved: "bg-sage-100 text-sage-700",
  rejected: "bg-ink/5 text-ink/40",
};

export default function MakeupRequestList({
  requests,
  childNames,
}: {
  requests: MakeupRequest[];
  childNames: Record<string, { name: string; grade: string }>;
}) {
  const pending = requests.filter((r) => r.status === "pending");
  const resolved = requests.filter((r) => r.status !== "pending");

  if (requests.length === 0) {
    return <p className="text-sm text-ink/50 py-10 text-center">아직 보강 요청이 없습니다.</p>;
  }

  return (
    <div className="space-y-6">
      {pending.length > 0 && (
        <div className="space-y-3">
          <p className="section-label">대기중 ({pending.length})</p>
          {pending.map((r) => (
            <RequestCard key={r.id} request={r} child={childNames[r.childId]} />
          ))}
        </div>
      )}
      {resolved.length > 0 && (
        <details className="mt-8">
          <summary className="text-sm text-ink/50 cursor-pointer select-none">
            처리된 요청 ({resolved.length}건)
          </summary>
          <div className="space-y-3 mt-4">
            {resolved.map((r) => (
              <RequestCard key={r.id} request={r} child={childNames[r.childId]} />
            ))}
          </div>
        </details>
      )}
    </div>
  );
}

function RequestCard({ request, child }: { request: MakeupRequest; child?: { name: string; grade: string } }) {
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const router = useRouter();

  async function decide(decision: "approved" | "rejected") {
    setSaving(true);
    setMessage("");
    const res = await fetch(`/api/admin/makeup-requests/${request.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ decision }),
    });
    setSaving(false);
    if (res.ok) router.refresh();
    else setMessage("처리에 실패했습니다.");
  }

  return (
    <div className="card">
      <div className="flex items-start justify-between gap-3 mb-2">
        <div>
          {child ? (
            <Link href={`/admin/children/${request.childId}`} className="font-bold text-sage-700 hover:underline">
              {child.name} <span className="text-ink/40 font-normal text-sm">{child.grade}</span>
            </Link>
          ) : (
            <p className="font-bold text-ink/40">(삭제된 아이)</p>
          )}
          <p className="text-sm text-ink/60 mt-0.5">
            {request.originalClassDate && <>결석일 {request.originalClassDate} → </>}
            희망 보강일 <strong>{request.requestedDate}</strong>
          </p>
        </div>
        <span className={`text-[11px] rounded-full px-2.5 py-1 font-medium shrink-0 ${STATUS_COLOR[request.status]}`}>
          {STATUS_LABEL[request.status]}
        </span>
      </div>
      {request.parentMemo && <p className="text-sm text-ink/70 mt-2">"{request.parentMemo}"</p>}
      <p className="text-[11px] text-ink/35 mt-2">요청일 {request.createdAt.slice(0, 10)}</p>

      {message && <p className="text-xs text-apricot-600 mt-2">{message}</p>}

      {request.status === "pending" && (
        <div className="flex items-center gap-2 mt-3">
          <button className="btn-primary text-sm !py-2" disabled={saving} onClick={() => decide("approved")}>
            승인
          </button>
          <button className="btn-ghost text-sm !py-2" disabled={saving} onClick={() => decide("rejected")}>
            거절
          </button>
        </div>
      )}
    </div>
  );
}

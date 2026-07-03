"use client";

/**
 * 아동 상세 화면 헤더의 관리 메뉴 — 그만둠 표시/재등록, 완전 삭제
 * [주의] 삭제는 되돌릴 수 없고 검사 리포트·학부모 링크가 모두 함께 삭제됩니다.
 */

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function ChildManagePanel({
  childId,
  childName,
  status,
}: {
  childId: string;
  childName: string;
  status: "active" | "archived";
}) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const router = useRouter();

  async function handleToggleStatus() {
    const next = status === "active" ? "archived" : "active";
    setBusy(true);
    setMessage("");
    const res = await fetch(`/api/admin/children/${childId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: next }),
    });
    setBusy(false);
    if (res.ok) {
      router.refresh();
    } else {
      setMessage("변경에 실패했습니다. 다시 시도해 주세요.");
    }
  }

  async function handleDelete() {
    if (!confirm(`${childName} 아동을 완전히 삭제하시겠습니까?\n검사 리포트와 학부모 링크가 모두 함께 삭제되며, 되돌릴 수 없습니다.`)) return;
    setBusy(true);
    setMessage("");
    const res = await fetch(`/api/admin/children/${childId}`, { method: "DELETE" });
    setBusy(false);
    if (res.ok) {
      router.push("/admin");
    } else {
      setMessage("삭제에 실패했습니다. 다시 시도해 주세요.");
    }
  }

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {status === "archived" && (
        <span className="text-[11px] bg-apricot-50 text-apricot-600 rounded-full px-2.5 py-1 font-medium">그만둔 아이</span>
      )}
      <button className="btn-ghost text-xs !px-3.5 !py-1.5" disabled={busy} onClick={handleToggleStatus}>
        {status === "active" ? "그만둠으로 표시" : "다시 활성화"}
      </button>
      <button className="btn-ghost text-xs !px-3.5 !py-1.5 !text-apricot-600 !border-apricot-200" disabled={busy} onClick={handleDelete}>
        완전히 삭제
      </button>
      {message && <span className="text-xs text-apricot-600">{message}</span>}
    </div>
  );
}

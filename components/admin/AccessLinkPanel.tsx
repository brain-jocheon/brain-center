"use client";

/**
 * 학부모 열람 링크 발급 · 회수 패널 (아동 상세 화면, 리포트별로 1개씩)
 * - 활성 링크 있음: 링크 복사 + 비활성화 버튼
 * - 활성 링크 없음: 발급 버튼 → 비밀번호/만료일 입력 폼 → 발급 직후 평문 비밀번호 1회 표시
 * [보안] 평문 비밀번호는 저장되지 않으므로 발급 응답에서만 볼 수 있고, 새로고침하면 사라집니다.
 */

import { useState } from "react";
import { useRouter } from "next/navigation";
import CopyLinkButton from "@/components/CopyLinkButton";

export default function AccessLinkPanel({
  reportId,
  reportKind,
  active,
}: {
  reportId: string;
  reportKind: "temperament" | "mtpris";
  active: { token: string } | null;
}) {
  const [issuing, setIssuing] = useState(false);
  const [password, setPassword] = useState("");
  const [expiresAt, setExpiresAt] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [issuedPassword, setIssuedPassword] = useState<string | null>(null);
  const router = useRouter();

  async function handleIssue() {
    setSaving(true);
    setMessage("");
    const res = await fetch("/api/admin/access", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reportId, reportKind, password, expiresAt: expiresAt || undefined }),
    });
    setSaving(false);
    if (res.ok) {
      const data = await res.json();
      setIssuedPassword(data.password);
      setIssuing(false);
      setPassword("");
      setExpiresAt("");
      router.refresh();
    } else {
      const data = await res.json().catch(() => null);
      setMessage(data?.message || "발급에 실패했습니다. 다시 시도해 주세요.");
    }
  }

  async function handleRevoke(token: string) {
    if (!confirm("이 링크를 비활성화하시겠습니까? 학부모가 더 이상 접속할 수 없게 됩니다.")) return;
    setSaving(true);
    const res = await fetch("/api/admin/access", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, active: false }),
    });
    setSaving(false);
    if (res.ok) {
      router.refresh();
    } else {
      setMessage("비활성화에 실패했습니다. 다시 시도해 주세요.");
    }
  }

  if (issuedPassword) {
    return (
      <div className="mt-4 rounded-xl bg-apricot-50 border border-apricot-200 px-4 py-3">
        <p className="text-xs font-semibold text-apricot-700 mb-1.5">학부모 비밀번호 (지금만 확인 가능)</p>
        <p className="text-lg font-bold tracking-wide">{issuedPassword}</p>
        <p className="text-[11px] text-apricot-600 mt-2">
          이 화면을 벗어나면 다시 확인할 수 없습니다. 지금 바로 복사해서 링크와 별도로 전달해 주세요.
        </p>
        <button className="btn-ghost text-xs !px-3.5 !py-1.5 mt-3" onClick={() => setIssuedPassword(null)}>
          확인함
        </button>
      </div>
    );
  }

  if (active) {
    return (
      <div className="mt-4 rounded-xl bg-sage-50 px-4 py-3">
        <p className="text-xs font-semibold text-sage-700 mb-1.5">학부모 열람 링크</p>
        <div className="flex items-center gap-2 flex-wrap">
          <code className="text-xs bg-white rounded-lg px-2.5 py-1.5 border border-sage-100 break-all flex-1 min-w-0">
            /report/{active.token}
          </code>
          <CopyLinkButton path={`/report/${active.token}`} />
          <button className="btn-ghost text-xs !px-3.5 !py-1.5 shrink-0" disabled={saving} onClick={() => handleRevoke(active.token)}>
            비활성화
          </button>
        </div>
        <p className="text-[11px] text-ink/40 mt-2">
          ※ 링크와 비밀번호는 문자/카카오톡으로 각각 따로 전달하는 것이 안전합니다.
        </p>
        {message && <p className="text-xs text-apricot-600 mt-2">{message}</p>}
      </div>
    );
  }

  if (!issuing) {
    return (
      <div className="mt-4 rounded-xl bg-sage-50 px-4 py-3">
        <p className="text-xs font-semibold text-sage-700 mb-1.5">학부모 열람 링크</p>
        <button className="btn-ghost text-xs !px-3.5 !py-1.5" onClick={() => setIssuing(true)}>
          링크 발급
        </button>
      </div>
    );
  }

  return (
    <div className="mt-4 rounded-xl bg-sage-50 px-4 py-3">
      <p className="text-xs font-semibold text-sage-700 mb-2">학부모 링크 발급</p>
      <div className="flex flex-col sm:flex-row gap-2">
        <input
          className="input !py-2 text-sm"
          type="text"
          placeholder="학부모 비밀번호 (4자 이상)"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <input
          className="input !py-2 text-sm sm:max-w-[160px]"
          type="date"
          value={expiresAt}
          onChange={(e) => setExpiresAt(e.target.value)}
        />
      </div>
      {message && <p className="text-xs text-apricot-600 mt-2">{message}</p>}
      <div className="flex items-center gap-2 mt-3">
        <button className="btn-primary text-sm !py-2.5" disabled={saving || password.length < 4} onClick={handleIssue}>
          {saving ? "발급 중..." : "발급"}
        </button>
        <button
          className="btn-ghost text-sm !py-2.5"
          onClick={() => {
            setIssuing(false);
            setPassword("");
            setExpiresAt("");
            setMessage("");
          }}
        >
          취소
        </button>
      </div>
    </div>
  );
}

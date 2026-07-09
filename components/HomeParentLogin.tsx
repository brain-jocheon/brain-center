"use client";

/**
 * 홈페이지에서 고유 링크 없이 "아이 이름 + 비밀번호"로 바로 결과지 확인.
 * ---------------------------------------------------------------------
 * /api/report/find-family 로 이름+비밀번호가 일치하는 아이(+같은 비밀번호를 쓰는
 * 형제자매)의 마스킹된 콘텐츠를 한 번에 받아서, sessionStorage에 1회성으로
 * 담아 /family로 이동합니다 — 그 페이지가 즉시 읽어 소비하고 지웁니다.
 * [보안] 비밀번호 자체는 저장하지 않고, 이미 서버에서 검증·마스킹된 결과만
 * 아주 잠깐(같은 탭, 페이지 이동 전까지만) 머무릅니다.
 */

import { useState } from "react";

export default function HomeParentLogin() {
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/report/find-family", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, password }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.message || "이름 또는 비밀번호가 맞지 않습니다.");
        return;
      }
      sessionStorage.setItem("bc_family_result", JSON.stringify(data.children));
      window.location.href = "/family";
    } catch {
      setError("연결에 문제가 있습니다. 잠시 후 다시 시도해 주세요.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-2.5 mt-5 pt-5 border-t border-sage-100 text-left">
      <p className="text-xs font-semibold text-sage-700 text-center mb-1">아이 이름으로 바로 확인하기</p>
      <input
        className="input !py-2.5 text-sm"
        type="text"
        placeholder="아이 이름"
        value={name}
        onChange={(e) => setName(e.target.value)}
      />
      <input
        className="input !py-2.5 text-sm"
        type="password"
        inputMode="numeric"
        placeholder="비밀번호"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
      />
      {error && <p className="text-xs text-apricot-600 text-center">{error}</p>}
      <button type="submit" className="btn-primary w-full !py-2.5 text-sm" disabled={loading || !name.trim() || !password}>
        {loading ? "확인 중..." : "결과지 확인"}
      </button>
    </form>
  );
}

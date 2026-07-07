"use client";

/**
 * 홈페이지에서 고유 링크 없이 "아이 이름 + 비밀번호"로 바로 결과지 확인.
 * ---------------------------------------------------------------------
 * 1. /api/report/find-token 으로 이름+비밀번호가 일치하는 토큰을 찾는다.
 * 2. 비밀번호를 다시 입력하지 않도록 sessionStorage에 잠깐 넣어두고
 *    /report/{token}으로 이동 — 그 페이지가 1회성으로 읽어 자동 로그인한다.
 * [보안] 비밀번호는 sessionStorage에 아주 잠깐(같은 탭, 페이지 이동 전까지만)
 * 머무르고, 읽히는 즉시 지워집니다.
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
      const res = await fetch("/api/report/find-token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, password }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.message || "이름 또는 비밀번호가 맞지 않습니다.");
        return;
      }
      sessionStorage.setItem(`bc_pending_pw_${data.token}`, password);
      window.location.href = `/report/${data.token}`;
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

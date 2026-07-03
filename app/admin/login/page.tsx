"use client";

/**
 * 관리자 로그인 화면
 * [보안] 비밀번호는 .env.local의 ADMIN_PASSWORD와 서버에서 비교합니다.
 */
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function AdminLogin() {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    const res = await fetch("/api/admin/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });
    setLoading(false);
    if (res.ok) {
      router.push("/admin");
      router.refresh();
    } else {
      setError("비밀번호가 맞지 않습니다.");
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center px-6">
      <div className="card max-w-sm w-full py-9 text-center">
        <p className="section-label mb-3">학습심리브레인센터</p>
        <h1 className="text-xl font-bold mb-7">관리자 로그인</h1>
        <form onSubmit={handleSubmit} className="space-y-3">
          <input
            type="password"
            className="input text-center"
            placeholder="관리자 비밀번호"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoFocus
          />
          {error && <p className="text-sm text-apricot-600">{error}</p>}
          <button type="submit" className="btn-primary w-full" disabled={loading}>
            {loading ? "확인 중..." : "로그인"}
          </button>
        </form>
      </div>
    </main>
  );
}

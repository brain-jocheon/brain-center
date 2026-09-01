"use client";

/**
 * 관리자/선생님 로그인 화면
 * [보안] 관리자 비밀번호는 .env.local의 ADMIN_PASSWORD와 서버에서 비교합니다.
 * [7단계] 기존 관리자 로그인(비밀번호 1개) 로직은 그대로 두고, 탭으로
 * "선생님으로 로그인"(전화번호+비밀번호, staff 테이블 조회)을 병행 추가했습니다.
 */
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function AdminLogin() {
  const [tab, setTab] = useState<"admin" | "staff">("admin");

  return (
    <main className="min-h-screen flex items-center justify-center px-6">
      <div className="card max-w-sm w-full py-9 text-center">
        <p className="section-label mb-3">학습심리브레인센터</p>
        <h1 className="text-xl font-bold mb-5">{tab === "admin" ? "관리자 로그인" : "선생님 로그인"}</h1>
        <div className="flex gap-1.5 justify-center mb-6">
          <button
            type="button"
            onClick={() => setTab("admin")}
            className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
              tab === "admin" ? "bg-sage-600 text-white" : "bg-white border border-sage-200 text-ink/60"
            }`}
          >
            관리자로 로그인
          </button>
          <button
            type="button"
            onClick={() => setTab("staff")}
            className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
              tab === "staff" ? "bg-sage-600 text-white" : "bg-white border border-sage-200 text-ink/60"
            }`}
          >
            선생님으로 로그인
          </button>
        </div>
        {tab === "admin" ? <AdminLoginForm /> : <StaffLoginForm />}
      </div>
    </main>
  );
}

function AdminLoginForm() {
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
  );
}

function StaffLoginForm() {
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    const res = await fetch("/api/staff/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone, password }),
    });
    setLoading(false);
    if (res.ok) {
      router.push("/admin");
      router.refresh();
    } else {
      const data = await res.json().catch(() => null);
      setError(data?.message || "로그인에 실패했습니다.");
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <input
        type="tel"
        className="input text-center"
        placeholder="전화번호"
        value={phone}
        onChange={(e) => setPhone(e.target.value)}
        autoFocus
      />
      <input
        type="password"
        className="input text-center"
        placeholder="비밀번호"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
      />
      {error && <p className="text-sm text-apricot-600">{error}</p>}
      <button type="submit" className="btn-primary w-full" disabled={loading}>
        {loading ? "확인 중..." : "로그인"}
      </button>
    </form>
  );
}

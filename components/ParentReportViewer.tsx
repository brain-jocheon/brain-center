"use client";

/**
 * =====================================================================
 * 학부모 결과지 진입점 (비밀번호 게이트 + 마이페이지 대시보드)
 * ---------------------------------------------------------------------
 * 흐름: 비밀번호 입력 → 서버 검증(/api/report/verify) → 마이페이지 대시보드
 * 표시. 검증 직후 같은 token+password로 /api/report/siblings를 한 번 더
 * 불러 형제자매를 찾고(있으면), 있으면 대시보드 상단에 아이 전환 바가
 * 뜹니다 — /family(이름+비밀번호 로그인)로 들어오지 않아도 개별 링크
 * 하나만으로 형제자매를 오갈 수 있게 하기 위함입니다.
 *
 * [보안]
 * - 비밀번호 검증, 이름 마스킹 해제 여부, 상담사 전용 정보 제거는 모두
 *   서버에서 처리됩니다.
 * - 비밀번호를 localStorage 등에 저장하지 않습니다 (siblings 조회에 쓰는
 *   동안만 컴포넌트 메모리에 머무름).
 * - 학부모 화면에는 인쇄 기능을 제공하지 않습니다.
 * =====================================================================
 */

import { useState, useEffect, useCallback } from "react";
import type { VerifyPayload, FamilyMember } from "@/lib/reportPayload";
import ParentDashboard from "./parent/ParentDashboard";

export default function ParentReportViewer({ token }: { token: string }) {
  const [password, setPassword] = useState("");
  const [members, setMembers] = useState<FamilyMember[] | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const submitPassword = useCallback(
    async (pw: string) => {
      setError("");
      setLoading(true);
      try {
        const res = await fetch("/api/report/verify", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token, password: pw }),
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          setError(data.message || "비밀번호가 맞지 않습니다. 다시 확인해 주세요.");
          return;
        }
        const payload = (await res.json()) as VerifyPayload;
        const maskedName = payload.kind === "mtpris" ? payload.childMaskedName : payload.report.childMaskedName;
        setMembers([{ maskedName, token, payload }]);

        // 형제자매 조회는 부가 기능이라 실패해도 마이페이지 자체 이용에는 지장 없게 조용히 무시
        fetch("/api/report/siblings", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token, password: pw }),
        })
          .then((r) => (r.ok ? r.json() : null))
          .then((data: { siblings?: FamilyMember[] } | null) => {
            if (data?.siblings?.length) {
              setMembers((prev) => (prev ? [prev[0], ...data.siblings!] : prev));
            }
          })
          .catch(() => {});
      } catch {
        setError("연결에 문제가 있습니다. 잠시 후 다시 시도해 주세요.");
      } finally {
        setLoading(false);
      }
    },
    [token]
  );

  // 홈페이지 "아이 이름으로 확인하기"에서 넘어온 경우, 비밀번호를 다시 입력하지 않도록
  // sessionStorage에 잠깐 남겨둔 값을 1회성으로 읽어 자동 로그인 — 읽는 즉시 지운다.
  useEffect(() => {
    const key = `bc_pending_pw_${token}`;
    const pw = sessionStorage.getItem(key);
    if (pw) {
      sessionStorage.removeItem(key);
      setPassword(pw);
      submitPassword(pw);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    await submitPassword(password);
  }

  /* ---------- 1단계: 비밀번호 입력 ---------- */
  if (!members) {
    return (
      <main className="min-h-screen flex items-center justify-center px-6">
        <div className="card max-w-sm w-full py-9 text-center">
          <p className="section-label mb-3">학습심리브레인센터</p>
          <h1 className="text-xl font-bold mb-2">우리 아이 결과 리포트</h1>
          <p className="text-sm text-ink/60 mb-7 leading-relaxed">
            안내받으신 비밀번호를 입력하시면
            <br />
            결과지를 확인하실 수 있습니다.
          </p>
          <form onSubmit={handleSubmit} className="space-y-3">
            <input
              type="password"
              inputMode="numeric"
              className="input text-center tracking-widest"
              placeholder="비밀번호"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoFocus
            />
            {error && <p className="text-sm text-apricot-600">{error}</p>}
            <button type="submit" className="btn-primary w-full" disabled={loading}>
              {loading ? "확인 중..." : "결과지 열기"}
            </button>
          </form>
          <p className="mt-6 text-xs text-ink/40 leading-relaxed">
            비밀번호를 잊으셨다면 센터로 문의해 주세요.
          </p>
        </div>
      </main>
    );
  }

  /* ---------- 2단계: 학부모 마이페이지 대시보드 ---------- */
  return (
    <main className="min-h-screen">
      <ParentDashboard members={members} />
    </main>
  );
}

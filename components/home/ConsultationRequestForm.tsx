"use client";

/**
 * 상담 신청서 — 공개 홈페이지, 로그인 불필요. ContactButton 모달 안에서 열립니다.
 * 개인정보 동의를 체크해야 제출 버튼이 활성화됩니다.
 */

import { useState } from "react";

// app/page.tsx의 PROGRAMS 제목과 동일하게 맞춰둔 목록(모듈이 달라 값만 재사용)
const PROGRAM_OPTIONS = [
  "뉴로피드백 두뇌훈련",
  "뇌기능검사 및 해석 상담",
  "다원재능 기질검사",
  "정서·자존감 성장 프로그램",
  "진로탐색 및 자기주도학습 프로그램",
  "만들기·요리·창작 활동",
  "바우처 서비스",
  "잘 모르겠어요, 상담받고 정하고 싶어요",
];
const REFERRAL_OPTIONS = ["지인 소개", "인터넷 검색", "SNS", "블로그·카페", "간판 보고", "기타"];

export default function ConsultationRequestForm({ onDone }: { onDone: () => void }) {
  const [guardianName, setGuardianName] = useState("");
  const [guardianPhone, setGuardianPhone] = useState("");
  const [childName, setChildName] = useState("");
  const [childAgeGrade, setChildAgeGrade] = useState("");
  const [concern, setConcern] = useState("");
  const [isExistingMember, setIsExistingMember] = useState(false);
  const [desiredProgram, setDesiredProgram] = useState("");
  const [desiredDatetime, setDesiredDatetime] = useState("");
  const [referralSource, setReferralSource] = useState("");
  const [additionalMessage, setAdditionalMessage] = useState("");
  const [consent, setConsent] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState("");
  const [done, setDone] = useState(false);

  const canSubmit = !!guardianName.trim() && !!guardianPhone.trim() && !!childName.trim() && consent && !submitting;

  async function handleSubmit() {
    if (!canSubmit) return;
    setSubmitting(true);
    setMessage("");
    try {
      const res = await fetch("/api/consultations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          guardianName, guardianPhone, childName,
          childAgeGrade: childAgeGrade || undefined,
          concern: concern || undefined,
          isExistingMember,
          desiredProgram: desiredProgram || undefined,
          desiredDatetime: desiredDatetime || undefined,
          referralSource: referralSource || undefined,
          additionalMessage: additionalMessage || undefined,
          consent,
        }),
      });
      if (res.ok) {
        setDone(true);
      } else {
        const data = await res.json().catch(() => null);
        setMessage(data?.message || "제출에 실패했습니다. 잠시 후 다시 시도해 주세요.");
      }
    } catch {
      setMessage("네트워크 오류로 제출에 실패했습니다.");
    } finally {
      setSubmitting(false);
    }
  }

  if (done) {
    return (
      <div className="text-center py-4">
        <p className="text-3xl mb-3">🌱</p>
        <p className="font-bold mb-2">신청이 접수되었습니다.</p>
        <p className="text-sm text-ink/60 leading-relaxed mb-5">
          남겨주신 연락처로 빠르게 연락드리겠습니다. 감사합니다.
        </p>
        <button className="btn-primary w-full" onClick={onDone}>닫기</button>
      </div>
    );
  }

  return (
    <div className="max-h-[75vh] overflow-y-auto pr-1 -mr-1">
      <p className="section-label mb-1">상담 신청서</p>
      <h3 className="text-base font-bold mb-5">편하신 정보만 남겨주셔도 괜찮아요</h3>

      <div className="space-y-3 text-left">
        <label className="block">
          <span className="block text-sm font-medium mb-1">보호자 이름 *</span>
          <input className="input" value={guardianName} onChange={(e) => setGuardianName(e.target.value)} />
        </label>
        <label className="block">
          <span className="block text-sm font-medium mb-1">연락처 *</span>
          <input className="input" type="tel" value={guardianPhone} onChange={(e) => setGuardianPhone(e.target.value)} placeholder="010-0000-0000" />
        </label>
        <label className="block">
          <span className="block text-sm font-medium mb-1">아이 이름 *</span>
          <input className="input" value={childName} onChange={(e) => setChildName(e.target.value)} />
        </label>
        <label className="block">
          <span className="block text-sm font-medium mb-1">아이 나이·학년</span>
          <input className="input" value={childAgeGrade} onChange={(e) => setChildAgeGrade(e.target.value)} placeholder="예: 초등 3학년" />
        </label>
        <label className="block">
          <span className="block text-sm font-medium mb-1">어떤 점이 걱정되시나요?</span>
          <textarea className="input min-h-16" value={concern} onChange={(e) => setConcern(e.target.value)} />
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={isExistingMember} onChange={(e) => setIsExistingMember(e.target.checked)} />
          이미 센터를 이용 중이에요
        </label>
        <label className="block">
          <span className="block text-sm font-medium mb-1">희망 프로그램</span>
          <select className="input" value={desiredProgram} onChange={(e) => setDesiredProgram(e.target.value)}>
            <option value="">선택 안 함</option>
            {PROGRAM_OPTIONS.map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
        </label>
        <label className="block">
          <span className="block text-sm font-medium mb-1">희망 상담 일시</span>
          <input className="input" value={desiredDatetime} onChange={(e) => setDesiredDatetime(e.target.value)} placeholder="예: 이번 주 평일 오후" />
        </label>
        <label className="block">
          <span className="block text-sm font-medium mb-1">저희 센터를 어떻게 알게 되셨나요?</span>
          <select className="input" value={referralSource} onChange={(e) => setReferralSource(e.target.value)}>
            <option value="">선택 안 함</option>
            {REFERRAL_OPTIONS.map((r) => <option key={r} value={r}>{r}</option>)}
          </select>
        </label>
        <label className="block">
          <span className="block text-sm font-medium mb-1">추가로 전달하고 싶은 내용</span>
          <textarea className="input min-h-16" value={additionalMessage} onChange={(e) => setAdditionalMessage(e.target.value)} />
        </label>
        <label className="flex items-start gap-2 text-xs text-ink/60 pt-1">
          <input type="checkbox" className="mt-0.5" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
          <span>
            상담 신청 접수 및 연락을 위해 위 정보를 수집·이용하는 데 동의합니다. (상담 목적 외에는 사용하지 않으며, 상담 종료 후 별도 보관 정책에 따라 처리됩니다.) *
          </span>
        </label>
      </div>

      {message && <p className="text-sm text-apricot-600 mt-3">{message}</p>}

      <button className="btn-primary w-full mt-4" disabled={!canSubmit} onClick={handleSubmit}>
        {submitting ? "제출 중..." : "신청서 제출하기"}
      </button>
    </div>
  );
}

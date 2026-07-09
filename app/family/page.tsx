"use client";

/**
 * =====================================================================
 * 우리 아이들 (형제자매 통합 화면)
 * ---------------------------------------------------------------------
 * 홈페이지 "아이 이름으로 바로 확인하기"에서 로그인 성공 시 sessionStorage에
 * 담아 넘겨준 결과(이미 서버에서 검증·마스킹 완료)를 1회성으로 읽어 렌더링합니다.
 * 직접 이 페이지로 들어온 경우(로그인 데이터 없음)에는 홈페이지로 안내합니다.
 * [보안] sessionStorage는 읽는 즉시 지우고, 비밀번호는 애초에 여기 담기지 않습니다.
 * =====================================================================
 */

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import type { VerifyPayload } from "@/lib/reportPayload";
import TemperamentReportView from "@/components/TemperamentReportView";
import MtprisReportView from "@/components/mtpris/MtprisReportView";

interface FamilyMember {
  childId: string;
  maskedName: string;
  payload: VerifyPayload;
}

export default function FamilyPage() {
  const [members, setMembers] = useState<FamilyMember[] | null>(null);
  const [selected, setSelected] = useState(0);
  const [loadFailed, setLoadFailed] = useState(false);
  // [주의] React 18 개발 모드 Strict Mode는 effect를 일부러 두 번 실행합니다.
  // sessionStorage는 한 번 읽으면 지우는 "1회성 소비" 데이터라, 가드 없이 두 번
  // 읽으면 두 번째 실행이 "이미 비어있음"을 실패로 착각해 방금 성공한 상태를
  // 덮어써버립니다 — ref로 실제 실행은 한 번만 되도록 막습니다.
  const consumedRef = useRef(false);

  useEffect(() => {
    if (consumedRef.current) return;
    consumedRef.current = true;

    const raw = sessionStorage.getItem("bc_family_result");
    sessionStorage.removeItem("bc_family_result");
    if (!raw) {
      setLoadFailed(true);
      return;
    }
    try {
      const parsed = JSON.parse(raw) as FamilyMember[];
      if (Array.isArray(parsed) && parsed.length > 0) setMembers(parsed);
      else setLoadFailed(true);
    } catch {
      setLoadFailed(true);
    }
  }, []);

  if (loadFailed) {
    return (
      <main className="min-h-screen flex items-center justify-center px-6">
        <div className="card max-w-sm w-full py-9 text-center">
          <p className="section-label mb-3">학습심리브레인센터</p>
          <h1 className="text-xl font-bold mb-3">먼저 로그인해 주세요</h1>
          <p className="text-sm text-ink/60 mb-7 leading-relaxed">
            홈페이지에서 아이 이름과 비밀번호를 입력하시면
            <br />
            이 화면으로 연결됩니다.
          </p>
          <Link href="/" className="btn-primary w-full inline-flex justify-center">
            홈페이지로 이동
          </Link>
        </div>
      </main>
    );
  }

  if (!members) {
    return <main className="min-h-screen flex items-center justify-center text-sm text-ink/40">불러오는 중...</main>;
  }

  const current = members[selected];

  return (
    <main className="min-h-screen pb-14">
      {members.length > 1 && (
        <div className="bg-sage-700 sticky top-0 z-20">
          <div className="max-w-md mx-auto px-5 py-3 flex items-center gap-2 overflow-x-auto">
            {members.map((m, i) => (
              <button
                key={m.childId}
                onClick={() => setSelected(i)}
                className={`shrink-0 px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
                  i === selected ? "bg-white text-sage-700" : "bg-white/10 text-white"
                }`}
              >
                {m.maskedName}
              </button>
            ))}
          </div>
        </div>
      )}

      {current.payload.kind === "mtpris" ? (
        <MtprisReportView
          content={current.payload.content}
          childMaskedName={current.payload.childMaskedName}
          childGrade={current.payload.childGrade}
          testDate={current.payload.testDate}
          counselor={current.payload.counselor}
          photos={current.payload.photos}
          blogPhotos={current.payload.blogPhotos}
          brainTests={current.payload.brainTests}
          attendance={current.payload.attendance}
        />
      ) : (
        <TemperamentReportView
          report={current.payload.report}
          photos={current.payload.photos}
          blogPhotos={current.payload.blogPhotos}
          brainTests={current.payload.brainTests}
          attendance={current.payload.attendance}
        />
      )}
    </main>
  );
}

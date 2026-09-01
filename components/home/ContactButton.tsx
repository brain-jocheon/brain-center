"use client";

/**
 * 상담 문의 버튼 — 클릭하면 "전화로 상담하기 / (카카오톡 등록 시)카카오톡으로
 * 상담하기 / 상담 신청서 작성하기" 중 고를 수 있는 선택창을 띄웁니다.
 * "신청서 작성하기"를 누르면 같은 모달이 ConsultationRequestForm으로 전환되어,
 * 전화가 부담스럽거나 부재중에도 비동기로 상담을 신청할 수 있습니다.
 */

import { useState } from "react";
import { createPortal } from "react-dom";
import ConsultationRequestForm from "./ConsultationRequestForm";

export default function ContactButton({
  phoneHref,
  kakaoUrl,
  label,
  className,
}: {
  phoneHref: string;
  kakaoUrl?: string;
  label: string;
  className: string;
}) {
  const [mode, setMode] = useState<"closed" | "choice" | "form">("closed");

  return (
    <>
      <button type="button" className={className} onClick={() => setMode("choice")}>
        {label}
      </button>
      {mode !== "closed" &&
        createPortal(
          <div
            className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
            onClick={() => setMode("closed")}
          >
            <div
              className={`card w-full ${mode === "form" ? "max-w-md" : "max-w-xs text-center"}`}
              onClick={(e) => e.stopPropagation()}
            >
              {mode === "choice" ? (
                <>
                  <p className="section-label mb-1">상담 문의</p>
                  <h3 className="text-base font-bold mb-5">어떤 방법으로 상담받고 싶으세요?</h3>
                  <div className="space-y-2.5">
                    <a href={phoneHref} className="btn-primary w-full">
                      📞 전화로 상담하기
                    </a>
                    {kakaoUrl && (
                      <a href={kakaoUrl} target="_blank" rel="noopener noreferrer" className="btn-ghost w-full">
                        💬 카카오톡으로 상담하기
                      </a>
                    )}
                    <button type="button" className="btn-ghost w-full" onClick={() => setMode("form")}>
                      ✍️ 상담 신청서 작성하기
                    </button>
                  </div>
                  <button className="text-xs text-ink/40 mt-4" onClick={() => setMode("closed")}>
                    닫기
                  </button>
                </>
              ) : (
                <ConsultationRequestForm onDone={() => setMode("closed")} />
              )}
            </div>
          </div>,
          document.body
        )}
    </>
  );
}

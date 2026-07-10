"use client";

/**
 * 상담 문의 버튼 — 카카오톡 채널이 등록되어 있으면 클릭 시 "전화로 상담하기 /
 * 카카오톡으로 상담하기" 중 고를 수 있는 작은 선택창을 띄우고, 등록되어 있지
 * 않으면 예전처럼 바로 전화 연결 링크로 동작합니다.
 */

import { useState } from "react";
import { createPortal } from "react-dom";

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
  const [open, setOpen] = useState(false);

  if (!kakaoUrl) {
    return (
      <a href={phoneHref} className={className}>
        {label}
      </a>
    );
  }

  return (
    <>
      <button type="button" className={className} onClick={() => setOpen(true)}>
        {label}
      </button>
      {open &&
        createPortal(
          <div
            className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
            onClick={() => setOpen(false)}
          >
            <div className="card max-w-xs w-full text-center" onClick={(e) => e.stopPropagation()}>
              <p className="section-label mb-1">상담 문의</p>
              <h3 className="text-base font-bold mb-5">어떤 방법으로 상담받고 싶으세요?</h3>
              <div className="space-y-2.5">
                <a href={phoneHref} className="btn-primary w-full">
                  📞 전화로 상담하기
                </a>
                <a href={kakaoUrl} target="_blank" rel="noopener noreferrer" className="btn-ghost w-full">
                  💬 카카오톡으로 상담하기
                </a>
              </div>
              <button className="text-xs text-ink/40 mt-4" onClick={() => setOpen(false)}>
                닫기
              </button>
            </div>
          </div>,
          document.body
        )}
    </>
  );
}

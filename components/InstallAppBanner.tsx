"use client";

/**
 * 앱 설치 안내 배너
 * ---------------------------------------------------------------------
 * - 이미 홈 화면 앱으로 실행 중(standalone)이면 아무것도 안 보임
 * - 안드로이드/크롬: 브라우저의 beforeinstallprompt를 받아 "앱으로 설치"
 *   버튼 → 누르면 바로 시스템 설치창이 뜸
 * - 아이폰/아이패드(사파리): 자동 설치가 불가능하므로 "공유 → 홈 화면에
 *   추가" 방법을 단계별로 안내
 * - 닫으면 localStorage에 기록해 30일간 다시 보이지 않음
 */

import { useEffect, useState } from "react";

const DISMISS_KEY = "bc_install_banner_dismissed_at";
const DISMISS_DAYS = 30;

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

function isRecentlyDismissed(): boolean {
  try {
    const at = Number(localStorage.getItem(DISMISS_KEY) ?? 0);
    return at > 0 && Date.now() - at < DISMISS_DAYS * 24 * 60 * 60 * 1000;
  } catch {
    return false;
  }
}

function isStandalone(): boolean {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    // iOS 사파리 전용 속성
    (navigator as unknown as { standalone?: boolean }).standalone === true
  );
}

function isIos(): boolean {
  const ua = navigator.userAgent;
  // iPadOS 13+는 데스크톱 사파리로 위장하므로 터치 지원 Mac도 iPad로 취급
  return /iPhone|iPad|iPod/i.test(ua) || (ua.includes("Macintosh") && navigator.maxTouchPoints > 1);
}

export default function InstallAppBanner() {
  const [mode, setMode] = useState<"hidden" | "android" | "ios" | "ios-guide">("hidden");
  const [installEvent, setInstallEvent] = useState<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    if (isStandalone() || isRecentlyDismissed()) return;

    if (isIos()) {
      setMode("ios");
      return;
    }

    // 안드로이드/크롬 계열 — 설치 가능해지면 브라우저가 이 이벤트를 쏴줌
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setInstallEvent(e as BeforeInstallPromptEvent);
      setMode("android");
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    return () => window.removeEventListener("beforeinstallprompt", onPrompt);
  }, []);

  function dismiss() {
    try {
      localStorage.setItem(DISMISS_KEY, String(Date.now()));
    } catch {
      // localStorage 사용 불가(사생활 보호 모드 등)여도 이번 화면에서는 닫힘
    }
    setMode("hidden");
  }

  async function installAndroid() {
    if (!installEvent) return;
    await installEvent.prompt();
    const choice = await installEvent.userChoice.catch(() => null);
    if (choice?.outcome === "accepted") setMode("hidden");
    else dismiss();
  }

  if (mode === "hidden") return null;

  return (
    <div className="fixed bottom-0 inset-x-0 z-40 p-3 sm:p-4 pointer-events-none">
      <div className="max-w-md mx-auto card !border-sage-200 shadow-lg pointer-events-auto">
        {mode === "ios-guide" ? (
          <>
            <p className="font-bold text-[15px] mb-2">아이폰에 설치하는 방법</p>
            <ol className="text-sm text-ink/75 leading-relaxed space-y-1.5 mb-3 list-decimal list-inside">
              <li>
                사파리 하단(또는 상단)의 <strong>공유 버튼</strong>{" "}
                <span aria-hidden>
                  {/* iOS 공유 아이콘 모양 */}
                  <svg viewBox="0 0 24 24" className="inline w-4 h-4 -mt-1 text-sage-700" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 3v12" /><path d="M8 7l4-4 4 4" /><rect x="5" y="11" width="14" height="10" rx="2" />
                  </svg>
                </span>
                을 눌러주세요.
              </li>
              <li>
                아래로 내려 <strong>"홈 화면에 추가"</strong>를 선택해주세요.
              </li>
              <li>
                오른쪽 위 <strong>"추가"</strong>를 누르면 완료!
              </li>
            </ol>
            <p className="text-xs text-ink/45 mb-3">
              홈 화면에 생긴 아이콘으로 언제든 바로 들어오실 수 있어요.
            </p>
            <button className="btn-ghost w-full !py-2 text-sm" onClick={dismiss}>확인했어요</button>
          </>
        ) : (
          <div className="flex items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/icons/icon-192.png" alt="" className="w-10 h-10 rounded-xl shrink-0" />
            <div className="grow min-w-0">
              <p className="font-bold text-sm">앱처럼 설치해서 쓰세요</p>
              <p className="text-xs text-ink/55 leading-snug">
                홈 화면 아이콘으로 출결·사진·결과지를 바로 확인!
              </p>
            </div>
            <div className="flex flex-col gap-1.5 shrink-0">
              {mode === "android" ? (
                <button className="btn-primary !px-3.5 !py-1.5 text-xs" onClick={installAndroid}>
                  앱으로 설치
                </button>
              ) : (
                <button className="btn-primary !px-3.5 !py-1.5 text-xs" onClick={() => setMode("ios-guide")}>
                  설치 방법 보기
                </button>
              )}
              <button className="text-xs text-ink/40 underline underline-offset-2" onClick={dismiss}>
                닫기
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

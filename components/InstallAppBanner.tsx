"use client";

/**
 * 앱 설치 안내 배너
 * ---------------------------------------------------------------------
 * - 이미 홈 화면 앱으로 실행 중(standalone)이면 아무것도 안 보임
 * - 안드로이드/아이폰 모두 "브라우저 메뉴 → 홈 화면에 추가" 수동 안내로
 *   통일합니다.
 *
 * [주의 — 2026-07-16] 원래는 안드로이드에서 beforeinstallprompt를 받아
 * "앱으로 설치" 버튼 한 번으로 설치되게 했었습니다. 하지만 이 방식은
 * 크롬이 뒤에서 WebAPK(진짜 안드로이드 앱 파일)를 자동 생성해 설치하는
 * 과정을 거치는데, 이 WebAPK 생성 서버 쪽에 구글 측 문제가 있어 Play
 * 보호 기능이 "Android 이전 버전에 맞게 개발되었으며 최신 개인정보 보호
 * 기능을 포함하지 않습니다"라며 설치를 차단하는 사례가 널리 보고되고
 * 있습니다(우리 사이트만의 문제가 아님, 코드로 해결 불가).
 * "홈 화면에 추가"(브라우저 자체 바로가기 기능)는 이 WebAPK 생성 과정을
 * 아예 거치지 않아 문제를 우회하면서도, 열었을 때 전체화면으로 보이는
 * 효과는 동일합니다.
 */

import { useEffect, useState } from "react";

const DISMISS_KEY = "bc_install_banner_dismissed_at";
const DISMISS_DAYS = 30;

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

const MenuIcon = () => (
  <svg viewBox="0 0 24 24" className="inline w-4 h-4 -mt-1 text-sage-700" fill="currentColor">
    <circle cx="12" cy="5" r="1.6" />
    <circle cx="12" cy="12" r="1.6" />
    <circle cx="12" cy="19" r="1.6" />
  </svg>
);

const ShareIcon = () => (
  <svg viewBox="0 0 24 24" className="inline w-4 h-4 -mt-1 text-sage-700" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 3v12" /><path d="M8 7l4-4 4 4" /><rect x="5" y="11" width="14" height="10" rx="2" />
  </svg>
);

export default function InstallAppBanner() {
  const [mode, setMode] = useState<"hidden" | "prompt" | "guide">("hidden");
  const [platform, setPlatform] = useState<"ios" | "android">("android");

  useEffect(() => {
    if (isStandalone() || isRecentlyDismissed()) return;
    setPlatform(isIos() ? "ios" : "android");
    setMode("prompt");
  }, []);

  function dismiss() {
    try {
      localStorage.setItem(DISMISS_KEY, String(Date.now()));
    } catch {
      // localStorage 사용 불가(사생활 보호 모드 등)여도 이번 화면에서는 닫힘
    }
    setMode("hidden");
  }

  if (mode === "hidden") return null;

  return (
    <div className="fixed bottom-0 inset-x-0 z-40 p-3 sm:p-4 pointer-events-none">
      <div className="max-w-md mx-auto card !border-sage-200 shadow-lg pointer-events-auto">
        {mode === "guide" ? (
          <>
            <p className="font-bold text-[15px] mb-2">
              {platform === "ios" ? "아이폰에 설치하는 방법" : "안드로이드에 설치하는 방법"}
            </p>
            {platform === "ios" ? (
              <ol className="text-sm text-ink/75 leading-relaxed space-y-1.5 mb-3 list-decimal list-inside">
                <li>
                  사파리 하단(또는 상단)의 <strong>공유 버튼</strong> <ShareIcon />을 눌러주세요.
                </li>
                <li>
                  아래로 내려 <strong>"홈 화면에 추가"</strong>를 선택해주세요.
                </li>
                <li>
                  오른쪽 위 <strong>"추가"</strong>를 누르면 완료!
                </li>
              </ol>
            ) : (
              <ol className="text-sm text-ink/75 leading-relaxed space-y-1.5 mb-3 list-decimal list-inside">
                <li>
                  브라우저 오른쪽 위(또는 아래)의 <strong>메뉴</strong> <MenuIcon />를 눌러주세요.
                </li>
                <li>
                  <strong>"홈 화면에 추가"</strong>를 선택해주세요. ("앱 설치"가 아니라 "홈 화면에 추가"를 선택해 주세요)
                </li>
                <li>
                  안내 창에서 <strong>"추가"</strong>를 누르면 완료!
                </li>
              </ol>
            )}
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
              <button className="btn-primary !px-3.5 !py-1.5 text-xs" onClick={() => setMode("guide")}>
                설치 방법 보기
              </button>
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

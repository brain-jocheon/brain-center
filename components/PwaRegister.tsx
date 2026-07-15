"use client";

/**
 * 홈 화면 설치(PWA)를 위해 서비스워커를 등록만 합니다.
 * 아무 것도 캐시하지 않는 최소 서비스워커(public/sw.js)라, 등록 실패해도
 * 사이트 이용에는 전혀 지장이 없어 조용히 무시합니다.
 */
import { useEffect } from "react";

export default function PwaRegister() {
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }
  }, []);
  return null;
}

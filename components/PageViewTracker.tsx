"use client";

/**
 * 일반 방문자 페이지뷰 기록 — 화면에 아무것도 그리지 않고, 경로가 바뀔
 * 때마다 조용히 서버에 방문 사실만 알립니다.
 * [주의] /admin 이하는 운영자 본인 접속이라 통계에서 제외합니다.
 * [보안] visitorId는 개인정보가 아닌 브라우저 로컬 저장소의 무작위 값이며,
 * 실명·연락처와 전혀 연결되지 않습니다.
 */

import { useEffect } from "react";
import { usePathname } from "next/navigation";

const VISITOR_ID_KEY = "bc_visitor_id";

function getOrCreateVisitorId(): string {
  try {
    let id = localStorage.getItem(VISITOR_ID_KEY);
    if (!id) {
      id = crypto.randomUUID();
      localStorage.setItem(VISITOR_ID_KEY, id);
    }
    return id;
  } catch {
    return "anonymous";
  }
}

export default function PageViewTracker() {
  const pathname = usePathname();

  useEffect(() => {
    if (!pathname || pathname.startsWith("/admin")) return;
    const visitorId = getOrCreateVisitorId();
    fetch("/api/track/page-view", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path: pathname, visitorId }),
      keepalive: true,
    }).catch(() => {});
  }, [pathname]);

  return null;
}

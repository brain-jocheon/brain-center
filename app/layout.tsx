import type { Metadata, Viewport } from "next";
import "./globals.css";
import PwaRegister from "@/components/PwaRegister";
import InstallAppBanner from "@/components/InstallAppBanner";
import PageViewTracker from "@/components/PageViewTracker";

export const metadata: Metadata = {
  title: "학습심리브레인센터",
  description: "아동·청소년 기질검사 결과 리포트 서비스",
  // [보안] 서비스 전체를 기본적으로 검색엔진 수집 제외
  // (아동 개인정보를 다루는 서비스이므로 노출될 이유가 없음)
  robots: { index: false, follow: false },
  icons: {
    icon: [
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
  // 아이폰에서 "홈 화면에 추가" 시 브라우저 주소창 없이 앱처럼 열리게 함
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "브레인센터",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#41604F",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body>
        <PwaRegister />
        <PageViewTracker />
        {children}
        {/* 앱 설치 안내 — 이미 설치했거나 닫은 사람에게는 안 보임 */}
        <InstallAppBanner />
      </body>
    </html>
  );
}

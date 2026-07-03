import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "학습심리브레인센터 결과 리포트",
  description: "아동·청소년 기질검사 결과 리포트 서비스",
  // [보안] 서비스 전체를 기본적으로 검색엔진 수집 제외
  // (아동 개인정보를 다루는 서비스이므로 노출될 이유가 없음)
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}

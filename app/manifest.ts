import type { MetadataRoute } from "next";

/**
 * PWA 매니페스트 — 학부모·선생님이 홈 화면에 "앱"처럼 설치할 수 있게 합니다.
 * Next.js가 자동으로 /manifest.webmanifest로 제공하고 <head>에 링크를 넣어줍니다.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "학습심리브레인센터",
    short_name: "브레인센터",
    description: "아동·청소년 성장지원센터 — 출결, 활동사진, 검사결과를 한 곳에서 확인하세요.",
    start_url: "/",
    display: "standalone",
    background_color: "#FBF8F2",
    theme_color: "#41604F",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}

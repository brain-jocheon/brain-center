/** @type {import('next').NextConfig} */
const nextConfig = {
  // [보안] 학부모 결과 페이지가 검색엔진에 노출되지 않도록
  // 각 페이지에서 noindex 메타태그를 함께 사용합니다. (app/report/[token]/page.tsx 참고)
  reactStrictMode: true,
  // [11단계] pdf-parse가 의존하는 pdfjs-dist는 webpack이 서버 컴포넌트/라우트 핸들러용으로
  // 번들링하면 "Object.defineProperty called on non-object" 오류가 남(알려진 호환성 문제) —
  // 이 패키지들은 번들링하지 말고 Node의 원래 require로 그대로 불러오게 함.
  experimental: {
    serverComponentsExternalPackages: ["pdf-parse", "pdfjs-dist"],
    // [11단계] pdfjs-dist는 워커 스크립트(pdf.worker.mjs)를 런타임에 동적으로 상대경로로
    // require하는데, 이런 동적 참조는 Vercel의 배포 파일 추적(file tracing)이 놓쳐서
    // 실제 배포 결과물에 이 파일이 안 담기는 걸 프로덕션에서 확인함 — 강제로 포함시킴.
    outputFileTracingIncludes: {
      "/api/admin/brain-tests/[id]/extract": ["node_modules/pdfjs-dist/legacy/build/**"],
    },
  },
  // [14단계/보안] 표준적이고 안전한 헤더 3개만 추가. 전체 CSP는 스크립트/스타일 소스 전수조사가
  // 필요해서(잘못 설정하면 기존 화면이 깨질 위험) 이번엔 하지 않음 — README에 향후 과제로 기록.
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        ],
      },
    ];
  },
};
module.exports = nextConfig;

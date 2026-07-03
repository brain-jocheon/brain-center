/** @type {import('next').NextConfig} */
const nextConfig = {
  // [보안] 학부모 결과 페이지가 검색엔진에 노출되지 않도록
  // 각 페이지에서 noindex 메타태그를 함께 사용합니다. (app/report/[token]/page.tsx 참고)
  reactStrictMode: true,
};
module.exports = nextConfig;

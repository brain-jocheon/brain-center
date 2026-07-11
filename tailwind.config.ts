import type { Config } from "tailwindcss";

/**
 * 디자인 토큰: 상담센터 자료처럼 따뜻하고 정돈된 분위기
 * - 바탕: 따뜻한 아이보리(라이넨)
 * - 주조색: 부드러운 파스텔 세이지 그린 (신뢰감 + 따뜻함)
 * - 포인트: 파스텔 살구색
 * 단계 이름(50~800)은 그대로 유지하고 값만 부드럽게 조정 —
 * 홈페이지·리포트·관리자 화면 전체에 통일감 있게 적용됩니다.
 */
const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        linen: "#FBF8F2",
        ink: "#414B46",
        sage: {
          50: "#F4F8F5",
          100: "#E7EFE9",
          200: "#CFE0D5",
          400: "#92B4A0",
          600: "#5C8770",
          700: "#4C7260",
          800: "#41604F",
        },
        apricot: {
          50: "#FDF4ED",
          100: "#FAE7D8",
          400: "#ECAE86",
          600: "#C9825A",
        },
      },
      fontFamily: {
        sans: [
          "Pretendard Variable",
          "Pretendard",
          "-apple-system",
          "BlinkMacSystemFont",
          "Apple SD Gothic Neo",
          "Noto Sans KR",
          "Malgun Gothic",
          "sans-serif",
        ],
      },
      borderRadius: { card: "1.25rem" },
    },
  },
  plugins: [],
};
export default config;

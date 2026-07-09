import type { Config } from "tailwindcss";

/**
 * 디자인 토큰: 상담센터 자료처럼 따뜻하고 정돈된 분위기
 * - 바탕: 은은한 라이넨색
 * - 주조색: 차분한 세이지 그린 (신뢰감)
 * - 포인트: 부드러운 살구색 (따뜻함)
 */
const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        linen: "#FAF7F2",
        ink: "#3D4A44",
        sage: {
          50: "#F2F6F3",
          100: "#E2ECE5",
          200: "#C4D9CB",
          400: "#7FA98D",
          600: "#4E7A5F",
          700: "#3E6350",
          800: "#324F41",
        },
        apricot: {
          50: "#FDF3EC",
          100: "#FAE4D4",
          400: "#E8A87C",
          600: "#C97F4E",
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

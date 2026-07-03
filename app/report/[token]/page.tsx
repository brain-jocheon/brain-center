import type { Metadata } from "next";
import ParentReportViewer from "@/components/ParentReportViewer";

/**
 * 학부모 결과 페이지 진입점
 * URL 예: /report/sample-token-a7f3k9m2...
 *
 * [보안]
 * - 이 페이지 자체는 토큰의 유효성만 알 뿐, 데이터는 담고 있지 않습니다.
 *   실제 결과는 비밀번호 검증 후 /api/report/verify 가 마스킹하여 내려줍니다.
 * - noindex: 검색엔진 수집 차단 (robots.txt와 이중 방어)
 */
export const metadata: Metadata = {
  title: "우리 아이 결과 리포트 | 학습심리브레인센터",
  robots: { index: false, follow: false },
};

// [보안] 결과 페이지는 캐시하지 않음 (공용 기기의 뒤로가기/캐시로 남는 것 방지)
export const dynamic = "force-dynamic";

export default function ReportPage({ params }: { params: { token: string } }) {
  return <ParentReportViewer token={params.token} />;
}

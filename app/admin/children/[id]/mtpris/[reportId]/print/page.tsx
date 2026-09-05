/**
 * MT-PRIS 인쇄용 결과지 (A4) — 관리자 전용
 * 같은 generateMtprisContent() 함수로 모바일 화면과 동일한 데이터를 사용하되,
 * 여기서는 마스킹하지 않은 전체 콘텐츠(counselorAppendix 포함)를 전달합니다.
 */
import { notFound } from "next/navigation";
import { getChild, getMtprisReport } from "@/lib/data";
import { getCurrentActor, isFullAdmin } from "@/lib/auth";
import { generateMtprisContent } from "@/lib/mtpris/generate";
import MtprisPrintSheet from "@/components/mtpris/MtprisPrintSheet";

export const dynamic = "force-dynamic";

export default async function MtprisPrintPage({
  params,
}: {
  params: { id: string; reportId: string };
}) {
  // [보안] 위 주석대로 관리자 전용 화면 — 담당 여부와 무관하게 URL 직접 접근을 막음(IDOR 방지)
  if (!isFullAdmin(getCurrentActor())) notFound();

  const child = await getChild(params.id);
  const raw = await getMtprisReport(params.reportId);
  if (!child || !raw || raw.childId !== child.id) notFound();

  const content = generateMtprisContent(raw);

  return (
    <MtprisPrintSheet
      child={child}
      content={content}
      testDate={raw.testDate}
      counselor={raw.counselor}
    />
  );
}

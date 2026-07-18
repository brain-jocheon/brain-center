/**
 * 일반 방문자 페이지뷰 기록 (로그인 여부와 무관, 인증 불필요)
 * ---------------------------------------------------------------------
 * POST { path, visitorId } — visitorId는 브라우저 localStorage에 저장된
 * 무작위 값(개인정보 아님)으로, 관리자 화면에서 "오늘/이번 주 고유 방문자
 * 수"를 집계하는 데만 씁니다.
 */
import { NextResponse } from "next/server";
import { recordPageView } from "@/lib/data";

export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as { path?: string; visitorId?: string } | null;
  const path = body?.path;
  const visitorId = body?.visitorId;

  if (typeof path !== "string" || !path || typeof visitorId !== "string" || !visitorId) {
    return NextResponse.json({ message: "잘못된 요청입니다." }, { status: 400 });
  }

  try {
    await recordPageView(path.slice(0, 200), visitorId.slice(0, 100));
  } catch {
    // 통계 기록 실패가 방문자 경험에 영향을 주면 안 되므로 조용히 무시
  }

  return NextResponse.json({ ok: true });
}

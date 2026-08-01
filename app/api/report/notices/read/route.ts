/**
 * =====================================================================
 * 학부모 전용 공지 읽음 처리
 * ---------------------------------------------------------------------
 * POST { token, noticeId }
 * [보안] childId를 클라이언트에서 직접 받지 않고, 이미 검증된 학부모 링크
 * 토큰으로 서버가 아이를 확인합니다(app/api/report/feedback과 동일 패턴).
 * 그 아이가 실제로 이 공지의 대상인지도 matchesNoticeAudience로 다시
 * 검증한 뒤에만 읽음 기록을 남깁니다 — 클라이언트가 아무 noticeId나
 * 넣어서 무의미한 읽음 기록을 쌓는 것을 방지합니다.
 * =====================================================================
 */
import { NextResponse } from "next/server";
import { getAccessByToken, getReport, getMtprisReport, getChild, getParentNotice, matchesNoticeAudience, markNoticeRead } from "@/lib/data";

export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as { token?: string; noticeId?: string } | null;

  const token = body?.token?.trim();
  const noticeId = body?.noticeId?.trim();
  if (!token || !noticeId) {
    return NextResponse.json({ message: "잘못된 요청입니다." }, { status: 400 });
  }

  const access = await getAccessByToken(token);
  if (!access) {
    return NextResponse.json({ message: "링크가 유효하지 않습니다." }, { status: 401 });
  }

  const childId =
    access.reportKind === "mtpris"
      ? (await getMtprisReport(access.reportId))?.childId
      : (await getReport(access.reportId))?.childId;
  if (!childId) {
    return NextResponse.json({ message: "아이 정보를 찾을 수 없습니다." }, { status: 404 });
  }

  const [notice, child] = await Promise.all([getParentNotice(noticeId), getChild(childId)]);
  if (!notice || !child || !matchesNoticeAudience(notice, child)) {
    return NextResponse.json({ message: "공지를 찾을 수 없습니다." }, { status: 404 });
  }

  await markNoticeRead(noticeId, childId);
  return NextResponse.json({ ok: true });
}

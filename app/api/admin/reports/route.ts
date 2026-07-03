/**
 * 리포트 저장 API (관리자 전용)
 *
 * [보안] 미들웨어는 /admin 화면만 보호하므로,
 * API는 여기서 직접 세션을 다시 확인합니다. (이중 확인)
 *
 * [주의] MVP는 data/reports.json 파일에 저장합니다.
 * Vercel 같은 서버리스 환경에서는 파일 쓰기가 유지되지 않으므로
 * 운영 배포 전 반드시 데이터베이스로 전환하세요. (lib/data.ts 참고)
 */
import { NextResponse } from "next/server";
import { isAdminLoggedIn } from "@/lib/auth";
import { getReport, saveReport } from "@/lib/data";
import type { Report } from "@/lib/types";

export async function PUT(req: Request) {
  // [보안] 관리자 세션 확인 — 없으면 거부
  if (!isAdminLoggedIn()) {
    return NextResponse.json({ message: "로그인이 필요합니다." }, { status: 401 });
  }

  const body = (await req.json().catch(() => null)) as Report | null;
  if (!body?.id || !body?.childId) {
    return NextResponse.json({ message: "잘못된 요청입니다." }, { status: 400 });
  }

  // 존재하는 리포트만 수정 허용 (MVP: 새 리포트 생성은 JSON 파일로)
  const existing = await getReport(body.id);
  if (!existing) {
    return NextResponse.json({ message: "리포트를 찾을 수 없습니다." }, { status: 404 });
  }

  // [보안] childId 등 연결 정보는 클라이언트 값을 믿지 않고 기존 값 유지
  await saveReport({ ...body, childId: existing.childId, id: existing.id });

  return NextResponse.json({ ok: true });
}

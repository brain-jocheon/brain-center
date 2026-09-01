/**
 * 보강 희망일 요청 목록 조회 (관리자 전용)
 * GET ?status=pending 처럼 필터 가능, 없으면 전체
 */
import { NextResponse } from "next/server";
import { getCurrentActor, isFullAdmin } from "@/lib/auth";
import { getMakeupRequests } from "@/lib/data";
import type { MakeupRequest } from "@/lib/types";

export async function GET(req: Request) {
  if (!isFullAdmin(getCurrentActor())) {
    return NextResponse.json({ message: "권한이 없습니다." }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status") as MakeupRequest["status"] | null;

  const requests = await getMakeupRequests({ status: status || undefined });
  return NextResponse.json({ ok: true, requests });
}

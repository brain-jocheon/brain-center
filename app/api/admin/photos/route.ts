/**
 * 활동 사진 메타데이터 생성 API (관리자 전용)
 * [보안] middleware.ts는 /api/admin/*을 보호하지 않으므로 이 세션 확인이 유일한 인증 게이트입니다.
 * 이 라우트가 호출되는 시점엔 이미 클라이언트가 Storage에 파일을 직접 업로드 완료한 상태입니다.
 */
import { NextResponse } from "next/server";
import { isAdminLoggedIn } from "@/lib/auth";
import { createActivityPhoto } from "@/lib/data";
import type { ActivityPhoto } from "@/lib/types";

const ACTIVITY_TYPES: ActivityPhoto["activityType"][] = ["class", "craft", "cooking", "neurofeedback", "event", "other"];

export async function POST(req: Request) {
  if (!isAdminLoggedIn()) {
    return NextResponse.json({ message: "로그인이 필요합니다." }, { status: 401 });
  }

  const body = (await req.json().catch(() => null)) as
    | {
        storagePath?: string;
        activityDate?: string;
        activityName?: string;
        activityType?: string;
        description?: string;
        isPublicToParent?: boolean;
        memo?: string;
        studentIds?: string[];
      }
    | null;

  const storagePath = body?.storagePath?.trim();
  const activityDate = body?.activityDate?.trim();
  const activityName = body?.activityName?.trim();
  const studentIds = Array.isArray(body?.studentIds) ? body!.studentIds!.filter((id) => typeof id === "string" && id) : [];

  if (!storagePath || !activityDate || !activityName) {
    return NextResponse.json({ message: "활동일과 활동명을 입력해 주세요." }, { status: 400 });
  }
  if (!body?.activityType || !ACTIVITY_TYPES.includes(body.activityType as ActivityPhoto["activityType"])) {
    return NextResponse.json({ message: "활동 유형이 올바르지 않습니다." }, { status: 400 });
  }
  if (studentIds.length === 0) {
    return NextResponse.json({ message: "사진에 태그할 아이를 한 명 이상 선택해 주세요." }, { status: 400 });
  }

  const photo = await createActivityPhoto({
    storagePath,
    activityDate,
    activityName,
    activityType: body.activityType as ActivityPhoto["activityType"],
    description: body.description?.trim() || undefined,
    isPublicToParent: !!body.isPublicToParent,
    memo: body.memo?.trim() || undefined,
    studentIds,
  });

  return NextResponse.json({ ok: true, photo });
}

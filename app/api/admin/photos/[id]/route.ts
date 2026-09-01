/**
 * 활동 사진 수정(PATCH)/삭제(DELETE) API (관리자 전용)
 * [보안] middleware.ts는 /api/admin/*을 보호하지 않으므로 이 세션 확인이 유일한 인증 게이트입니다.
 */
import { NextResponse } from "next/server";
import { getCurrentActor, isFullAdmin, type CurrentActor } from "@/lib/auth";
import { deleteActivityPhoto, deletePhotoFile, updateActivityPhoto, getPhoto, actorCanAccessChild } from "@/lib/data";
import type { ActivityPhoto } from "@/lib/types";

const ACTIVITY_TYPES: ActivityPhoto["activityType"][] = ["class", "craft", "cooking", "neurofeedback", "event", "other"];

/** 태그된 아이가 전부 담당 범위 안인지(센터소식 전용 사진은 관리자만) */
async function canAccessPhoto(actor: CurrentActor, photoId: string): Promise<boolean> {
  const photo = await getPhoto(photoId);
  if (!photo) return false;
  if (photo.isPublicToBlog && photo.studentIds.length === 0) return isFullAdmin(actor);
  const checks = await Promise.all(photo.studentIds.map((id) => actorCanAccessChild(actor, id)));
  return checks.every(Boolean);
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const actor = getCurrentActor();
  if (!actor) {
    return NextResponse.json({ message: "로그인이 필요합니다." }, { status: 401 });
  }
  if (!(await canAccessPhoto(actor, params.id))) {
    return NextResponse.json({ message: "권한이 없습니다." }, { status: 403 });
  }

  const body = (await req.json().catch(() => null)) as
    | {
        activityDate?: string;
        activityName?: string;
        activityType?: string;
        description?: string;
        isPublicToParent?: boolean;
        isPublicToBlog?: boolean;
        memo?: string;
        studentIds?: string[];
      }
    | null;

  if (!body || Object.keys(body).length === 0) {
    return NextResponse.json({ message: "잘못된 요청입니다." }, { status: 400 });
  }
  if (body.activityType !== undefined && !ACTIVITY_TYPES.includes(body.activityType as ActivityPhoto["activityType"])) {
    return NextResponse.json({ message: "활동 유형이 올바르지 않습니다." }, { status: 400 });
  }

  const found = await updateActivityPhoto(params.id, {
    activityDate: body.activityDate?.trim(),
    activityName: body.activityName?.trim(),
    activityType: body.activityType as ActivityPhoto["activityType"] | undefined,
    description: body.description?.trim(),
    isPublicToParent: body.isPublicToParent,
    isPublicToBlog: body.isPublicToBlog,
    memo: body.memo?.trim(),
    studentIds: body.studentIds,
  });
  if (!found) {
    return NextResponse.json({ message: "사진을 찾을 수 없습니다." }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const actor = getCurrentActor();
  if (!actor) {
    return NextResponse.json({ message: "로그인이 필요합니다." }, { status: 401 });
  }
  if (!(await canAccessPhoto(actor, params.id))) {
    return NextResponse.json({ message: "권한이 없습니다." }, { status: 403 });
  }

  const storagePath = await deleteActivityPhoto(params.id);
  if (!storagePath) {
    return NextResponse.json({ message: "사진을 찾을 수 없습니다." }, { status: 404 });
  }

  // [주의] Storage 파일 삭제 실패는 무시 — DB 행은 이미 지워졌으므로 화면/링크에서는
  // 즉시 사라짐. 파일 자체가 남더라도 서명 URL을 새로 발급할 방법이 없어 접근 불가.
  try {
    await deletePhotoFile(storagePath);
  } catch {
    // 무시
  }

  return NextResponse.json({ ok: true });
}

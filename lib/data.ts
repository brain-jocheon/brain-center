/**
 * =====================================================================
 * 데이터 접근 계층 (Data Access Layer)
 * ---------------------------------------------------------------------
 * ★ 이 프로젝트에서 가장 중요한 파일 중 하나입니다.
 *
 * 모든 화면과 API는 Supabase를 직접 호출하지 않고 반드시 이 파일의
 * 함수를 통해서만 데이터를 가져옵니다. 함수 시그니처는 예전 JSON 파일
 * 버전과 동일하게 유지되어 있으므로, 화면/API 코드는 이 파일을
 * 신경 쓰지 않아도 됩니다.
 *
 * [보안] SUPABASE_SERVICE_ROLE_KEY(서버 전용 키)로만 접속합니다.
 * 이 키는 RLS를 우회하므로, 실제 접근 제어(관리자 세션 확인, 학부모
 * 비밀번호 해시 비교)는 지금처럼 API 라우트/lib/auth.ts가 담당합니다.
 * 자세한 스키마는 supabase/schema.sql 참고.
 * =====================================================================
 */

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { randomBytes } from "crypto";
import type { Child, Report, AccessToken, ActivityPhoto } from "./types";
import type { MtprisRawInput } from "./mtpris/types";

// [주의] 모듈 최상단에서 즉시 클라이언트를 만들면 SUPABASE_URL/KEY가
// 없을 때 이 모듈을 import하는 순간(next build 포함) 바로 에러가 납니다.
// 실제로 함수가 호출되는 시점까지 생성을 미룹니다.
let client: SupabaseClient | null = null;
function db(): SupabaseClient {
  if (client) return client;
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY 환경변수가 설정되지 않았습니다. .env.local을 확인하세요.");
  }
  client = createClient(url, key, {
    auth: { persistSession: false },
    // [주의] Next.js는 서버에서 실행되는 fetch를 기본적으로 캐싱합니다.
    // 관리자 화면은 항상 최신 데이터를 봐야 하므로 모든 요청에 no-store를 강제합니다.
    global: { fetch: (input, init) => fetch(input, { ...init, cache: "no-store" }) },
  });
  return client;
}

/* ---------------- 아동 ---------------- */

const CHILD_SELECT =
  "id, name, grade, birthYear:birth_year, createdAt:created_at, status, birthDate:birth_date, gender, guardianName:guardian_name, guardianPhone:guardian_phone, serviceType:service_type, classDay:class_day, counselor, memo";

export async function getChildren(): Promise<Child[]> {
  const { data, error } = await db().from("children").select(CHILD_SELECT).order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as unknown as Child[];
}

export async function getChild(id: string): Promise<Child | null> {
  const { data, error } = await db().from("children").select(CHILD_SELECT).eq("id", id).maybeSingle();
  if (error) throw error;
  return (data as unknown as Child) ?? null;
}

export interface ChildInput {
  name: string;
  grade: string;
  birthYear?: number;
  birthDate?: string;
  gender?: "M" | "F";
  guardianName?: string;
  guardianPhone?: string;
  serviceType?: string;
  classDay?: string;
  counselor?: string;
  memo?: string;
}

export async function createChild(input: ChildInput): Promise<Child> {
  const row = {
    id: `child_${randomBytes(4).toString("hex")}`,
    name: input.name,
    grade: input.grade,
    birth_year: input.birthYear ?? null,
    created_at: new Date().toISOString().slice(0, 10),
    status: "active" as const,
    birth_date: input.birthDate || null,
    gender: input.gender || null,
    guardian_name: input.guardianName || null,
    guardian_phone: input.guardianPhone || null,
    service_type: input.serviceType || null,
    class_day: input.classDay || null,
    counselor: input.counselor || null,
    memo: input.memo || null,
  };
  const { error } = await db().from("children").insert(row);
  if (error) throw error;
  const child = await getChild(row.id);
  if (!child) throw new Error("아동 생성 직후 조회에 실패했습니다.");
  return child;
}

/** 아동 기본 정보 수정 (이름·학년·보호자정보·상태 등 일부만 보내도 됨) */
export async function updateChild(id: string, patch: Partial<ChildInput> & { status?: Child["status"] }): Promise<boolean> {
  const row: Record<string, unknown> = {};
  if (patch.name !== undefined) row.name = patch.name;
  if (patch.grade !== undefined) row.grade = patch.grade;
  if (patch.birthYear !== undefined) row.birth_year = patch.birthYear;
  if (patch.birthDate !== undefined) row.birth_date = patch.birthDate || null;
  if (patch.gender !== undefined) row.gender = patch.gender || null;
  if (patch.guardianName !== undefined) row.guardian_name = patch.guardianName || null;
  if (patch.guardianPhone !== undefined) row.guardian_phone = patch.guardianPhone || null;
  if (patch.serviceType !== undefined) row.service_type = patch.serviceType || null;
  if (patch.classDay !== undefined) row.class_day = patch.classDay || null;
  if (patch.counselor !== undefined) row.counselor = patch.counselor || null;
  if (patch.memo !== undefined) row.memo = patch.memo || null;
  if (patch.status !== undefined) row.status = patch.status;

  const { data, error } = await db().from("children").update(row).eq("id", id).select("id");
  if (error) throw error;
  return (data?.length ?? 0) > 0;
}

/** @deprecated updateChild(id, {status})로 대체됨. 기존 호출부 호환을 위해 유지 */
export async function setChildStatus(id: string, status: Child["status"]): Promise<boolean> {
  return updateChild(id, { status });
}

/**
 * 아동을 완전히 삭제합니다 (되돌릴 수 없음).
 * [주의] reports/mtpris_reports는 DB의 on delete cascade로 자동 삭제되지만,
 * access_tokens는 report_id에 외래키가 없어 자동으로 지워지지 않으므로 먼저 정리합니다.
 */
export async function deleteChild(id: string): Promise<boolean> {
  const [reports, mtprisReports] = await Promise.all([getReportsByChild(id), getMtprisReportsByChild(id)]);
  const reportIds = [...reports.map((r) => r.id), ...mtprisReports.map((r) => r.id)];
  if (reportIds.length > 0) {
    const { error: tokenError } = await db().from("access_tokens").delete().in("report_id", reportIds);
    if (tokenError) throw tokenError;
  }
  const { data, error } = await db().from("children").delete().eq("id", id).select("id");
  if (error) throw error;
  return (data?.length ?? 0) > 0;
}

/* ---------------- 리포트 ---------------- */

const REPORT_SELECT =
  "id, childId:child_id, testType:test_type, testTypeName:test_type_name, testDate:test_date, counselor, status, summary, scores, details, parentGuide:parent_guide, centerPlan:center_plan";

function reportToRow(r: Report) {
  return {
    id: r.id,
    child_id: r.childId,
    test_type: r.testType,
    test_type_name: r.testTypeName,
    test_date: r.testDate,
    counselor: r.counselor,
    status: r.status,
    summary: r.summary,
    scores: r.scores,
    details: r.details,
    parent_guide: r.parentGuide,
    center_plan: r.centerPlan,
  };
}

export async function getReports(): Promise<Report[]> {
  const { data, error } = await db().from("reports").select(REPORT_SELECT);
  if (error) throw error;
  return (data ?? []) as unknown as Report[];
}

export async function getReport(id: string): Promise<Report | null> {
  const { data, error } = await db().from("reports").select(REPORT_SELECT).eq("id", id).maybeSingle();
  if (error) throw error;
  return (data as unknown as Report) ?? null;
}

export async function getReportsByChild(childId: string): Promise<Report[]> {
  const { data, error } = await db().from("reports").select(REPORT_SELECT).eq("child_id", childId);
  if (error) throw error;
  return (data ?? []) as unknown as Report[];
}

export async function saveReport(updated: Report): Promise<void> {
  const { error } = await db().from("reports").upsert(reportToRow(updated), { onConflict: "id" });
  if (error) throw error;
}

/* ---------------- 학부모 접근 토큰 ---------------- */

const ACCESS_SELECT = "token, reportId:report_id, reportKind:report_kind, passwordHash:password_hash, expiresAt:expires_at, active";

export async function getAccessTokens(): Promise<AccessToken[]> {
  const { data, error } = await db().from("access_tokens").select(ACCESS_SELECT);
  if (error) throw error;
  return (data ?? []) as unknown as AccessToken[];
}

export async function getAccessByToken(token: string): Promise<AccessToken | null> {
  const { data, error } = await db().from("access_tokens").select(ACCESS_SELECT).eq("token", token).maybeSingle();
  if (error) throw error;
  const found = (data as unknown as AccessToken) ?? null;
  if (!found) return null;

  // [보안] 비활성화된 링크는 존재하지 않는 것처럼 처리
  if (!found.active) return null;

  // [보안] 만료일이 지난 링크 차단
  // [주의] expiresAt은 날짜만 저장되므로("2026-07-03") 그냥 new Date()로 비교하면
  // 그날 자정(00:00)을 기준으로 판단되어, 만료일 당일에도 새벽 이후엔 바로
  // "만료됨" 처리되는 버그가 있었음. 만료일 "그날 끝까지"는 유효하도록
  // 그날 23:59:59(UTC)를 기준으로 비교한다.
  if (found.expiresAt && new Date(`${found.expiresAt}T23:59:59Z`) < new Date()) return null;

  return found;
}

export async function createAccessToken(entry: AccessToken): Promise<void> {
  const row = {
    token: entry.token,
    report_id: entry.reportId,
    report_kind: entry.reportKind,
    password_hash: entry.passwordHash,
    expires_at: entry.expiresAt ?? null,
    active: entry.active,
  };
  const { error } = await db().from("access_tokens").insert(row);
  if (error) throw error;
}

export async function deactivateAccessToken(token: string): Promise<boolean> {
  const { data, error } = await db().from("access_tokens").update({ active: false }).eq("token", token).select("token");
  if (error) throw error;
  return (data?.length ?? 0) > 0;
}

/** 학부모 링크 열람 시도 기록 (성공/실패 모두) — 실패해도 상위 로직을 막지 않도록 호출부에서 감쌀 것 */
export async function logAccess(entry: {
  token: string;
  reportId: string | null;
  success: boolean;
  ip: string | null;
}): Promise<void> {
  const { error } = await db().from("access_logs").insert({
    token: entry.token,
    report_id: entry.reportId,
    success: entry.success,
    ip: entry.ip,
  });
  if (error) throw error;
}

/* ---------------- MT-PRIS 리포트 (원본 입력값만 저장) ---------------- */

const MTPRIS_SELECT =
  "id, childId:child_id, testType:test_type, testDate:test_date, counselor, status, mainType:main_type, subType:sub_type, scores, memo, memoPublic:memo_public";

function mtprisToRow(r: MtprisRawInput) {
  return {
    id: r.id,
    child_id: r.childId,
    test_type: r.testType,
    test_date: r.testDate,
    counselor: r.counselor,
    status: r.status,
    main_type: r.mainType,
    sub_type: r.subType,
    scores: r.scores,
    memo: r.memo ?? null,
    memo_public: r.memoPublic,
  };
}

export async function getMtprisReports(): Promise<MtprisRawInput[]> {
  const { data, error } = await db().from("mtpris_reports").select(MTPRIS_SELECT);
  if (error) throw error;
  return (data ?? []) as unknown as MtprisRawInput[];
}

export async function getMtprisReport(id: string): Promise<MtprisRawInput | null> {
  const { data, error } = await db().from("mtpris_reports").select(MTPRIS_SELECT).eq("id", id).maybeSingle();
  if (error) throw error;
  return (data as unknown as MtprisRawInput) ?? null;
}

export async function getMtprisReportsByChild(childId: string): Promise<MtprisRawInput[]> {
  const { data, error } = await db().from("mtpris_reports").select(MTPRIS_SELECT).eq("child_id", childId);
  if (error) throw error;
  return (data ?? []) as unknown as MtprisRawInput[];
}

export async function saveMtprisReport(updated: MtprisRawInput): Promise<void> {
  const { error } = await db().from("mtpris_reports").upsert(mtprisToRow(updated), { onConflict: "id" });
  if (error) throw error;
}

/* ---------------- 활동 사진/앨범 ---------------- */

export const PHOTO_BUCKET = "activity-photos";
const ALLOWED_PHOTO_EXT: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
};

const PHOTO_SELECT =
  "id, storagePath:storage_path, activityDate:activity_date, activityName:activity_name, activityType:activity_type, description, isPublicToParent:is_public_to_parent, isPublicToBlog:is_public_to_blog, memo, createdAt:created_at, updatedAt:updated_at";

async function attachStudentIds(photos: Omit<ActivityPhoto, "studentIds">[]): Promise<ActivityPhoto[]> {
  if (photos.length === 0) return [];
  const ids = photos.map((p) => p.id);
  const { data, error } = await db().from("photo_students").select("photoId:photo_id, studentId:student_id").in("photo_id", ids);
  if (error) throw error;
  const map = new Map<string, string[]>();
  for (const row of (data ?? []) as { photoId: string; studentId: string }[]) {
    const list = map.get(row.photoId) ?? [];
    list.push(row.studentId);
    map.set(row.photoId, list);
  }
  return photos.map((p) => ({ ...p, studentIds: map.get(p.id) ?? [] }));
}

/** 특정 아이와 연결된 사진 목록 (activity_date 최신순). onlyPublic이면 공개 사진만 */
export async function getPhotosByChild(childId: string, opts?: { onlyPublic?: boolean }): Promise<ActivityPhoto[]> {
  const { data: links, error: linkError } = await db().from("photo_students").select("photo_id").eq("student_id", childId);
  if (linkError) throw linkError;
  const photoIds = (links ?? []).map((l: { photo_id: string }) => l.photo_id);
  if (photoIds.length === 0) return [];

  let query = db().from("activity_photos").select(PHOTO_SELECT).in("id", photoIds).order("activity_date", { ascending: false });
  if (opts?.onlyPublic) query = query.eq("is_public_to_parent", true);
  const { data, error } = await query;
  if (error) throw error;
  return attachStudentIds((data ?? []) as unknown as Omit<ActivityPhoto, "studentIds">[]);
}

/**
 * 특정 아이 태그와 무관한 사진 목록 (activity_date 최신순).
 * onlyPublic이면 "센터 소식"에 실제 게시된(is_public_to_blog=true) 것만 (학부모 화면용).
 * 옵션 없이 호출하면 전체 사진을 반환 — 관리자 "센터 소식 관리" 화면이 토글을 끈 게시물도
 * 계속 찾아서 다시 켤 수 있도록 전체를 봐야 하기 때문.
 */
export async function getBlogPhotos(opts?: { onlyPublic?: boolean }): Promise<ActivityPhoto[]> {
  let query = db().from("activity_photos").select(PHOTO_SELECT).order("activity_date", { ascending: false });
  if (opts?.onlyPublic) query = query.eq("is_public_to_blog", true);
  const { data, error } = await query;
  if (error) throw error;
  return attachStudentIds((data ?? []) as unknown as Omit<ActivityPhoto, "studentIds">[]);
}

export async function getPhoto(id: string): Promise<ActivityPhoto | null> {
  const { data, error } = await db().from("activity_photos").select(PHOTO_SELECT).eq("id", id).maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const [full] = await attachStudentIds([data as unknown as Omit<ActivityPhoto, "studentIds">]);
  return full;
}

/** 이미 업로드된 활동명 목록(최근순, 중복 제거) — 업로드 폼 자동완성용 */
export async function getActivityNames(): Promise<string[]> {
  const { data, error } = await db()
    .from("activity_photos")
    .select("activity_name")
    .order("created_at", { ascending: false })
    .limit(200);
  if (error) throw error;
  const names = (data ?? []).map((r: { activity_name: string }) => r.activity_name);
  return Array.from(new Set(names));
}

function extFromFilename(filename: string): string {
  const m = /\.([a-zA-Z0-9]+)$/.exec(filename);
  return m ? m[1].toLowerCase() : "";
}

/**
 * 업로드용 서명 URL 발급 — 파일 바이트는 이 서버를 거치지 않고 클라이언트가 Storage에 직접 올림.
 * folderId는 저장 경로 구분용일 뿐 실제 태그와 무관 — 특정 아이 페이지에서 올리면 그 아이 id,
 * 센터 소식 작성 화면처럼 특정 아이 없이 올리면 "blog"를 넘긴다.
 */
export async function createPhotoUploadTarget(
  folderId: string,
  filename: string,
  contentType: string
): Promise<{ path: string; token: string }> {
  const ext = extFromFilename(filename);
  const expectedMime = ALLOWED_PHOTO_EXT[ext];
  if (!expectedMime || expectedMime !== contentType) {
    throw new Error("허용되지 않는 파일 형식입니다. (jpg, jpeg, png, webp만 가능)");
  }
  const path = `${folderId}/${randomBytes(8).toString("hex")}.${ext}`;
  const { data, error } = await db().storage.from(PHOTO_BUCKET).createSignedUploadUrl(path);
  if (error) throw error;
  return { path, token: data.token };
}

export interface ActivityPhotoInput {
  storagePath: string;
  activityDate: string;
  activityName: string;
  activityType: ActivityPhoto["activityType"];
  description?: string;
  isPublicToParent: boolean;
  isPublicToBlog: boolean;
  memo?: string;
  studentIds: string[];
}

export async function createActivityPhoto(input: ActivityPhotoInput): Promise<ActivityPhoto> {
  const id = `photo_${randomBytes(6).toString("hex")}`;
  const now = new Date().toISOString();
  const row = {
    id,
    storage_path: input.storagePath,
    activity_date: input.activityDate,
    activity_name: input.activityName,
    activity_type: input.activityType,
    description: input.description || null,
    is_public_to_parent: input.isPublicToParent,
    is_public_to_blog: input.isPublicToBlog,
    memo: input.memo || null,
    created_at: now,
    updated_at: now,
  };
  const { error } = await db().from("activity_photos").insert(row);
  if (error) throw error;

  if (input.studentIds.length > 0) {
    const links = input.studentIds.map((studentId) => ({ photo_id: id, student_id: studentId }));
    const { error: linkError } = await db().from("photo_students").insert(links);
    if (linkError) throw linkError;
  }

  const photo = await getPhoto(id);
  if (!photo) throw new Error("사진 생성 직후 조회에 실패했습니다.");
  return photo;
}

export async function updateActivityPhoto(
  id: string,
  patch: Partial<Omit<ActivityPhotoInput, "storagePath">>
): Promise<boolean> {
  const row: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (patch.activityDate !== undefined) row.activity_date = patch.activityDate;
  if (patch.activityName !== undefined) row.activity_name = patch.activityName;
  if (patch.activityType !== undefined) row.activity_type = patch.activityType;
  if (patch.description !== undefined) row.description = patch.description || null;
  if (patch.isPublicToParent !== undefined) row.is_public_to_parent = patch.isPublicToParent;
  if (patch.isPublicToBlog !== undefined) row.is_public_to_blog = patch.isPublicToBlog;
  if (patch.memo !== undefined) row.memo = patch.memo || null;

  const { data, error } = await db().from("activity_photos").update(row).eq("id", id).select("id");
  if (error) throw error;
  if ((data?.length ?? 0) === 0) return false;

  if (patch.studentIds !== undefined) {
    const { error: delError } = await db().from("photo_students").delete().eq("photo_id", id);
    if (delError) throw delError;
    if (patch.studentIds.length > 0) {
      const links = patch.studentIds.map((studentId) => ({ photo_id: id, student_id: studentId }));
      const { error: insError } = await db().from("photo_students").insert(links);
      if (insError) throw insError;
    }
  }
  return true;
}

/** 사진 삭제 (DB 행 삭제 후 storage_path를 반환 — 호출부가 실제 파일도 지워야 함) */
export async function deleteActivityPhoto(id: string): Promise<string | null> {
  const { data, error } = await db().from("activity_photos").select("storage_path").eq("id", id).maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const { error: delError } = await db().from("activity_photos").delete().eq("id", id);
  if (delError) throw delError;
  return (data as { storage_path: string }).storage_path;
}

/** 조회용 단기 서명 URL (기본 10분) — storage_path는 절대 그대로 클라이언트에 내려주지 않음 */
export async function createSignedPhotoUrl(path: string, expiresIn = 600): Promise<string | null> {
  const { data, error } = await db().storage.from(PHOTO_BUCKET).createSignedUrl(path, expiresIn);
  if (error) throw error;
  return data?.signedUrl ?? null;
}

export async function deletePhotoFile(path: string): Promise<void> {
  const { error } = await db().storage.from(PHOTO_BUCKET).remove([path]);
  if (error) throw error;
}

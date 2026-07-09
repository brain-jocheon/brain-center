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
import type { Child, Report, AccessToken, ActivityPhoto, SiteSettings, Notice, BrainTest, BrainIndicator, AttendanceRecord, MakeupRequest } from "./types";
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
  token: string | null;
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

/**
 * 최근 N분 동안 이 IP에서 실패한 시도 횟수 — "아이 이름 + 비밀번호" 로그인은
 * 고유 링크 없이도 시도할 수 있어 무차별 대입에 더 취약하므로, 이 카운트로
 * 짧게 속도를 늦춥니다(레이트 리밋). ip가 없으면(프록시 헤더 누락 등) 0을 반환
 * — 그 경우 별도로 막을 수 없으므로 상위 로직이 통과시킵니다.
 */
export async function countRecentFailedAttempts(ip: string | null, windowMinutes: number): Promise<number> {
  if (!ip) return 0;
  const since = new Date(Date.now() - windowMinutes * 60_000).toISOString();
  const { count, error } = await db()
    .from("access_logs")
    .select("id", { count: "exact", head: true })
    .eq("ip", ip)
    .eq("success", false)
    .gte("viewed_at", since);
  if (error) throw error;
  return count ?? 0;
}

/** "아이 이름 + 비밀번호" 홈페이지 로그인 후보 — 그 이름을 가진 아이들의 활성 링크 전부 */
export interface ChildLoginCandidate {
  token: string;
  reportId: string;
  reportKind: "temperament" | "mtpris";
  passwordHash: string;
  expiresAt?: string;
  childId: string;
  testDate: string;
}

export async function findActiveAccessEntriesByChildName(name: string): Promise<ChildLoginCandidate[]> {
  const { data: children, error: childError } = await db().from("children").select("id").eq("name", name);
  if (childError) throw childError;
  const childIds = (children ?? []).map((c: { id: string }) => c.id);
  if (childIds.length === 0) return [];
  return findActiveAccessEntriesByChildIds(childIds);
}

/** 같은 보호자 연락처를 쓰는 다른 아이들의 id (형제자매 후보) — 빈 연락처는 그룹핑 기준으로 쓰지 않음 */
export async function getSiblingChildIds(guardianPhone: string | undefined, excludeChildId: string): Promise<string[]> {
  if (!guardianPhone) return [];
  const { data, error } = await db()
    .from("children")
    .select("id")
    .eq("guardian_phone", guardianPhone)
    .neq("id", excludeChildId);
  if (error) throw error;
  return (data ?? []).map((c: { id: string }) => c.id);
}

export async function findActiveAccessEntriesByChildIds(childIds: string[]): Promise<ChildLoginCandidate[]> {
  if (childIds.length === 0) return [];

  const [reportsRes, mtprisRes] = await Promise.all([
    db().from("reports").select("id, childId:child_id, testDate:test_date").in("child_id", childIds),
    db().from("mtpris_reports").select("id, childId:child_id, testDate:test_date").in("child_id", childIds),
  ]);
  if (reportsRes.error) throw reportsRes.error;
  if (mtprisRes.error) throw mtprisRes.error;

  const reportMeta = new Map<string, { childId: string; testDate: string; kind: "temperament" | "mtpris" }>();
  for (const r of (reportsRes.data ?? []) as { id: string; childId: string; testDate: string }[]) {
    reportMeta.set(r.id, { childId: r.childId, testDate: r.testDate, kind: "temperament" });
  }
  for (const r of (mtprisRes.data ?? []) as { id: string; childId: string; testDate: string }[]) {
    reportMeta.set(r.id, { childId: r.childId, testDate: r.testDate, kind: "mtpris" });
  }
  const reportIds = Array.from(reportMeta.keys());
  if (reportIds.length === 0) return [];

  const { data: tokens, error: tokenError } = await db()
    .from("access_tokens")
    .select(ACCESS_SELECT)
    .in("report_id", reportIds)
    .eq("active", true);
  if (tokenError) throw tokenError;

  const candidates: ChildLoginCandidate[] = [];
  for (const t of (tokens ?? []) as unknown as AccessToken[]) {
    const meta = reportMeta.get(t.reportId);
    if (!meta) continue;
    candidates.push({
      token: t.token,
      reportId: t.reportId,
      reportKind: meta.kind,
      passwordHash: t.passwordHash,
      expiresAt: t.expiresAt,
      childId: meta.childId,
      testDate: meta.testDate,
    });
  }
  return candidates;
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

/* ---------------- 홈페이지 관리: 센터소개/위치 + 공지사항 ---------------- */

// site_settings 테이블이 아직 없거나(마이그레이션 전) 행이 비어 있을 때를 위한 기본값 —
// 지금 화면에 있던 문구와 동일하게 맞춰서, 마이그레이션 전에도 홈페이지가 그대로 보이게 함
export const DEFAULT_ABOUT_TEXT =
  "학습심리브레인센터는 아동·청소년의 기질, 정서, 학습, 뇌기능을 종합적으로 이해하고 맞춤형 성장을 지원하는 전문 교육·상담 센터입니다.\n\n검사와 상담, 뉴로피드백 훈련, 정서·자존감 프로그램을 통해 아이의 강점을 발견하고 안정적인 학습과 생활 성장을 돕습니다.";

const SITE_SETTINGS_SELECT = "aboutText:about_text, address, phone, updatedAt:updated_at";

export async function getSiteSettings(): Promise<SiteSettings> {
  const { data, error } = await db().from("site_settings").select(SITE_SETTINGS_SELECT).eq("id", "default").maybeSingle();
  if (error) throw error;
  const row = data as unknown as SiteSettings | null;
  return {
    aboutText: row?.aboutText || DEFAULT_ABOUT_TEXT,
    address: row?.address || undefined,
    phone: row?.phone || undefined,
    updatedAt: row?.updatedAt || "",
  };
}

export async function updateSiteSettings(patch: { aboutText?: string; address?: string; phone?: string }): Promise<void> {
  const row: Record<string, unknown> = { id: "default", updated_at: new Date().toISOString() };
  if (patch.aboutText !== undefined) row.about_text = patch.aboutText || null;
  if (patch.address !== undefined) row.address = patch.address || null;
  if (patch.phone !== undefined) row.phone = patch.phone || null;
  const { error } = await db().from("site_settings").upsert(row, { onConflict: "id" });
  if (error) throw error;
}

const NOTICE_SELECT = "id, title, body, createdAt:created_at, updatedAt:updated_at";

/** 공지사항 목록 (최신순). 공개 홈페이지·관리자 화면 공용 — 별도 비공개 상태 없음 */
export async function getNotices(): Promise<Notice[]> {
  const { data, error } = await db().from("notices").select(NOTICE_SELECT).order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as unknown as Notice[];
}

export async function createNotice(input: { title: string; body: string }): Promise<Notice> {
  const id = `notice_${randomBytes(6).toString("hex")}`;
  const now = new Date().toISOString();
  const row = { id, title: input.title, body: input.body, created_at: now, updated_at: now };
  const { error } = await db().from("notices").insert(row);
  if (error) throw error;
  return { id, title: input.title, body: input.body, createdAt: now, updatedAt: now };
}

export async function updateNotice(id: string, patch: { title?: string; body?: string }): Promise<boolean> {
  const row: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (patch.title !== undefined) row.title = patch.title;
  if (patch.body !== undefined) row.body = patch.body;
  const { data, error } = await db().from("notices").update(row).eq("id", id).select("id");
  if (error) throw error;
  return (data?.length ?? 0) > 0;
}

export async function deleteNotice(id: string): Promise<boolean> {
  const { data, error } = await db().from("notices").delete().eq("id", id).select("id");
  if (error) throw error;
  return (data?.length ?? 0) > 0;
}

/* ---------------- 뇌기능검사 ---------------- */

export const BRAIN_TEST_BUCKET = "brain-test-files";
const ALLOWED_BRAIN_FILE_EXT: Record<string, string> = {
  pdf: "application/pdf",
};

const BRAIN_TEST_SELECT =
  "id, childId:child_id, testDate:test_date, counselor, fileStoragePath:file_storage_path, fileName:file_name, indicators, opinion, isPublicToParent:is_public_to_parent, createdAt:created_at, updatedAt:updated_at";

export async function getBrainTestsByChild(childId: string, opts?: { onlyPublic?: boolean }): Promise<BrainTest[]> {
  let query = db().from("brain_tests").select(BRAIN_TEST_SELECT).eq("child_id", childId).order("test_date", { ascending: false });
  if (opts?.onlyPublic) query = query.eq("is_public_to_parent", true);
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as unknown as BrainTest[];
}

export async function getBrainTest(id: string): Promise<BrainTest | null> {
  const { data, error } = await db().from("brain_tests").select(BRAIN_TEST_SELECT).eq("id", id).maybeSingle();
  if (error) throw error;
  return (data as unknown as BrainTest) ?? null;
}

function extFromBrainFilename(filename: string): string {
  const m = /\.([a-zA-Z0-9]+)$/.exec(filename);
  return m ? m[1].toLowerCase() : "";
}

/** 업로드용 서명 URL 발급 — 파일 바이트는 이 서버를 거치지 않고 클라이언트가 Storage에 직접 올림 */
export async function createBrainFileUploadTarget(
  childId: string,
  filename: string,
  contentType: string
): Promise<{ path: string; token: string }> {
  const ext = extFromBrainFilename(filename);
  const expectedMime = ALLOWED_BRAIN_FILE_EXT[ext];
  if (!expectedMime || expectedMime !== contentType) {
    throw new Error("허용되지 않는 파일 형식입니다. (PDF만 가능)");
  }
  const path = `${childId}/${randomBytes(8).toString("hex")}.${ext}`;
  const { data, error } = await db().storage.from(BRAIN_TEST_BUCKET).createSignedUploadUrl(path);
  if (error) throw error;
  return { path, token: data.token };
}

export interface BrainTestInput {
  childId: string;
  testDate: string;
  counselor: string;
  fileStoragePath?: string;
  fileName?: string;
  indicators: BrainIndicator[];
  opinion?: string;
  isPublicToParent: boolean;
}

export async function createBrainTest(input: BrainTestInput): Promise<BrainTest> {
  const id = `braintest_${randomBytes(6).toString("hex")}`;
  const now = new Date().toISOString();
  const row = {
    id,
    child_id: input.childId,
    test_date: input.testDate,
    counselor: input.counselor,
    file_storage_path: input.fileStoragePath || null,
    file_name: input.fileName || null,
    indicators: input.indicators,
    opinion: input.opinion || null,
    is_public_to_parent: input.isPublicToParent,
    created_at: now,
    updated_at: now,
  };
  const { error } = await db().from("brain_tests").insert(row);
  if (error) throw error;
  const test = await getBrainTest(id);
  if (!test) throw new Error("뇌기능검사 생성 직후 조회에 실패했습니다.");
  return test;
}

export async function updateBrainTest(
  id: string,
  patch: Partial<Omit<BrainTestInput, "childId" | "fileStoragePath" | "fileName">>
): Promise<boolean> {
  const row: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (patch.testDate !== undefined) row.test_date = patch.testDate;
  if (patch.counselor !== undefined) row.counselor = patch.counselor;
  if (patch.indicators !== undefined) row.indicators = patch.indicators;
  if (patch.opinion !== undefined) row.opinion = patch.opinion || null;
  if (patch.isPublicToParent !== undefined) row.is_public_to_parent = patch.isPublicToParent;

  const { data, error } = await db().from("brain_tests").update(row).eq("id", id).select("id");
  if (error) throw error;
  return (data?.length ?? 0) > 0;
}

/** 뇌기능검사 삭제 (DB 행 삭제 후 file_storage_path를 반환 — 호출부가 실제 파일도 지워야 함) */
export async function deleteBrainTest(id: string): Promise<string | null> {
  const { data, error } = await db().from("brain_tests").select("file_storage_path").eq("id", id).maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const { error: delError } = await db().from("brain_tests").delete().eq("id", id);
  if (delError) throw delError;
  return (data as { file_storage_path: string | null }).file_storage_path;
}

export async function createSignedBrainFileUrl(path: string, expiresIn = 600): Promise<string | null> {
  const { data, error } = await db().storage.from(BRAIN_TEST_BUCKET).createSignedUrl(path, expiresIn);
  if (error) throw error;
  return data?.signedUrl ?? null;
}

export async function deleteBrainFile(path: string): Promise<void> {
  const { error } = await db().storage.from(BRAIN_TEST_BUCKET).remove([path]);
  if (error) throw error;
}

/* ---------------- 출결/보강 ---------------- */

const ATTENDANCE_SELECT =
  "id, childId:child_id, classDate:class_date, status, isMakeup:is_makeup, makeupDate:makeup_date, memo, createdAt:created_at, updatedAt:updated_at";

export async function getAttendanceByChild(childId: string): Promise<AttendanceRecord[]> {
  const { data, error } = await db()
    .from("attendance_records")
    .select(ATTENDANCE_SELECT)
    .eq("child_id", childId)
    .order("class_date", { ascending: false });
  if (error) throw error;
  return (data ?? []) as unknown as AttendanceRecord[];
}

export interface AttendanceInput {
  childId: string;
  classDate: string;
  status: "present" | "absent";
  isMakeup?: boolean;
  makeupDate?: string;
  memo?: string;
}

/** 같은 (아이, 날짜)면 덮어씀 — 기록을 다시 저장하면 그날 상태를 바로 수정하는 셈 */
export async function upsertAttendance(input: AttendanceInput): Promise<AttendanceRecord> {
  const now = new Date().toISOString();
  const row = {
    id: `att_${randomBytes(6).toString("hex")}`,
    child_id: input.childId,
    class_date: input.classDate,
    status: input.status,
    is_makeup: !!input.isMakeup,
    makeup_date: input.makeupDate || null,
    memo: input.memo || null,
    updated_at: now,
  };
  const { data, error } = await db()
    .from("attendance_records")
    .upsert(row, { onConflict: "child_id,class_date", ignoreDuplicates: false })
    .select(ATTENDANCE_SELECT)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("출결 기록 저장 직후 조회에 실패했습니다.");
  return data as unknown as AttendanceRecord;
}

export async function deleteAttendance(id: string): Promise<boolean> {
  const { data, error } = await db().from("attendance_records").delete().eq("id", id).select("id");
  if (error) throw error;
  return (data?.length ?? 0) > 0;
}

/* ---------------- 보강 희망일 요청 ---------------- */

const MAKEUP_REQUEST_SELECT =
  "id, childId:child_id, originalClassDate:original_class_date, requestedDate:requested_date, status, parentMemo:parent_memo, adminMemo:admin_memo, createdAt:created_at, reviewedAt:reviewed_at";

export async function createMakeupRequest(input: {
  childId: string;
  originalClassDate?: string;
  requestedDate: string;
  parentMemo?: string;
}): Promise<MakeupRequest> {
  const id = `mkreq_${randomBytes(6).toString("hex")}`;
  const row = {
    id,
    child_id: input.childId,
    original_class_date: input.originalClassDate || null,
    requested_date: input.requestedDate,
    status: "pending" as const,
    parent_memo: input.parentMemo || null,
  };
  const { error } = await db().from("makeup_requests").insert(row);
  if (error) throw error;
  const { data } = await db().from("makeup_requests").select(MAKEUP_REQUEST_SELECT).eq("id", id).maybeSingle();
  return data as unknown as MakeupRequest;
}

/** status 지정 없으면 전체(관리자가 이미 처리한 것도 포함) 반환 */
export async function getMakeupRequests(opts?: { childId?: string; status?: MakeupRequest["status"] }): Promise<MakeupRequest[]> {
  let query = db().from("makeup_requests").select(MAKEUP_REQUEST_SELECT).order("created_at", { ascending: false });
  if (opts?.childId) query = query.eq("child_id", opts.childId);
  if (opts?.status) query = query.eq("status", opts.status);
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as unknown as MakeupRequest[];
}

export async function countPendingMakeupRequests(): Promise<number> {
  const { count, error } = await db()
    .from("makeup_requests")
    .select("id", { count: "exact", head: true })
    .eq("status", "pending");
  if (error) throw error;
  return count ?? 0;
}

/** 승인 시, 원래 결석 기록(attendance_records)의 makeup_date도 함께 맞춰줌 */
export async function reviewMakeupRequest(
  id: string,
  decision: "approved" | "rejected",
  adminMemo?: string
): Promise<MakeupRequest | null> {
  const { data: existing, error: fetchError } = await db()
    .from("makeup_requests")
    .select(MAKEUP_REQUEST_SELECT)
    .eq("id", id)
    .maybeSingle();
  if (fetchError) throw fetchError;
  if (!existing) return null;
  const req = existing as unknown as MakeupRequest;

  const { error } = await db()
    .from("makeup_requests")
    .update({ status: decision, admin_memo: adminMemo || null, reviewed_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;

  if (decision === "approved" && req.originalClassDate) {
    await upsertAttendance({
      childId: req.childId,
      classDate: req.originalClassDate,
      status: "absent",
      makeupDate: req.requestedDate,
    });
  }

  const { data: updated } = await db().from("makeup_requests").select(MAKEUP_REQUEST_SELECT).eq("id", id).maybeSingle();
  return updated as unknown as MakeupRequest;
}

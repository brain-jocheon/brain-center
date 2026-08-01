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
import type { Child, Report, AccessToken, ActivityPhoto, SiteSettings, Notice, BrainTest, BrainIndicator, AttendanceRecord, MakeupRequest, ParentFeedback, AccessLogEntry, ChildVisitSummary, VisitorStats, DashboardSummary, ClassRecord, ChildComment, CommentTemplate, ParentChildComment, MonthlyReport, ParentMonthlyReport, ParentNoticeAdmin, ParentFacingNotice } from "./types";
import type { MtprisRawInput } from "./mtpris/types";
import { parseClassDays } from "./classSchedule";

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

/**
 * 관리자 전용 — 최근 열람 기록에 아이 이름을 붙여서 반환합니다.
 * [주의] access_logs.token/report_id는 FK가 아니라 자유 텍스트라(로그는 영구
 * 보관, access_tokens/reports는 나중에 지워질 수 있음) 여기서 JS로 직접 조인.
 * 토큰이 비활성화·삭제됐거나 실패한 시도(이름+비밀번호 로그인 실패는 token이
 * 애초에 null)는 아이 이름 없이 시간/성공여부만 표시됩니다.
 */
export async function getRecentAccessLogs(limit = 300): Promise<AccessLogEntry[]> {
  const { data, error } = await db()
    .from("access_logs")
    .select("id, token, success, ip, viewedAt:viewed_at")
    .order("viewed_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  const logs = (data ?? []) as unknown as AccessLogEntry[];

  const tokens = Array.from(new Set(logs.filter((l) => l.token).map((l) => l.token as string)));
  if (tokens.length === 0) return logs;

  const { data: accessRows, error: accessError } = await db()
    .from("access_tokens")
    .select("token, reportId:report_id, reportKind:report_kind")
    .in("token", tokens);
  if (accessError) throw accessError;
  const accessMap = new Map(
    ((accessRows ?? []) as unknown as { token: string; reportId: string; reportKind: "temperament" | "mtpris" }[]).map((a) => [a.token, a])
  );

  const temperamentIds = Array.from(new Set(Array.from(accessMap.values()).filter((a) => a.reportKind === "temperament").map((a) => a.reportId)));
  const mtprisIds = Array.from(new Set(Array.from(accessMap.values()).filter((a) => a.reportKind === "mtpris").map((a) => a.reportId)));

  const [tempReports, mtprisReports] = await Promise.all([
    temperamentIds.length
      ? db().from("reports").select("id, childId:child_id").in("id", temperamentIds)
      : Promise.resolve({ data: [] as { id: string; childId: string }[] }),
    mtprisIds.length
      ? db().from("mtpris_reports").select("id, childId:child_id").in("id", mtprisIds)
      : Promise.resolve({ data: [] as { id: string; childId: string }[] }),
  ]);
  const reportChildMap = new Map<string, string>();
  for (const r of (tempReports.data ?? []) as unknown as { id: string; childId: string }[]) reportChildMap.set(r.id, r.childId);
  for (const r of (mtprisReports.data ?? []) as unknown as { id: string; childId: string }[]) reportChildMap.set(r.id, r.childId);

  const childIds = Array.from(new Set(Array.from(reportChildMap.values())));
  const { data: childRows } = childIds.length
    ? await db().from("children").select("id, name, grade").in("id", childIds)
    : { data: [] as { id: string; name: string; grade: string }[] };
  const childMap = new Map(((childRows ?? []) as unknown as { id: string; name: string; grade: string }[]).map((c) => [c.id, c]));

  return logs.map((l) => {
    if (!l.token) return l;
    const access = accessMap.get(l.token);
    const childId = access ? reportChildMap.get(access.reportId) : undefined;
    const child = childId ? childMap.get(childId) : undefined;
    if (!child || !childId) return l;
    return { ...l, childId, childName: child.name, childGrade: child.grade };
  });
}

/** 관리자 전용 — 위 로그를 아이별로 묶어 방문 횟수·마지막 방문 시각 순으로 정리 */
export function summarizeVisitsByChild(logs: AccessLogEntry[]): ChildVisitSummary[] {
  const byChild = new Map<string, ChildVisitSummary>();
  for (const l of logs) {
    if (!l.success || !l.childId || !l.childName) continue;
    const existing = byChild.get(l.childId);
    if (existing) {
      existing.visitCount += 1;
      if (l.viewedAt > existing.lastVisitedAt) existing.lastVisitedAt = l.viewedAt;
    } else {
      byChild.set(l.childId, {
        childId: l.childId,
        childName: l.childName,
        childGrade: l.childGrade ?? "",
        visitCount: 1,
        lastVisitedAt: l.viewedAt,
      });
    }
  }
  return Array.from(byChild.values()).sort((a, b) => (a.lastVisitedAt < b.lastVisitedAt ? 1 : -1));
}

/* ---------------- 일반 방문자 통계 ---------------- */

/** [주의] 실패해도 방문자 경험을 막으면 안 되므로 호출부(API 라우트)에서 감쌀 것 */
export async function recordPageView(path: string, visitorId: string): Promise<void> {
  const { error } = await db().from("page_views").insert({ path, visitor_id: visitorId });
  if (error) throw error;
}

export async function getVisitorStats(): Promise<VisitorStats> {
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const weekStart = new Date(todayStart.getTime() - 6 * 24 * 60 * 60 * 1000);

  const [{ data: todayRows, error: todayError }, { data: weekRows, error: weekError }] = await Promise.all([
    db().from("page_views").select("visitor_id").gte("viewed_at", todayStart.toISOString()),
    db().from("page_views").select("visitor_id").gte("viewed_at", weekStart.toISOString()),
  ]);
  if (todayError) throw todayError;
  if (weekError) throw weekError;

  const todayIds = (todayRows ?? []) as unknown as { visitor_id: string }[];
  const weekIds = (weekRows ?? []) as unknown as { visitor_id: string }[];
  return {
    pageViewsToday: todayIds.length,
    uniqueVisitorsToday: new Set(todayIds.map((r) => r.visitor_id)).size,
    pageViewsWeek: weekIds.length,
    uniqueVisitorsWeek: new Set(weekIds.map((r) => r.visitor_id)).size,
  };
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
  /** 수업기록 빠른등록에서 함께 올린 사진이면 그 수업기록 id (선택) */
  classRecordId?: string;
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
    class_record_id: input.classRecordId || null,
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

/* ---------------- 수업기록 / 아이별 코멘트 / 코멘트 템플릿 ---------------- */

const CLASS_RECORD_SELECT =
  "id, classDate:class_date, activityName:activity_name, activityType:activity_type, comment, counselor, createdAt:created_at, updatedAt:updated_at, deletedAt:deleted_at";

async function attachChildIds(records: Omit<ClassRecord, "childIds">[]): Promise<ClassRecord[]> {
  if (records.length === 0) return [];
  const ids = records.map((r) => r.id);
  const { data, error } = await db()
    .from("class_record_children")
    .select("classRecordId:class_record_id, childId:child_id")
    .in("class_record_id", ids);
  if (error) throw error;
  const map = new Map<string, string[]>();
  for (const row of (data ?? []) as { classRecordId: string; childId: string }[]) {
    const list = map.get(row.classRecordId) ?? [];
    list.push(row.childId);
    map.set(row.classRecordId, list);
  }
  return records.map((r) => ({ ...r, childIds: map.get(r.id) ?? [] }));
}

export interface ClassRecordInput {
  classDate: string;
  activityName: string;
  activityType: ActivityPhoto["activityType"];
  /** 전체 공용 코멘트 — 아이별 오버라이드가 없는 아이는 화면에서 이 문구를 그대로 씀 */
  comment?: string;
  counselor?: string;
  childIds: string[];
  /** 아이마다 하나씩 채워서 넘김(폼에서 모든 참여 아이에 대해 공개여부를 명시적으로 정하기 때문) */
  childComments: Record<string, { comment?: string; isPublicToParent: boolean }>;
}

export async function getClassRecord(id: string): Promise<ClassRecord | null> {
  const { data, error } = await db().from("class_records").select(CLASS_RECORD_SELECT).eq("id", id).maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const [full] = await attachChildIds([data as unknown as Omit<ClassRecord, "childIds">]);
  return full;
}

/** 수업기록 1건 생성 — 참여 아이 목록 + 아이별 코멘트(공개여부 포함)까지 한 번에 저장.
 * 사진은 별도(POST /api/admin/photos)로, 생성된 이 id를 classRecordId로 붙여서 올림. */
export async function createClassRecord(input: ClassRecordInput): Promise<ClassRecord> {
  const id = `class_${randomBytes(6).toString("hex")}`;
  const now = new Date().toISOString();
  const row = {
    id,
    class_date: input.classDate,
    activity_name: input.activityName,
    activity_type: input.activityType,
    comment: input.comment?.trim() || null,
    counselor: input.counselor?.trim() || null,
    created_at: now,
    updated_at: now,
  };
  const { error } = await db().from("class_records").insert(row);
  if (error) throw error;

  if (input.childIds.length > 0) {
    const links = input.childIds.map((childId) => ({ class_record_id: id, child_id: childId }));
    const { error: linkError } = await db().from("class_record_children").insert(links);
    if (linkError) throw linkError;
  }

  const commentRows = input.childIds.map((childId) => {
    const entry = input.childComments[childId] ?? { isPublicToParent: false };
    return {
      id: `ccm_${randomBytes(6).toString("hex")}`,
      class_record_id: id,
      child_id: childId,
      comment: entry.comment?.trim() || null,
      is_public_to_parent: entry.isPublicToParent,
      created_at: now,
      updated_at: now,
    };
  });
  if (commentRows.length > 0) {
    const { error: commentError } = await db().from("child_comments").insert(commentRows);
    if (commentError) throw commentError;
  }

  const record = await getClassRecord(id);
  if (!record) throw new Error("수업기록 생성 직후 조회에 실패했습니다.");
  return record;
}

export async function updateClassRecord(
  id: string,
  patch: { comment?: string; counselor?: string }
): Promise<boolean> {
  const row: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (patch.comment !== undefined) row.comment = patch.comment.trim() || null;
  if (patch.counselor !== undefined) row.counselor = patch.counselor.trim() || null;
  const { data, error } = await db().from("class_records").update(row).eq("id", id).select("id");
  if (error) throw error;
  return (data?.length ?? 0) > 0;
}

/** 관리자 실수 삭제 대비 — 소프트삭제(deleted_at만 세팅, 실제 행은 남김) */
export async function softDeleteClassRecord(id: string): Promise<boolean> {
  const { data, error } = await db()
    .from("class_records")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id)
    .select("id");
  if (error) throw error;
  return (data?.length ?? 0) > 0;
}

export async function updateChildComment(
  id: string,
  patch: Partial<Pick<ChildComment, "comment" | "isPublicToParent">>
): Promise<boolean> {
  const row: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (patch.comment !== undefined) row.comment = patch.comment?.trim() || null;
  if (patch.isPublicToParent !== undefined) row.is_public_to_parent = patch.isPublicToParent;
  const { data, error } = await db().from("child_comments").update(row).eq("id", id).select("id");
  if (error) throw error;
  return (data?.length ?? 0) > 0;
}

/** 관리자 전용 — 아이 상세 "수업 코멘트" 탭용. 이 아이가 참여한 수업기록을 최신순으로,
 * 그 아이의 코멘트(있으면 오버라이드, 없으면 공용 comment를 화면에서 그대로 보여주면 됨)와 함께 반환 */
export async function getChildCommentsByChild(
  childId: string
): Promise<{ classRecord: ClassRecord; childCommentId?: string; comment?: string; isPublicToParent: boolean }[]> {
  const { data: links, error: linkError } = await db()
    .from("class_record_children")
    .select("classRecordId:class_record_id")
    .eq("child_id", childId);
  if (linkError) throw linkError;
  const recordIds = (links ?? []).map((l: { classRecordId: string }) => l.classRecordId);
  if (recordIds.length === 0) return [];

  const { data: records, error: recError } = await db()
    .from("class_records")
    .select(CLASS_RECORD_SELECT)
    .in("id", recordIds)
    .is("deleted_at", null)
    .order("class_date", { ascending: false });
  if (recError) throw recError;
  const withChildIds = await attachChildIds((records ?? []) as unknown as Omit<ClassRecord, "childIds">[]);

  const { data: comments, error: commentError } = await db()
    .from("child_comments")
    .select("id, classRecordId:class_record_id, comment, isPublicToParent:is_public_to_parent")
    .eq("child_id", childId)
    .in("class_record_id", recordIds);
  if (commentError) throw commentError;
  const commentMap = new Map(
    ((comments ?? []) as { id: string; classRecordId: string; comment: string | null; isPublicToParent: boolean }[]).map(
      (c) => [c.classRecordId, c]
    )
  );

  return withChildIds.map((r) => {
    const c = commentMap.get(r.id);
    return {
      classRecord: r,
      childCommentId: c?.id,
      comment: c?.comment ?? undefined,
      isPublicToParent: c?.isPublicToParent ?? false,
    };
  });
}

/** 학부모 화면용 — 이 아이에게 공개로 설정된 코멘트만, 관리자 전용 필드 없이 반환 */
export async function getPublicChildComments(childId: string): Promise<ParentChildComment[]> {
  const { data: comments, error } = await db()
    .from("child_comments")
    .select("classRecordId:class_record_id, comment")
    .eq("child_id", childId)
    .eq("is_public_to_parent", true);
  if (error) throw error;
  const rows = (comments ?? []) as { classRecordId: string; comment: string | null }[];
  if (rows.length === 0) return [];

  const recordIds = rows.map((r) => r.classRecordId);
  const { data: records, error: recError } = await db()
    .from("class_records")
    .select(CLASS_RECORD_SELECT)
    .in("id", recordIds)
    .is("deleted_at", null);
  if (recError) throw recError;
  const recordMap = new Map(((records ?? []) as unknown as Omit<ClassRecord, "childIds">[]).map((r) => [r.id, r]));

  const result = rows
    .map((r) => {
      const record = recordMap.get(r.classRecordId);
      if (!record) return null;
      const text = (r.comment || record.comment || "").trim();
      if (!text) return null;
      const parent: ParentChildComment = {
        classRecordId: record.id,
        classDate: record.classDate,
        activityName: record.activityName,
        activityType: record.activityType,
        comment: text,
      };
      return parent;
    })
    .filter((p): p is ParentChildComment => p !== null);
  result.sort((a, b) => (a.classDate < b.classDate ? 1 : -1));
  return result;
}

const COMMENT_TEMPLATE_SELECT = "id, text, createdAt:created_at";

/** 관리자가 자주 쓰는 문구 모음 (최신순) */
export async function getCommentTemplates(): Promise<CommentTemplate[]> {
  const { data, error } = await db().from("comment_templates").select(COMMENT_TEMPLATE_SELECT).order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as unknown as CommentTemplate[];
}

export async function createCommentTemplate(text: string): Promise<CommentTemplate> {
  const id = `tmpl_${randomBytes(6).toString("hex")}`;
  const row = { id, text, created_at: new Date().toISOString() };
  const { error } = await db().from("comment_templates").insert(row);
  if (error) throw error;
  return row as unknown as CommentTemplate;
}

export async function deleteCommentTemplate(id: string): Promise<void> {
  const { error } = await db().from("comment_templates").delete().eq("id", id);
  if (error) throw error;
}

/* ---------------- 월간 성장 리포트 ---------------- */

const MONTHLY_REPORT_SELECT =
  "id, childId:child_id, month, participation, strengths, improvements, homeGuidance:home_guidance, nextMonthGoals:next_month_goals, counselor, isPublicToParent:is_public_to_parent, createdAt:created_at, updatedAt:updated_at, deletedAt:deleted_at";

export interface MonthlyReportInput {
  childId: string;
  month: string;
  participation?: string;
  strengths?: string;
  improvements?: string;
  homeGuidance?: string;
  nextMonthGoals?: string;
  counselor?: string;
  isPublicToParent: boolean;
}

/** [주의] child_id+month unique 제약이 있어, 이미 그 달 리포트가 있으면 Postgres가
 * code '23505'(unique_violation)로 에러를 던짐 — 호출부(API 라우트)가 그 케이스를
 * "이미 있으니 수정해주세요" 안내로 바꿔서 응답해야 함. */
export async function createMonthlyReport(input: MonthlyReportInput): Promise<MonthlyReport> {
  const id = `mrep_${randomBytes(6).toString("hex")}`;
  const now = new Date().toISOString();
  const row = {
    id,
    child_id: input.childId,
    month: input.month,
    participation: input.participation?.trim() || null,
    strengths: input.strengths?.trim() || null,
    improvements: input.improvements?.trim() || null,
    home_guidance: input.homeGuidance?.trim() || null,
    next_month_goals: input.nextMonthGoals?.trim() || null,
    counselor: input.counselor?.trim() || null,
    is_public_to_parent: input.isPublicToParent,
    created_at: now,
    updated_at: now,
  };
  const { error } = await db().from("monthly_reports").insert(row);
  if (error) throw error;
  const { data, error: fetchError } = await db().from("monthly_reports").select(MONTHLY_REPORT_SELECT).eq("id", id).maybeSingle();
  if (fetchError) throw fetchError;
  return data as unknown as MonthlyReport;
}

export async function updateMonthlyReport(
  id: string,
  patch: Partial<Omit<MonthlyReportInput, "childId" | "month">>
): Promise<boolean> {
  const row: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (patch.participation !== undefined) row.participation = patch.participation?.trim() || null;
  if (patch.strengths !== undefined) row.strengths = patch.strengths?.trim() || null;
  if (patch.improvements !== undefined) row.improvements = patch.improvements?.trim() || null;
  if (patch.homeGuidance !== undefined) row.home_guidance = patch.homeGuidance?.trim() || null;
  if (patch.nextMonthGoals !== undefined) row.next_month_goals = patch.nextMonthGoals?.trim() || null;
  if (patch.counselor !== undefined) row.counselor = patch.counselor?.trim() || null;
  if (patch.isPublicToParent !== undefined) row.is_public_to_parent = patch.isPublicToParent;
  const { data, error } = await db().from("monthly_reports").update(row).eq("id", id).select("id");
  if (error) throw error;
  return (data?.length ?? 0) > 0;
}

/** 관리자 실수 삭제 대비 — 소프트삭제(deleted_at만 세팅, 실제 행은 남김) */
export async function softDeleteMonthlyReport(id: string): Promise<boolean> {
  const { data, error } = await db()
    .from("monthly_reports")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id)
    .select("id");
  if (error) throw error;
  return (data?.length ?? 0) > 0;
}

/** 관리자 전용 — 아이 상세 "월간리포트" 탭용. 최신 월 순(소프트삭제 제외) */
export async function getMonthlyReportsByChild(childId: string): Promise<MonthlyReport[]> {
  const { data, error } = await db()
    .from("monthly_reports")
    .select(MONTHLY_REPORT_SELECT)
    .eq("child_id", childId)
    .is("deleted_at", null)
    .order("month", { ascending: false });
  if (error) throw error;
  return (data ?? []) as unknown as MonthlyReport[];
}

/** 학부모 화면용 — 공개로 설정된 월간 리포트만, 관리자 전용 필드 없이 반환 */
export async function getPublicMonthlyReports(childId: string): Promise<ParentMonthlyReport[]> {
  const { data, error } = await db()
    .from("monthly_reports")
    .select(MONTHLY_REPORT_SELECT)
    .eq("child_id", childId)
    .eq("is_public_to_parent", true)
    .is("deleted_at", null)
    .order("month", { ascending: false });
  if (error) throw error;
  return ((data ?? []) as unknown as MonthlyReport[]).map((r) => ({
    month: r.month,
    participation: r.participation,
    strengths: r.strengths,
    improvements: r.improvements,
    homeGuidance: r.homeGuidance,
    nextMonthGoals: r.nextMonthGoals,
  }));
}

/* ---------------- 학부모 전용 공지 (대상분리 + 읽음여부) ---------------- */
// [주의] 아래 "홈페이지 관리: 공지사항"(notices)과 완전히 별개입니다.
// notices는 로그인 없이 보이는 공개 홈페이지 공지, parent_notices는 학부모
// 로그인 후에만 보이고 대상별로 필터링되는 공지입니다.

const PARENT_NOTICE_SELECT =
  "id, title, body, audienceType:audience_type, audienceValue:audience_value, createdAt:created_at, updatedAt:updated_at, deletedAt:deleted_at";

/** 이 공지가 이 아이(보호자)에게 노출되어야 하는지 — 순수 함수, DB 조회 없음.
 * 학부모 화면 필터링과 읽음 기록 API 양쪽에서 재사용됩니다. */
export function matchesNoticeAudience(
  notice: Pick<ParentNoticeAdmin, "audienceType" | "audienceValue">,
  child: Pick<Child, "id" | "status" | "serviceType" | "classDay">
): boolean {
  switch (notice.audienceType) {
    case "all":
      return true;
    case "status":
      return notice.audienceValue === child.status;
    case "program":
      return !!child.serviceType && notice.audienceValue === child.serviceType;
    case "weekday":
      return notice.audienceValue !== undefined && parseClassDays(child.classDay).includes(Number(notice.audienceValue));
    case "child":
      return notice.audienceValue === child.id;
    default:
      return false;
  }
}

export interface ParentNoticeInput {
  title: string;
  body: string;
  audienceType: ParentNoticeAdmin["audienceType"];
  audienceValue?: string;
}

export async function createParentNotice(input: ParentNoticeInput): Promise<ParentNoticeAdmin> {
  const id = `pnotice_${randomBytes(6).toString("hex")}`;
  const now = new Date().toISOString();
  const row = {
    id,
    title: input.title,
    body: input.body,
    audience_type: input.audienceType,
    audience_value: input.audienceValue || null,
    created_at: now,
    updated_at: now,
  };
  const { error } = await db().from("parent_notices").insert(row);
  if (error) throw error;
  return { id, title: input.title, body: input.body, audienceType: input.audienceType, audienceValue: input.audienceValue, createdAt: now, updatedAt: now };
}

export async function updateParentNotice(id: string, patch: Partial<ParentNoticeInput>): Promise<boolean> {
  const row: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (patch.title !== undefined) row.title = patch.title;
  if (patch.body !== undefined) row.body = patch.body;
  if (patch.audienceType !== undefined) row.audience_type = patch.audienceType;
  if (patch.audienceValue !== undefined) row.audience_value = patch.audienceValue || null;
  const { data, error } = await db().from("parent_notices").update(row).eq("id", id).select("id");
  if (error) throw error;
  return (data?.length ?? 0) > 0;
}

/** 관리자 실수 삭제 대비 — 소프트삭제(deleted_at만 세팅, 실제 행은 남김) */
export async function softDeleteParentNotice(id: string): Promise<boolean> {
  const { data, error } = await db()
    .from("parent_notices")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id)
    .select("id");
  if (error) throw error;
  return (data?.length ?? 0) > 0;
}

export async function getParentNotice(id: string): Promise<ParentNoticeAdmin | null> {
  const { data, error } = await db().from("parent_notices").select(PARENT_NOTICE_SELECT).eq("id", id).is("deleted_at", null).maybeSingle();
  if (error) throw error;
  return (data as unknown as ParentNoticeAdmin) ?? null;
}

/** 관리자 전용 — 전체 목록(소프트삭제 제외, 최신순) */
export async function getParentNoticesAdmin(): Promise<ParentNoticeAdmin[]> {
  const { data, error } = await db()
    .from("parent_notices")
    .select(PARENT_NOTICE_SELECT)
    .is("deleted_at", null)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as unknown as ParentNoticeAdmin[];
}

/** 학부모 화면용 — 이 아이에게 매칭되는 공지만, 읽음여부 붙여서 최신순 반환 */
export async function getNoticesForChild(child: Child): Promise<ParentFacingNotice[]> {
  const all = await getParentNoticesAdmin();
  const matched = all.filter((n) => matchesNoticeAudience(n, child));
  if (matched.length === 0) return [];

  const { data: reads, error } = await db()
    .from("parent_notice_reads")
    .select("noticeId:notice_id")
    .eq("child_id", child.id)
    .in(
      "notice_id",
      matched.map((n) => n.id)
    );
  if (error) throw error;
  const readSet = new Set((reads ?? []).map((r: { noticeId: string }) => r.noticeId));

  return matched.map((n) => ({
    id: n.id,
    title: n.title,
    body: n.body,
    createdAt: n.createdAt,
    isRead: readSet.has(n.id),
  }));
}

/** 학부모(무상태) 쪽에서 공지를 처음 펼쳐볼 때 읽음 기록. [보안] 호출부(API 라우트)가
 * matchesNoticeAudience로 이 아이가 실제 대상인지 다시 검증한 뒤에만 호출해야 함
 * (클라이언트가 아무 noticeId나 넣어 읽음 기록을 남기는 것 방지). */
export async function markNoticeRead(noticeId: string, childId: string): Promise<void> {
  const { error } = await db()
    .from("parent_notice_reads")
    .upsert({ notice_id: noticeId, child_id: childId, read_at: new Date().toISOString() }, { onConflict: "notice_id,child_id" });
  if (error) throw error;
}

/* ---------------- 홈페이지 관리: 센터소개/위치 + 공지사항 ---------------- */

// site_settings 테이블이 아직 없거나(마이그레이션 전) 행이 비어 있을 때를 위한 기본값 —
// 지금 화면에 있던 문구와 동일하게 맞춰서, 마이그레이션 전에도 홈페이지가 그대로 보이게 함
export const DEFAULT_ABOUT_TEXT =
  "학습심리브레인센터는 아동·청소년의 기질, 정서, 학습, 뇌기능을 종합적으로 이해하고 맞춤형 성장을 지원하는 전문 교육·상담 센터입니다.\n\n검사와 상담, 뉴로피드백 훈련, 정서·자존감 프로그램을 통해 아이의 강점을 발견하고 안정적인 학습과 생활 성장을 돕습니다.";

const SITE_SETTINGS_SELECT = "aboutText:about_text, address, phone, kakaoUrl:kakao_url, updatedAt:updated_at";

export async function getSiteSettings(): Promise<SiteSettings> {
  const { data, error } = await db().from("site_settings").select(SITE_SETTINGS_SELECT).eq("id", "default").maybeSingle();
  if (error) throw error;
  const row = data as unknown as SiteSettings | null;
  return {
    aboutText: row?.aboutText || DEFAULT_ABOUT_TEXT,
    address: row?.address || undefined,
    phone: row?.phone || undefined,
    kakaoUrl: row?.kakaoUrl || undefined,
    updatedAt: row?.updatedAt || "",
  };
}

export async function updateSiteSettings(patch: { aboutText?: string; address?: string; phone?: string; kakaoUrl?: string }): Promise<void> {
  const row: Record<string, unknown> = { id: "default", updated_at: new Date().toISOString() };
  if (patch.aboutText !== undefined) row.about_text = patch.aboutText || null;
  if (patch.address !== undefined) row.address = patch.address || null;
  if (patch.phone !== undefined) row.phone = patch.phone || null;
  if (patch.kakaoUrl !== undefined) row.kakao_url = patch.kakaoUrl || null;
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

/* ---------------- 학부모 문의/건의사항 ---------------- */

const PARENT_FEEDBACK_SELECT =
  "id, childId:child_id, type, title, content, status, adminReply:admin_reply, createdAt:created_at, reviewedAt:reviewed_at";

export async function createParentFeedback(input: {
  childId: string;
  type: ParentFeedback["type"];
  title: string;
  content: string;
}): Promise<ParentFeedback> {
  const id = `fb_${randomBytes(6).toString("hex")}`;
  const row = {
    id,
    child_id: input.childId,
    type: input.type,
    title: input.title,
    content: input.content,
    status: "pending" as const,
  };
  const { error } = await db().from("parent_feedback").insert(row);
  if (error) throw error;
  const { data } = await db().from("parent_feedback").select(PARENT_FEEDBACK_SELECT).eq("id", id).maybeSingle();
  return data as unknown as ParentFeedback;
}

export async function getParentFeedback(opts?: { childId?: string; status?: ParentFeedback["status"] }): Promise<ParentFeedback[]> {
  let query = db().from("parent_feedback").select(PARENT_FEEDBACK_SELECT).order("created_at", { ascending: false });
  if (opts?.childId) query = query.eq("child_id", opts.childId);
  if (opts?.status) query = query.eq("status", opts.status);
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as unknown as ParentFeedback[];
}

export async function countPendingParentFeedback(): Promise<number> {
  const { count, error } = await db()
    .from("parent_feedback")
    .select("id", { count: "exact", head: true })
    .eq("status", "pending");
  if (error) throw error;
  return count ?? 0;
}

export async function reviewParentFeedback(
  id: string,
  status: ParentFeedback["status"],
  adminReply?: string
): Promise<ParentFeedback | null> {
  const { error } = await db()
    .from("parent_feedback")
    .update({ status, admin_reply: adminReply ?? null, reviewed_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;
  const { data } = await db().from("parent_feedback").select(PARENT_FEEDBACK_SELECT).eq("id", id).maybeSingle();
  return (data as unknown as ParentFeedback) ?? null;
}

/* ---------------- 관리자 대시보드 요약 ---------------- */

/** 전부 기존 테이블 집계 — 새 테이블 없음. 실패해도 관리자 홈이 안 깨지게 호출부에서 감쌀 것 */
export async function getDashboardSummary(): Promise<DashboardSummary> {
  const children = await getChildren();

  const weekAgo = new Date();
  weekAgo.setDate(weekAgo.getDate() - 6);
  weekAgo.setHours(0, 0, 0, 0);

  const todayWeekday = new Date().getDay();

  let recentPhotosCount = 0;
  try {
    const { count, error } = await db()
      .from("activity_photos")
      .select("id", { count: "exact", head: true })
      .gte("created_at", weekAgo.toISOString());
    if (error) throw error;
    recentPhotosCount = count ?? 0;
  } catch {
    // activity_photos 테이블 마이그레이션 전이어도 대시보드 전체가 깨지지 않게 0으로 대체
  }

  return {
    activeCount: children.filter((c) => c.status === "active").length,
    waitingCount: children.filter((c) => c.status === "waiting").length,
    endedCount: children.filter((c) => c.status === "ended").length,
    newThisWeek: children.filter((c) => new Date(c.createdAt) >= weekAgo).length,
    todayClassCount: children.filter((c) => c.status === "active" && parseClassDays(c.classDay).includes(todayWeekday)).length,
    recentPhotosCount,
  };
}

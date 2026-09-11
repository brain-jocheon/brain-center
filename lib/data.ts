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
import { randomBytes, createHash } from "crypto";
import type { Child, Report, AccessToken, ActivityPhoto, SiteSettings, Notice, BrainTest, BrainIndicator, AttendanceRecord, MakeupRequest, ParentFeedback, AccessLogEntry, ChildVisitSummary, VisitorStats, DashboardSummary, ClassRecord, ChildComment, CommentTemplate, ParentChildComment, MonthlyReport, ParentMonthlyReport, ParentNoticeAdmin, ParentFacingNotice, Consultation, Staff, ChildTraits, EegTrainingSession, EegTestTemplate, AuditLog } from "./types";
import type { CurrentActor } from "./auth";
import { hashParentPassword } from "./auth";
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
  "id, classDate:class_date, activityName:activity_name, activityType:activity_type, comment, counselor, lessonGoal:lesson_goal, participation, createdByStaffId:created_by_staff_id, createdAt:created_at, updatedAt:updated_at, deletedAt:deleted_at";

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

/** 10단계 — 아이별 코멘트에 함께 실어보낼 수 있는 확장 필드(전부 선택, 있으면 그대로 저장) */
export interface ChildCommentExtras {
  strengthsNote?: string;
  difficultiesNote?: string;
  teacherMemo?: string;
  aiDraftDetail?: string;
  aiDraftParent?: string;
  aiDraftGuidance?: string;
  aiGeneratedAt?: string;
  aiModel?: string;
  finalSource?: "manual" | "ai_edited";
  /** [15단계] 선생님이 수업 직후 1분 안에 남기는 단계형 관찰(1~5) — 내부 전용 */
  participationLevel?: number;
  concentrationLevel?: number;
  understandingLevel?: number;
  emotionalStateLevel?: number;
  interactionLevel?: number;
  specialNote?: string;
  nextSessionGoal?: string;
  /** [15단계] 학부모 공개용 "초안" — comment/isPublicToParent와 완전히 별개의 저장공간.
   * 여기 값을 채워도 자동 공개되지 않는다(updateChildComment의 parentPublishAction으로
   * 관리자만 승인해야 실제로 노출됨). */
  parentActivitySummary?: string;
  parentPositiveMoment?: string;
  parentObservedChange?: string;
  parentNextGoal?: string;
  parentHomeTip?: string;
}

export interface ClassRecordInput {
  classDate: string;
  activityName: string;
  activityType: ActivityPhoto["activityType"];
  /** 전체 공용 코멘트 — 아이별 오버라이드가 없는 아이는 화면에서 이 문구를 그대로 씀 */
  comment?: string;
  counselor?: string;
  /** 10단계 — 수업목표/참여도(수업 단위 공용, 아이별 아님) */
  lessonGoal?: string;
  participation?: string;
  /** [15단계] 이 기록을 작성한 선생님 계정(actor가 staff일 때만) — 기존 counselor 자유텍스트는 그대로 유지, 병행 */
  createdByStaffId?: string;
  childIds: string[];
  /** 아이마다 하나씩 채워서 넘김(폼에서 모든 참여 아이에 대해 공개여부를 명시적으로 정하기 때문).
   * [15단계/보안] isPublicToParent는 여기서 받아도 생성 시점에는 항상 false로 저장된다 —
   * 학부모 공개는 반드시 관리자가 나중에 명시적으로 승인해야 한다(updateChildComment 참고). */
  childComments: Record<string, { comment?: string; isPublicToParent: boolean } & ChildCommentExtras>;
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
    lesson_goal: input.lessonGoal?.trim() || null,
    participation: input.participation?.trim() || null,
    created_by_staff_id: input.createdByStaffId || null,
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
      // [15단계/보안] entry.isPublicToParent는 무시하고 항상 false로 생성 — 학부모 공개는
      // 반드시 관리자가 나중에 명시적으로 승인해야 한다(자동공개 금지, updateChildComment 참고).
      is_public_to_parent: false,
      strengths_note: entry.strengthsNote?.trim() || null,
      difficulties_note: entry.difficultiesNote?.trim() || null,
      teacher_memo: entry.teacherMemo?.trim() || null,
      ai_draft_detail: entry.aiDraftDetail?.trim() || null,
      ai_draft_parent: entry.aiDraftParent?.trim() || null,
      ai_draft_guidance: entry.aiDraftGuidance?.trim() || null,
      ai_generated_at: entry.aiGeneratedAt || null,
      ai_model: entry.aiModel || null,
      final_source: entry.finalSource || null,
      participation_level: entry.participationLevel ?? null,
      concentration_level: entry.concentrationLevel ?? null,
      understanding_level: entry.understandingLevel ?? null,
      emotional_state_level: entry.emotionalStateLevel ?? null,
      interaction_level: entry.interactionLevel ?? null,
      special_note: entry.specialNote?.trim() || null,
      next_session_goal: entry.nextSessionGoal?.trim() || null,
      parent_activity_summary: entry.parentActivitySummary?.trim() || null,
      parent_positive_moment: entry.parentPositiveMoment?.trim() || null,
      parent_observed_change: entry.parentObservedChange?.trim() || null,
      parent_next_goal: entry.parentNextGoal?.trim() || null,
      parent_home_tip: entry.parentHomeTip?.trim() || null,
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

/** [7단계] 권한검사용 — 이 코멘트가 어느 아이 소속인지만 가볍게 조회 */
export async function getChildCommentOwner(id: string): Promise<string | null> {
  const { data, error } = await db().from("child_comments").select("childId:child_id").eq("id", id).maybeSingle();
  if (error) throw error;
  return (data as { childId: string } | null)?.childId ?? null;
}

type ChildCommentEditableFields = Pick<
  ChildComment,
  | "comment"
  | "participationLevel" | "concentrationLevel" | "understandingLevel" | "emotionalStateLevel" | "interactionLevel"
  | "strengthsNote" | "difficultiesNote" | "teacherMemo" | "specialNote" | "nextSessionGoal"
  | "parentActivitySummary" | "parentPositiveMoment" | "parentObservedChange" | "parentNextGoal" | "parentHomeTip"
>;

/** [15단계/보안] 학부모 공개는 원시 boolean을 직접 받지 않고 이 액션을 통해서만 바뀐다 —
 * "approve"는 isFullAdmin만 호출할 수 있게 API 라우트에서 막는다(여기선 데이터만 다룸). */
export async function updateChildComment(
  id: string,
  patch: Partial<ChildCommentEditableFields> & { parentPublishAction?: "approve" | "revoke"; approverLabel?: string }
): Promise<boolean> {
  const row: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (patch.comment !== undefined) row.comment = patch.comment?.trim() || null;
  if (patch.participationLevel !== undefined) row.participation_level = patch.participationLevel;
  if (patch.concentrationLevel !== undefined) row.concentration_level = patch.concentrationLevel;
  if (patch.understandingLevel !== undefined) row.understanding_level = patch.understandingLevel;
  if (patch.emotionalStateLevel !== undefined) row.emotional_state_level = patch.emotionalStateLevel;
  if (patch.interactionLevel !== undefined) row.interaction_level = patch.interactionLevel;
  if (patch.strengthsNote !== undefined) row.strengths_note = patch.strengthsNote?.trim() || null;
  if (patch.difficultiesNote !== undefined) row.difficulties_note = patch.difficultiesNote?.trim() || null;
  if (patch.teacherMemo !== undefined) row.teacher_memo = patch.teacherMemo?.trim() || null;
  if (patch.specialNote !== undefined) row.special_note = patch.specialNote?.trim() || null;
  if (patch.nextSessionGoal !== undefined) row.next_session_goal = patch.nextSessionGoal?.trim() || null;
  if (patch.parentActivitySummary !== undefined) row.parent_activity_summary = patch.parentActivitySummary?.trim() || null;
  if (patch.parentPositiveMoment !== undefined) row.parent_positive_moment = patch.parentPositiveMoment?.trim() || null;
  if (patch.parentObservedChange !== undefined) row.parent_observed_change = patch.parentObservedChange?.trim() || null;
  if (patch.parentNextGoal !== undefined) row.parent_next_goal = patch.parentNextGoal?.trim() || null;
  if (patch.parentHomeTip !== undefined) row.parent_home_tip = patch.parentHomeTip?.trim() || null;

  if (patch.parentPublishAction === "approve") {
    row.is_public_to_parent = true;
    row.parent_approved_at = new Date().toISOString();
    row.parent_approved_by = patch.approverLabel ?? "관리자";
  } else if (patch.parentPublishAction === "revoke") {
    // [주의] parent_approved_at/by는 "마지막으로 언제 승인했었는지" 이력으로 남기고 지우지 않음
    row.is_public_to_parent = false;
  }

  const { data, error } = await db().from("child_comments").update(row).eq("id", id).select("id");
  if (error) throw error;
  return (data?.length ?? 0) > 0;
}

const CHILD_COMMENT_ADMIN_SELECT =
  "id, classRecordId:class_record_id, comment, isPublicToParent:is_public_to_parent, " +
  "participationLevel:participation_level, concentrationLevel:concentration_level, understandingLevel:understanding_level, " +
  "emotionalStateLevel:emotional_state_level, interactionLevel:interaction_level, " +
  "strengthsNote:strengths_note, difficultiesNote:difficulties_note, teacherMemo:teacher_memo, " +
  "specialNote:special_note, nextSessionGoal:next_session_goal, " +
  "parentActivitySummary:parent_activity_summary, parentPositiveMoment:parent_positive_moment, " +
  "parentObservedChange:parent_observed_change, parentNextGoal:parent_next_goal, parentHomeTip:parent_home_tip, " +
  "parentApprovedAt:parent_approved_at, parentApprovedBy:parent_approved_by";

export type ChildCommentAdminRow = Omit<ChildComment, "childId" | "classRecordId" | "createdAt" | "updatedAt" | "deletedAt"> & {
  classRecordId: string;
};

/** 관리자 전용 — 아이 상세 "수업 코멘트" 탭용. 이 아이가 참여한 수업기록을 최신순으로,
 * 그 아이의 코멘트(있으면 오버라이드, 없으면 공용 comment를 화면에서 그대로 보여주면 됨)와
 * [15단계] 단계형 관찰·내부메모·학부모 공개초안·승인상태까지 전부 함께 반환(조회+수정+승인 화면용) */
export async function getChildCommentsByChild(
  childId: string
): Promise<{ classRecord: ClassRecord; childComment?: ChildCommentAdminRow }[]> {
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
    .select(CHILD_COMMENT_ADMIN_SELECT)
    .eq("child_id", childId)
    .in("class_record_id", recordIds);
  if (commentError) throw commentError;
  const commentMap = new Map(
    ((comments ?? []) as unknown as ChildCommentAdminRow[]).map((c) => [c.classRecordId, c])
  );

  return withChildIds.map((r) => ({ classRecord: r, childComment: commentMap.get(r.id) }));
}

/** [15단계] 학부모 공개초안 5개를 사람이 읽기 좋은 문단으로 합침 — 하나도 없으면 undefined
 * (그러면 호출부가 기존 comment/class_records.comment로 폴백, 옛날 데이터 호환) */
function composeParentDraft(row: {
  parentActivitySummary: string | null;
  parentPositiveMoment: string | null;
  parentObservedChange: string | null;
  parentNextGoal: string | null;
  parentHomeTip: string | null;
}): string | undefined {
  const sections: [string, string | null][] = [
    ["오늘의 활동", row.parentActivitySummary],
    ["아이의 긍정적인 반응", row.parentPositiveMoment],
    ["관찰된 변화", row.parentObservedChange],
    ["다음 목표", row.parentNextGoal],
    ["가정에서 참고할 내용", row.parentHomeTip],
  ];
  const filled = sections.filter(([, v]) => v && v.trim());
  if (filled.length === 0) return undefined;
  return filled.map(([label, v]) => `${label}: ${v!.trim()}`).join("\n\n");
}

/** 학부모 화면용 — 이 아이에게 공개로 설정된(관리자 승인된) 코멘트만, 관리자 전용 필드 없이 반환.
 * [15단계] 학부모 공개초안(parent_*) 5개가 채워져 있으면 그걸 조합해서 보여주고, 없으면(옛날 데이터)
 * 기존 comment/class_records.comment로 그대로 폴백 — is_public_to_parent가 유일한 노출 조건인 건 그대로. */
export async function getPublicChildComments(childId: string): Promise<ParentChildComment[]> {
  const { data: comments, error } = await db()
    .from("child_comments")
    .select(
      "classRecordId:class_record_id, comment, " +
        "parentActivitySummary:parent_activity_summary, parentPositiveMoment:parent_positive_moment, " +
        "parentObservedChange:parent_observed_change, parentNextGoal:parent_next_goal, parentHomeTip:parent_home_tip"
    )
    .eq("child_id", childId)
    .eq("is_public_to_parent", true);
  if (error) throw error;
  const rows = (comments ?? []) as unknown as {
    classRecordId: string;
    comment: string | null;
    parentActivitySummary: string | null;
    parentPositiveMoment: string | null;
    parentObservedChange: string | null;
    parentNextGoal: string | null;
    parentHomeTip: string | null;
  }[];
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
      const text = (composeParentDraft(r) || r.comment || record.comment || "").trim();
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

/* ---------------- 10단계: AI 생성 이력 (ai_generation_logs) ---------------- */

/** 단발성 호출 결과를 한 번에 기록 — pending 상태 없이 결과가 나온 시점에 딱 한 번 insert */
export async function logAiGeneration(input: {
  feature: "class_record" | "eeg_interpretation" | "vision_extraction";
  targetId: string;
  staffId?: string;
  model?: string;
  inputSummaryHash?: string;
  status: "success" | "failed";
  errorMessage?: string;
  tokensUsed?: number;
}): Promise<void> {
  const row = {
    id: `aigen_${randomBytes(6).toString("hex")}`,
    feature: input.feature,
    target_id: input.targetId,
    staff_id: input.staffId || null,
    model: input.model || null,
    prompt_version: "v1",
    input_summary_hash: input.inputSummaryHash || null,
    status: input.status,
    error_message: input.errorMessage || null,
    tokens_used: input.tokensUsed ?? null,
    created_at: new Date().toISOString(),
  };
  const { error } = await db().from("ai_generation_logs").insert(row);
  if (error) throw error;
}

/** [비용/폭주 방지] 이 선생님이 최근 windowMinutes분 동안 AI를 몇 번 호출했는지 */
export async function countRecentAiGenerationsByStaff(staffId: string, windowMinutes: number): Promise<number> {
  const since = new Date(Date.now() - windowMinutes * 60_000).toISOString();
  const { count, error } = await db()
    .from("ai_generation_logs")
    .select("id", { count: "exact", head: true })
    .eq("staff_id", staffId)
    .gte("created_at", since);
  if (error) throw error;
  return count ?? 0;
}

/** 개인정보를 남기지 않고 "이 입력이 대략 무엇이었는지"만 재현 가능하게 남기는 해시 */
export function hashAiInputSummary(parts: (string | undefined)[]): string {
  return createHash("sha256").update(parts.filter(Boolean).join("|")).digest("hex");
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

/** [7단계] 권한검사용 — 이 월간리포트가 어느 아이 소속인지만 가볍게 조회 */
export async function getMonthlyReportOwner(id: string): Promise<string | null> {
  const { data, error } = await db().from("monthly_reports").select("childId:child_id").eq("id", id).maybeSingle();
  if (error) throw error;
  return (data as { childId: string } | null)?.childId ?? null;
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

/* ---------------- 9단계: 아동 특성 (child_traits, 아동당 1행) ---------------- */

const CHILD_TRAITS_SELECT =
  "childId:child_id, temperament, strengths, weaknesses, cautions, learningStyle:learning_style, emotionalBehavior:emotional_behavior, counselingGoal:counseling_goal, teacherMemo:teacher_memo, aiGuidanceNote:ai_guidance_note, aiIncludeFields:ai_include_fields, updatedAt:updated_at, updatedBy:updated_by";

export interface ChildTraitsPatch {
  temperament?: string;
  strengths?: string;
  weaknesses?: string;
  cautions?: string;
  learningStyle?: string;
  emotionalBehavior?: string;
  counselingGoal?: string;
  teacherMemo?: string;
  aiGuidanceNote?: string;
  /** [보안] 이 필드는 API 라우트에서 isFullAdmin(actor)일 때만 patch에 포함시켜야 함 */
  aiIncludeFields?: string[];
}

export async function getChildTraits(childId: string): Promise<ChildTraits | null> {
  const { data, error } = await db().from("child_traits").select(CHILD_TRAITS_SELECT).eq("child_id", childId).maybeSingle();
  if (error) throw error;
  return (data as unknown as ChildTraits) ?? null;
}

/** 아동당 1행 — 없으면 새로 만들고 있으면 보낸 필드만 덮어씀(onConflict: child_id) */
export async function upsertChildTraits(childId: string, patch: ChildTraitsPatch, updatedBy?: string): Promise<ChildTraits> {
  const row: Record<string, unknown> = { child_id: childId, updated_at: new Date().toISOString() };
  if (patch.temperament !== undefined) row.temperament = patch.temperament.trim() || null;
  if (patch.strengths !== undefined) row.strengths = patch.strengths.trim() || null;
  if (patch.weaknesses !== undefined) row.weaknesses = patch.weaknesses.trim() || null;
  if (patch.cautions !== undefined) row.cautions = patch.cautions.trim() || null;
  if (patch.learningStyle !== undefined) row.learning_style = patch.learningStyle.trim() || null;
  if (patch.emotionalBehavior !== undefined) row.emotional_behavior = patch.emotionalBehavior.trim() || null;
  if (patch.counselingGoal !== undefined) row.counseling_goal = patch.counselingGoal.trim() || null;
  if (patch.teacherMemo !== undefined) row.teacher_memo = patch.teacherMemo.trim() || null;
  if (patch.aiGuidanceNote !== undefined) row.ai_guidance_note = patch.aiGuidanceNote.trim() || null;
  if (patch.aiIncludeFields !== undefined) row.ai_include_fields = patch.aiIncludeFields;
  if (updatedBy !== undefined) row.updated_by = updatedBy;
  const { data, error } = await db().from("child_traits").upsert(row, { onConflict: "child_id" }).select(CHILD_TRAITS_SELECT).maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("아동 특성 저장 직후 조회에 실패했습니다.");
  return data as unknown as ChildTraits;
}

/* ---------------- 9단계: 뇌파훈련기록 (eeg_training_sessions, 아동당 다건) ---------------- */

const EEG_SESSION_SELECT =
  "id, childId:child_id, sessionDate:session_date, durationMinutes:duration_minutes, trainingMode:training_mode, trainingStage:training_stage, equipment, keyMetrics:key_metrics, conditionNote:condition_note, engagementNote:engagement_note, observation, specialNote:special_note, staffId:staff_id, parentComment:parent_comment, isPublicToParent:is_public_to_parent, createdAt:created_at, updatedAt:updated_at, deletedAt:deleted_at";

export interface EegSessionInput {
  childId: string;
  sessionDate: string;
  durationMinutes?: number | null;
  trainingMode?: string;
  trainingStage?: string;
  equipment?: string;
  keyMetrics?: Record<string, number | string | null>;
  conditionNote?: string;
  engagementNote?: string;
  observation?: string;
  specialNote?: string;
  staffId?: string;
  parentComment?: string;
  isPublicToParent?: boolean;
}

export async function createEegTrainingSession(input: EegSessionInput): Promise<EegTrainingSession> {
  const id = `eeg_${randomBytes(6).toString("hex")}`;
  const now = new Date().toISOString();
  const row = {
    id,
    child_id: input.childId,
    session_date: input.sessionDate,
    duration_minutes: input.durationMinutes ?? null,
    training_mode: input.trainingMode?.trim() || null,
    training_stage: input.trainingStage?.trim() || null,
    equipment: input.equipment?.trim() || null,
    key_metrics: input.keyMetrics && Object.keys(input.keyMetrics).length > 0 ? input.keyMetrics : null,
    condition_note: input.conditionNote?.trim() || null,
    engagement_note: input.engagementNote?.trim() || null,
    observation: input.observation?.trim() || null,
    special_note: input.specialNote?.trim() || null,
    staff_id: input.staffId || null,
    parent_comment: input.parentComment?.trim() || null,
    is_public_to_parent: !!input.isPublicToParent,
    created_at: now,
    updated_at: now,
  };
  const { error } = await db().from("eeg_training_sessions").insert(row);
  if (error) throw error;
  const { data, error: fetchError } = await db().from("eeg_training_sessions").select(EEG_SESSION_SELECT).eq("id", id).maybeSingle();
  if (fetchError) throw fetchError;
  return data as unknown as EegTrainingSession;
}

export async function updateEegTrainingSession(
  id: string,
  patch: Partial<Omit<EegSessionInput, "childId">>
): Promise<boolean> {
  const row: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (patch.sessionDate !== undefined) row.session_date = patch.sessionDate;
  if (patch.durationMinutes !== undefined) row.duration_minutes = patch.durationMinutes;
  if (patch.trainingMode !== undefined) row.training_mode = patch.trainingMode?.trim() || null;
  if (patch.trainingStage !== undefined) row.training_stage = patch.trainingStage?.trim() || null;
  if (patch.equipment !== undefined) row.equipment = patch.equipment?.trim() || null;
  if (patch.keyMetrics !== undefined) {
    row.key_metrics = patch.keyMetrics && Object.keys(patch.keyMetrics).length > 0 ? patch.keyMetrics : null;
  }
  if (patch.conditionNote !== undefined) row.condition_note = patch.conditionNote?.trim() || null;
  if (patch.engagementNote !== undefined) row.engagement_note = patch.engagementNote?.trim() || null;
  if (patch.observation !== undefined) row.observation = patch.observation?.trim() || null;
  if (patch.specialNote !== undefined) row.special_note = patch.specialNote?.trim() || null;
  if (patch.parentComment !== undefined) row.parent_comment = patch.parentComment?.trim() || null;
  if (patch.isPublicToParent !== undefined) row.is_public_to_parent = patch.isPublicToParent;
  const { data, error } = await db().from("eeg_training_sessions").update(row).eq("id", id).select("id");
  if (error) throw error;
  return (data?.length ?? 0) > 0;
}

/** 관리자 실수 삭제 대비 — 소프트삭제(deleted_at만 세팅, 실제 행은 남김) */
export async function softDeleteEegTrainingSession(id: string): Promise<boolean> {
  const { data, error } = await db()
    .from("eeg_training_sessions")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id)
    .select("id");
  if (error) throw error;
  return (data?.length ?? 0) > 0;
}

/** 관리자/선생님 전용 — 아이 상세 "뇌파훈련기록" 탭용. 최신 세션일 순(소프트삭제 제외) */
export async function getEegTrainingSessionsByChild(childId: string): Promise<EegTrainingSession[]> {
  const { data, error } = await db()
    .from("eeg_training_sessions")
    .select(EEG_SESSION_SELECT)
    .eq("child_id", childId)
    .is("deleted_at", null)
    .order("session_date", { ascending: false });
  if (error) throw error;
  return (data ?? []) as unknown as EegTrainingSession[];
}

/** [권한검사용] 이 훈련기록이 어느 아이 소속인지만 가볍게 조회 */
export async function getEegTrainingSessionOwner(id: string): Promise<string | null> {
  const { data, error } = await db().from("eeg_training_sessions").select("childId:child_id").eq("id", id).maybeSingle();
  if (error) throw error;
  return (data as { childId: string } | null)?.childId ?? null;
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
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  xls: "application/vnd.ms-excel",
  csv: "text/csv",
  // [12단계] 스캔/사진 검사지 — Claude Vision으로 읽음(app/api/admin/brain-tests/[id]/extract)
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
};

const BRAIN_TEST_SELECT =
  "id, childId:child_id, testDate:test_date, counselor, fileStoragePath:file_storage_path, fileName:file_name, indicators, opinion, isPublicToParent:is_public_to_parent, createdAt:created_at, updatedAt:updated_at, " +
  "testType:test_type, testName:test_name, measuringOrg:measuring_org, measuredBy:measured_by, parentSummary:parent_summary, approvedBy:approved_by, approvedAt:approved_at, status, " +
  "rawExtracted:raw_extracted, extractionConfidence:extraction_confidence, teacherConfirmedAt:teacher_confirmed_at, sourceFileHash:source_file_hash, " +
  "aiInterpretation:ai_interpretation, finalInterpretation:final_interpretation";

/** 8단계 — 검사종류 자동완성용(기존 값 중복 제거, 최신순). getActivityNames()와 동일 패턴 */
export async function getBrainTestTypes(): Promise<string[]> {
  const { data, error } = await db()
    .from("brain_tests")
    .select("test_type")
    .not("test_type", "is", null)
    .order("created_at", { ascending: false })
    .limit(200);
  if (error) throw error;
  const types = (data ?? []).map((r: { test_type: string }) => r.test_type);
  return Array.from(new Set(types));
}

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
    throw new Error("허용되지 않는 파일 형식입니다. (PDF, Excel(xlsx/xls), CSV, 이미지(jpg/png/webp)만 가능)");
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
  testType?: string;
  testName?: string;
  measuringOrg?: string;
  measuredBy?: string;
  /** 학부모 공개용 요약 — 있으면 학부모 화면에서 opinion 대신 이걸 보여줌(reportPayload.ts) */
  parentSummary?: string;
  status?: BrainTest["status"];
  /** 11단계 — 파일에서 추출한 원본 데이터(선생님 확인 전). 추출 API만 세팅, 사람이 직접 입력 안 함 */
  rawExtracted?: BrainTest["rawExtracted"];
  extractionConfidence?: string;
  sourceFileHash?: string;
  /** 11단계 — "확인 완료로 저장" 버튼을 누른 시각. 서버가 직접 계산해서 넣음(클라이언트 시각 안 믿음) */
  teacherConfirmedAt?: string;
  /** 13단계 — AI 원본 해석(jsonb, 해석 API만 세팅) / 선생님이 검토해 반영한 최종 종합소견 */
  aiInterpretation?: BrainTest["aiInterpretation"];
  finalInterpretation?: string;
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
    test_type: input.testType?.trim() || null,
    test_name: input.testName?.trim() || null,
    measuring_org: input.measuringOrg?.trim() || null,
    measured_by: input.measuredBy?.trim() || null,
    parent_summary: input.parentSummary?.trim() || null,
    status: input.status || "draft",
    approved_by: input.status === "approved" ? "관리자" : null,
    approved_at: input.status === "approved" ? now : null,
    created_at: now,
    updated_at: now,
  };
  const { error } = await db().from("brain_tests").insert(row);
  if (error) throw error;
  const test = await getBrainTest(id);
  if (!test) throw new Error("뇌기능검사 생성 직후 조회에 실패했습니다.");
  return test;
}

/** [8단계] status를 'approved'로 바꾸는 순간에만 approvedBy/approvedAt을 자동 기록.
 * [보안] status는 내부 진행상황 표시일 뿐 학부모 공개 여부(is_public_to_parent)와는
 * 무관 — 절대 여기서 is_public_to_parent를 함께 바꾸지 않는다(기존 공개 데이터 보호). */
export async function updateBrainTest(
  id: string,
  patch: Partial<Omit<BrainTestInput, "childId" | "fileStoragePath" | "fileName">>,
  approvedByName?: string
): Promise<boolean> {
  const row: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (patch.testDate !== undefined) row.test_date = patch.testDate;
  if (patch.counselor !== undefined) row.counselor = patch.counselor;
  if (patch.indicators !== undefined) row.indicators = patch.indicators;
  if (patch.opinion !== undefined) row.opinion = patch.opinion || null;
  if (patch.isPublicToParent !== undefined) row.is_public_to_parent = patch.isPublicToParent;
  if (patch.testType !== undefined) row.test_type = patch.testType?.trim() || null;
  if (patch.testName !== undefined) row.test_name = patch.testName?.trim() || null;
  if (patch.measuringOrg !== undefined) row.measuring_org = patch.measuringOrg?.trim() || null;
  if (patch.measuredBy !== undefined) row.measured_by = patch.measuredBy?.trim() || null;
  if (patch.parentSummary !== undefined) row.parent_summary = patch.parentSummary?.trim() || null;
  if (patch.rawExtracted !== undefined) row.raw_extracted = patch.rawExtracted;
  if (patch.extractionConfidence !== undefined) row.extraction_confidence = patch.extractionConfidence;
  if (patch.sourceFileHash !== undefined) row.source_file_hash = patch.sourceFileHash;
  if (patch.teacherConfirmedAt !== undefined) row.teacher_confirmed_at = patch.teacherConfirmedAt;
  if (patch.aiInterpretation !== undefined) row.ai_interpretation = patch.aiInterpretation;
  if (patch.finalInterpretation !== undefined) row.final_interpretation = patch.finalInterpretation?.trim() || null;
  if (patch.status !== undefined) {
    row.status = patch.status;
    if (patch.status === "approved") {
      const existing = await getBrainTest(id);
      if (existing && !existing.approvedAt) {
        row.approved_by = approvedByName || "관리자";
        row.approved_at = new Date().toISOString();
      }
    }
  }

  const { data, error } = await db().from("brain_tests").update(row).eq("id", id).select("id");
  if (error) throw error;
  return (data?.length ?? 0) > 0;
}

/** 뇌기능검사 삭제 (DB 행 삭제 후 file_storage_path를 반환 — 호출부가 실제 파일도 지워야 함) */
/**
 * [14단계에서 발견/수정] file_storage_path가 애초에 null인(파일 없이 등록된) 검사가 흔한데,
 * 예전 코드는 반환값 string|null 하나로 "못 찾음"과 "찾아서 지웠는데 파일이 없었음"을 구분하지
 * 못해 — 파일 없는 검사를 지우면 실제로는 삭제되면서도 항상 404("찾을 수 없음")로 잘못
 * 응답하고, 감사로그도 안 남는 버그가 있었음. found로 명확히 구분한다.
 */
export async function deleteBrainTest(id: string): Promise<{ found: boolean; storagePath: string | null }> {
  const { data, error } = await db().from("brain_tests").select("file_storage_path").eq("id", id).maybeSingle();
  if (error) throw error;
  if (!data) return { found: false, storagePath: null };
  const { error: delError } = await db().from("brain_tests").delete().eq("id", id);
  if (delError) throw delError;
  return { found: true, storagePath: (data as { file_storage_path: string | null }).file_storage_path };
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

/** [11단계] 추출을 위해 서버가 파일 바이트를 직접 내려받음 — 이 코드베이스에서 Storage
 * .download() 첫 사용(지금까지는 서명 URL 발급/삭제만 있었음). */
export async function downloadBrainFile(path: string): Promise<Buffer> {
  const { data, error } = await db().storage.from(BRAIN_TEST_BUCKET).download(path);
  if (error) throw error;
  const arrayBuffer = await data.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

/** [11단계] 같은 아이의 다른 검사 중 파일 해시가 같은 게 있으면 그 검사 id를 반환(중복 업로드 경고용) */
export async function findDuplicateBrainTestBySourceHash(
  childId: string,
  hash: string,
  excludeId: string
): Promise<string | null> {
  const { data, error } = await db()
    .from("brain_tests")
    .select("id")
    .eq("child_id", childId)
    .eq("source_file_hash", hash)
    .neq("id", excludeId)
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return (data as { id: string } | null)?.id ?? null;
}

/* ---------------- 13단계: 검사 템플릿 (eeg_test_templates) ---------------- */
// [주의] direction이 'none'이면 기준이 없다는 뜻 — AI 해석·전후비교 화면 모두 이 경우
// 좋다/나쁘다 판정을 하면 안 됨(스키마 자체에 있는 원칙, 코드에서도 항상 지킬 것).

const EEG_TEMPLATE_SELECT =
  "id, testType:test_type, indicatorKey:indicator_key, indicatorLabel:indicator_label, direction, " +
  "normalRangeMin:normal_range_min, normalRangeMax:normal_range_max, aiInstruction:ai_instruction, createdAt:created_at, updatedAt:updated_at";

export interface EegTestTemplateInput {
  testType: string;
  indicatorKey: string;
  indicatorLabel: string;
  direction: EegTestTemplate["direction"];
  normalRangeMin?: number | null;
  normalRangeMax?: number | null;
  aiInstruction?: string;
}

export async function getEegTestTemplates(): Promise<EegTestTemplate[]> {
  const { data, error } = await db().from("eeg_test_templates").select(EEG_TEMPLATE_SELECT).order("test_type").order("indicator_key");
  if (error) throw error;
  return (data ?? []) as unknown as EegTestTemplate[];
}

/** AI 해석·전후비교에서 지표 기준 조회용 — 검사종류 하나에 해당하는 템플릿만 */
export async function getEegTestTemplatesByType(testType: string): Promise<EegTestTemplate[]> {
  const { data, error } = await db().from("eeg_test_templates").select(EEG_TEMPLATE_SELECT).eq("test_type", testType);
  if (error) throw error;
  return (data ?? []) as unknown as EegTestTemplate[];
}

export async function createEegTestTemplate(input: EegTestTemplateInput): Promise<EegTestTemplate> {
  const id = `eegtmpl_${randomBytes(6).toString("hex")}`;
  const now = new Date().toISOString();
  const row = {
    id,
    test_type: input.testType.trim(),
    indicator_key: input.indicatorKey.trim(),
    indicator_label: input.indicatorLabel.trim(),
    direction: input.direction,
    normal_range_min: input.normalRangeMin ?? null,
    normal_range_max: input.normalRangeMax ?? null,
    ai_instruction: input.aiInstruction?.trim() || null,
    created_at: now,
    updated_at: now,
  };
  const { error } = await db().from("eeg_test_templates").insert(row);
  if (error) throw error;
  const { data, error: fetchError } = await db().from("eeg_test_templates").select(EEG_TEMPLATE_SELECT).eq("id", id).maybeSingle();
  if (fetchError) throw fetchError;
  return data as unknown as EegTestTemplate;
}

export async function updateEegTestTemplate(id: string, patch: Partial<Omit<EegTestTemplateInput, "testType" | "indicatorKey">>): Promise<boolean> {
  const row: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (patch.indicatorLabel !== undefined) row.indicator_label = patch.indicatorLabel.trim();
  if (patch.direction !== undefined) row.direction = patch.direction;
  if (patch.normalRangeMin !== undefined) row.normal_range_min = patch.normalRangeMin;
  if (patch.normalRangeMax !== undefined) row.normal_range_max = patch.normalRangeMax;
  if (patch.aiInstruction !== undefined) row.ai_instruction = patch.aiInstruction?.trim() || null;
  const { data, error } = await db().from("eeg_test_templates").update(row).eq("id", id).select("id");
  if (error) throw error;
  return (data?.length ?? 0) > 0;
}

export async function deleteEegTestTemplate(id: string): Promise<boolean> {
  const { data, error } = await db().from("eeg_test_templates").delete().eq("id", id).select("id");
  if (error) throw error;
  return (data?.length ?? 0) > 0;
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

/** [7단계] 권한검사용 — 이 출결기록이 어느 아이 소속인지만 가볍게 조회 */
export async function getAttendanceOwner(id: string): Promise<string | null> {
  const { data, error } = await db().from("attendance_records").select("childId:child_id").eq("id", id).maybeSingle();
  if (error) throw error;
  return (data as { childId: string } | null)?.childId ?? null;
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

/* ---------------- 상담 신청 (신규 방문자, 공개 홈페이지) ---------------- */
// [주의] parent_feedback(재원 중 학부모 전용 문의)과 완전히 별개입니다.

const CONSULTATION_SELECT =
  "id, guardianName:guardian_name, guardianPhone:guardian_phone, childName:child_name, childAgeGrade:child_age_grade, concern, isExistingMember:is_existing_member, desiredProgram:desired_program, desiredDatetime:desired_datetime, referralSource:referral_source, additionalMessage:additional_message, consentAt:consent_at, ip, status, adminMemo:admin_memo, createdAt:created_at, updatedAt:updated_at";

export interface ConsultationInput {
  guardianName: string;
  guardianPhone: string;
  childName: string;
  childAgeGrade?: string;
  concern?: string;
  isExistingMember: boolean;
  desiredProgram?: string;
  desiredDatetime?: string;
  referralSource?: string;
  additionalMessage?: string;
  ip?: string;
}

export async function createConsultation(input: ConsultationInput): Promise<Consultation> {
  const id = `cons_${randomBytes(6).toString("hex")}`;
  const now = new Date().toISOString();
  const row = {
    id,
    guardian_name: input.guardianName,
    guardian_phone: input.guardianPhone,
    child_name: input.childName,
    child_age_grade: input.childAgeGrade || null,
    concern: input.concern || null,
    is_existing_member: input.isExistingMember,
    desired_program: input.desiredProgram || null,
    desired_datetime: input.desiredDatetime || null,
    referral_source: input.referralSource || null,
    additional_message: input.additionalMessage || null,
    consent_at: now,
    ip: input.ip || null,
    status: "new" as const,
    created_at: now,
    updated_at: now,
  };
  const { error } = await db().from("consultations").insert(row);
  if (error) throw error;
  const { data } = await db().from("consultations").select(CONSULTATION_SELECT).eq("id", id).maybeSingle();
  return data as unknown as Consultation;
}

export async function getConsultations(): Promise<Consultation[]> {
  const { data, error } = await db().from("consultations").select(CONSULTATION_SELECT).order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as unknown as Consultation[];
}

export async function countPendingConsultations(): Promise<number> {
  const { count, error } = await db().from("consultations").select("id", { count: "exact", head: true }).eq("status", "new");
  if (error) throw error;
  return count ?? 0;
}

export async function updateConsultation(
  id: string,
  patch: { status?: Consultation["status"]; adminMemo?: string }
): Promise<boolean> {
  const row: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (patch.status !== undefined) row.status = patch.status;
  if (patch.adminMemo !== undefined) row.admin_memo = patch.adminMemo.trim() || null;
  const { data, error } = await db().from("consultations").update(row).eq("id", id).select("id");
  if (error) throw error;
  return (data?.length ?? 0) > 0;
}

/** 스팸/과다제출 방지 — countRecentFailedAttempts와 동일한 형태 */
export async function countRecentConsultationsByIp(ip: string | null, windowMinutes: number): Promise<number> {
  if (!ip) return 0;
  const since = new Date(Date.now() - windowMinutes * 60_000).toISOString();
  const { count, error } = await db()
    .from("consultations")
    .select("id", { count: "exact", head: true })
    .eq("ip", ip)
    .gte("created_at", since);
  if (error) throw error;
  return count ?? 0;
}

/* ---------------- 7단계: 선생님/스태프 계정 (RBAC) ---------------- */

const STAFF_SELECT =
  "id, name, phone, role, active, createdAt:created_at, updatedAt:updated_at, deletedAt:deleted_at";

export interface StaffInput {
  name: string;
  phone?: string;
  password: string;
  role: Staff["role"];
}

export async function createStaff(input: StaffInput): Promise<Staff> {
  const id = `staff_${randomBytes(6).toString("hex")}`;
  const now = new Date().toISOString();
  const passwordHash = await hashParentPassword(input.password); // 순수 bcrypt 래퍼 재사용(이름만 "학부모")
  const row = {
    id,
    name: input.name,
    phone: input.phone || null,
    password_hash: passwordHash,
    role: input.role,
    active: true,
    created_at: now,
    updated_at: now,
  };
  const { error } = await db().from("staff").insert(row);
  if (error) throw error;
  const { data } = await db().from("staff").select(STAFF_SELECT).eq("id", id).maybeSingle();
  return data as unknown as Staff;
}

/** 관리자 전용 — 전체 목록(소프트삭제 제외, 이름순) */
export async function getStaffList(): Promise<Staff[]> {
  const { data, error } = await db().from("staff").select(STAFF_SELECT).is("deleted_at", null).order("name");
  if (error) throw error;
  return (data ?? []) as unknown as Staff[];
}

export async function getStaffById(id: string): Promise<Staff | null> {
  const { data, error } = await db().from("staff").select(STAFF_SELECT).eq("id", id).is("deleted_at", null).maybeSingle();
  if (error) throw error;
  return (data as unknown as Staff) ?? null;
}

/** 로그인용 — phone은 부분 유니크 인덱스라 있으면 항상 1건 이하 */
export async function getStaffByPhone(phone: string): Promise<(Staff & { passwordHash: string }) | null> {
  const { data, error } = await db()
    .from("staff")
    .select(`${STAFF_SELECT}, passwordHash:password_hash`)
    .eq("phone", phone)
    .is("deleted_at", null)
    .maybeSingle();
  if (error) throw error;
  return (data as unknown as (Staff & { passwordHash: string })) ?? null;
}

export async function setStaffActive(id: string, active: boolean): Promise<boolean> {
  const { data, error } = await db()
    .from("staff")
    .update({ active, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select("id");
  if (error) throw error;
  return (data?.length ?? 0) > 0;
}

/** 관리자가 선생님 계정 비밀번호를 재설정(분실 시 유일한 복구 수단) — 생성과 동일한 해시 방식 재사용 */
export async function setStaffPassword(id: string, newPassword: string): Promise<boolean> {
  const passwordHash = await hashParentPassword(newPassword);
  const { data, error } = await db()
    .from("staff")
    .update({ password_hash: passwordHash, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select("id");
  if (error) throw error;
  return (data?.length ?? 0) > 0;
}

/** 실패한 선생님 로그인 시도 기록 — 스키마 변경 없이 audit_logs.after에 ip를 담아 재사용 */
export async function logFailedStaffLogin(ip: string | null): Promise<void> {
  try {
    await db()
      .from("audit_logs")
      .insert({
        id: `audit_${randomBytes(6).toString("hex")}`,
        action: "staff_login_failed",
        target_table: "staff",
        after: { ip },
      });
  } catch {
    // 기록 실패가 로그인 흐름을 막으면 안 됨
  }
}

/** countRecentFailedAttempts(access_logs 기준)와 동일한 원리, audit_logs 기준 */
export async function countRecentFailedStaffLogins(ip: string | null, windowMinutes: number): Promise<number> {
  if (!ip) return 0;
  const since = new Date(Date.now() - windowMinutes * 60_000).toISOString();
  const { data, error } = await db()
    .from("audit_logs")
    .select("after")
    .eq("action", "staff_login_failed")
    .gte("created_at", since);
  if (error) throw error;
  return (data ?? []).filter((r: { after: { ip?: string } | null }) => r.after?.ip === ip).length;
}

/* ---------------- 14단계: 감사로그(범용) + 관리자 로그인 레이트리밋 ---------------- */

/** 범용 감사로그 기록 — logFailedStaffLogin과 동일하게 실패를 삼켜 실제 작업을 막지 않음 */
export async function writeAuditLog(input: {
  actorStaffId?: string;
  actorLabel: string;
  action: string;
  targetTable: string;
  targetId?: string;
  before?: Record<string, unknown>;
  after?: Record<string, unknown>;
}): Promise<void> {
  try {
    await db()
      .from("audit_logs")
      .insert({
        id: `audit_${randomBytes(6).toString("hex")}`,
        actor_staff_id: input.actorStaffId ?? null,
        actor_label: input.actorLabel,
        action: input.action,
        target_table: input.targetTable,
        target_id: input.targetId ?? null,
        before: input.before ?? null,
        after: input.after ?? null,
      });
  } catch {
    // 감사로그 기록 실패가 실제 작업을 막으면 안 됨
  }
}

/** 실패한 관리자(공용계정) 로그인 시도 기록 — logFailedStaffLogin과 동일한 형태 */
export async function logFailedAdminLogin(ip: string | null): Promise<void> {
  await writeAuditLog({ actorLabel: "관리자(공용계정)", action: "admin_login_failed", targetTable: "staff", after: { ip } });
}

/** countRecentFailedStaffLogins와 동일한 원리, admin_login_failed 기준 */
export async function countRecentFailedAdminLogins(ip: string | null, windowMinutes: number): Promise<number> {
  if (!ip) return 0;
  const since = new Date(Date.now() - windowMinutes * 60_000).toISOString();
  const { data, error } = await db()
    .from("audit_logs")
    .select("after")
    .eq("action", "admin_login_failed")
    .gte("created_at", since);
  if (error) throw error;
  return (data ?? []).filter((r: { after: { ip?: string } | null }) => r.after?.ip === ip).length;
}

const AUDIT_LOG_SELECT =
  "id, actorStaffId:actor_staff_id, actorLabel:actor_label, action, targetTable:target_table, targetId:target_id, before, after, createdAt:created_at";

/** 감사로그 화면용 — 최신순, 선택적으로 action/targetTable 필터 + offset 페이지네이션 */
export async function getAuditLogs(opts?: {
  limit?: number;
  offset?: number;
  action?: string;
  targetTable?: string;
}): Promise<AuditLog[]> {
  const limit = opts?.limit ?? 50;
  const offset = opts?.offset ?? 0;
  let query = db().from("audit_logs").select(AUDIT_LOG_SELECT).order("created_at", { ascending: false });
  if (opts?.action) query = query.eq("action", opts.action);
  if (opts?.targetTable) query = query.eq("target_table", opts.targetTable);
  const { data, error } = await query.range(offset, offset + limit - 1);
  if (error) throw error;
  return (data ?? []) as unknown as AuditLog[];
}

/* ---- 담당 아동 배정 ---- */

export async function assignChildToStaff(childId: string, staffId: string): Promise<void> {
  const { error } = await db()
    .from("child_staff_assignments")
    .upsert({ child_id: childId, staff_id: staffId }, { onConflict: "child_id,staff_id" });
  if (error) throw error;
}

export async function unassignChildFromStaff(childId: string, staffId: string): Promise<void> {
  const { error } = await db().from("child_staff_assignments").delete().eq("child_id", childId).eq("staff_id", staffId);
  if (error) throw error;
}

export async function getAssignedChildIds(staffId: string): Promise<string[]> {
  const { data, error } = await db().from("child_staff_assignments").select("childId:child_id").eq("staff_id", staffId);
  if (error) throw error;
  return (data ?? []).map((r: { childId: string }) => r.childId);
}

export async function getAssignedStaffIds(childId: string): Promise<string[]> {
  const { data, error } = await db().from("child_staff_assignments").select("staffId:staff_id").eq("child_id", childId);
  if (error) throw error;
  return (data ?? []).map((r: { staffId: string }) => r.staffId);
}

export async function isChildAssignedToStaff(staffId: string, childId: string): Promise<boolean> {
  const { data, error } = await db()
    .from("child_staff_assignments")
    .select("child_id")
    .eq("staff_id", staffId)
    .eq("child_id", childId)
    .maybeSingle();
  if (error) throw error;
  return !!data;
}

/** 이 API/페이지 전반에서 쓰는 단일 권한 판단 지점 — 전체관리자는 항상 true,
 * 선생님은 담당 아동일 때만 true. [보안] 이 함수를 거치지 않고 childId 기반
 * 데이터를 다루는 API가 없어야 함(아래 각 라우트에서 재사용). */
export async function actorCanAccessChild(actor: CurrentActor, childId: string): Promise<boolean> {
  if (actor.kind === "legacy_admin" || actor.role === "admin") return true;
  return isChildAssignedToStaff(actor.staffId, childId);
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

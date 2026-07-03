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
import type { Child, Report, AccessToken } from "./types";
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

const CHILD_SELECT = "id, name, grade, birthYear:birth_year, createdAt:created_at, status";

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

export async function createChild(input: { name: string; grade: string; birthYear?: number }): Promise<Child> {
  const row = {
    id: `child_${randomBytes(4).toString("hex")}`,
    name: input.name,
    grade: input.grade,
    birth_year: input.birthYear ?? null,
    created_at: new Date().toISOString().slice(0, 10),
    status: "active" as const,
  };
  const { error } = await db().from("children").insert(row);
  if (error) throw error;
  return { id: row.id, name: row.name, grade: row.grade, birthYear: input.birthYear, createdAt: row.created_at, status: row.status };
}

/** 그만둔 아이로 표시 (삭제 아님 — 목록에서 분리되어 보일 뿐 데이터는 그대로 유지) */
export async function setChildStatus(id: string, status: "active" | "archived"): Promise<boolean> {
  const { data, error } = await db().from("children").update({ status }).eq("id", id).select("id");
  if (error) throw error;
  return (data?.length ?? 0) > 0;
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
  if (found.expiresAt && new Date(found.expiresAt) < new Date()) return null;

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

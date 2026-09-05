/**
 * =====================================================================
 * 인증 · 보안 유틸리티
 * ---------------------------------------------------------------------
 * [보안 원칙 요약]
 * 1. 비밀번호는 절대 평문으로 저장하지 않는다 (해시만 저장)
 * 2. 이름 마스킹은 반드시 서버에서 처리한다
 *    (화면에서만 가리면 개발자 도구로 실명이 노출됨)
 * 3. 관리자 세션 쿠키는 서명(HMAC)하여 위조를 막는다
 * =====================================================================
 */

import { createHmac, randomBytes, timingSafeEqual } from "crypto";
import { cookies } from "next/headers";
import bcrypt from "bcryptjs";

/** 학부모 비밀번호 → bcrypt 해시 (access_tokens.password_hash에 저장) */
export function hashParentPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, 10);
}

/** 학부모 비밀번호 검증 (bcrypt 자체가 타이밍 공격에 안전하게 비교함) */
export function verifyParentPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

/** 학부모 링크용 무작위 토큰 생성 (URL-safe, 추측 불가능) */
export function generateAccessToken(): string {
  return randomBytes(24).toString("hex");
}

/** 타이밍 공격을 피하는 안전한 문자열 비교 */
export function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

/* ---------------- 이름 마스킹 ---------------- */

/**
 * "김서준" → "김OO"
 * [보안] 이 함수는 반드시 서버 코드(API, 서버 컴포넌트)에서만 호출합니다.
 */
export function maskName(name: string): string {
  if (!name) return "OO";
  // 첫 글자만 남기고 나머지를 O로 대체 (예: "김서준" → "김OO", "이수" → "이O")
  return name[0] + "O".repeat(Math.max(name.length - 1, 1));
}

/* ---------------- 관리자 세션 ---------------- */

const SESSION_COOKIE = "bc_admin_session";

/**
 * [보안 수정] 예전엔 SESSION_SECRET이 없으면 코드에 박힌 문자열("dev-only-insecure-secret")로
 * 조용히 대체했음 — 그 문자열이 공개 저장소에 그대로 있어서, 운영 환경변수가 실수로
 * 빠지면 누구나 그 값으로 관리자 세션 쿠키를 위조할 수 있었음(ADMIN_PASSWORD는 이미
 * 없으면 로그인 자체를 막는데 이쪽만 예외였음). 발급(create)은 아예 실패시키고,
 * 검증(verify)은 예외를 던지는 대신 "무조건 무효"로 처리해 화면이 죽지 않고
 * 로그인 화면으로 안전하게 돌아가게 한다.
 */
function getSecretOrNull(): string | null {
  return process.env.SESSION_SECRET || null;
}

function requireSecret(): string {
  const secret = getSecretOrNull();
  if (!secret) throw new Error("SESSION_SECRET이 설정되지 않았습니다. .env.local(또는 배포 환경변수)을 확인하세요.");
  return secret;
}

/** 세션 값 서명: "만료시각.서명" 형태 */
export function createSessionToken(): string {
  const expires = Date.now() + 1000 * 60 * 60 * 8; // 8시간
  const payload = String(expires);
  const sig = createHmac("sha256", requireSecret()).update(payload).digest("hex");
  return `${payload}.${sig}`;
}

export function verifySessionToken(token: string | undefined): boolean {
  const secret = getSecretOrNull();
  if (!token || !secret) return false;
  const [payload, sig] = token.split(".");
  if (!payload || !sig) return false;
  const expected = createHmac("sha256", secret).update(payload).digest("hex");
  if (!safeEqual(sig, expected)) return false;
  return Number(payload) > Date.now(); // 만료 확인
}

/** 서버 컴포넌트/라우트에서 현재 관리자 로그인 여부 확인 */
export function isAdminLoggedIn(): boolean {
  const token = cookies().get(SESSION_COOKIE)?.value;
  return verifySessionToken(token);
}

export const ADMIN_SESSION_COOKIE = SESSION_COOKIE;

/* ---------------- 7단계: 선생님 계정 세션 (기존 관리자 세션과 완전히 병행) ----------------
 * [보안] 위의 createSessionToken/verifySessionToken/isAdminLoggedIn(관리자 전용,
 * bc_admin_session)은 이 블록에서 전혀 건드리지 않습니다 — 기존 관리자 로그인은
 * 그대로 동작합니다. 선생님/스태프 로그인은 별도 쿠키(bc_staff_session)로 병행 추가.
 */

export const STAFF_SESSION_COOKIE = "bc_staff_session";
export type StaffRole = "admin" | "teacher";

/** payload: "만료시각:staffId:role" — staffId는 randomBytes 기반이라 ':' 문자를 포함하지 않음 */
export function createStaffSessionToken(staffId: string, role: StaffRole): string {
  const expires = Date.now() + 1000 * 60 * 60 * 8; // 8시간 — 관리자 세션과 동일
  const payload = `${expires}:${staffId}:${role}`;
  const sig = createHmac("sha256", requireSecret()).update(payload).digest("hex");
  return `${payload}.${sig}`;
}

export function verifyStaffSessionToken(token: string | undefined): { staffId: string; role: StaffRole } | null {
  const secret = getSecretOrNull();
  if (!token || !secret) return null;
  const [payload, sig] = token.split(".");
  if (!payload || !sig) return null;
  const expected = createHmac("sha256", secret).update(payload).digest("hex");
  if (!safeEqual(sig, expected)) return null;
  const [expiresStr, staffId, role] = payload.split(":");
  if (!expiresStr || !staffId || !role) return null;
  if (Number(expiresStr) <= Date.now()) return null;
  if (role !== "admin" && role !== "teacher") return null;
  return { staffId, role };
}

/** 현재 요청의 접근 주체 — 기존 관리자 로그인이면 legacy_admin(전체 권한, 기존과 동일),
 * 아니면 선생님/스태프 세션을 확인. 이후 모든 페이지·API의 권한 판단 기준점. */
export type CurrentActor = { kind: "legacy_admin" } | { kind: "staff"; staffId: string; role: StaffRole };

export function getCurrentActor(): CurrentActor | null {
  if (isAdminLoggedIn()) return { kind: "legacy_admin" };
  const staff = verifyStaffSessionToken(cookies().get(STAFF_SESSION_COOKIE)?.value);
  if (staff) return { kind: "staff", staffId: staff.staffId, role: staff.role };
  return null;
}

/** legacy_admin이거나 staff.role==='admin'이면 전체 관리자 권한 */
export function isFullAdmin(actor: CurrentActor | null): boolean {
  if (!actor) return false;
  return actor.kind === "legacy_admin" || actor.role === "admin";
}

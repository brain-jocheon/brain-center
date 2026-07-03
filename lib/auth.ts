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

function getSecret(): string {
  const secret = process.env.SESSION_SECRET;
  if (!secret) {
    // [보안 경고] SESSION_SECRET 미설정 상태로 운영 배포 금지
    console.warn("[보안 경고] SESSION_SECRET이 설정되지 않았습니다. .env.local을 확인하세요.");
    return "dev-only-insecure-secret";
  }
  return secret;
}

/** 세션 값 서명: "만료시각.서명" 형태 */
export function createSessionToken(): string {
  const expires = Date.now() + 1000 * 60 * 60 * 8; // 8시간
  const payload = String(expires);
  const sig = createHmac("sha256", getSecret()).update(payload).digest("hex");
  return `${payload}.${sig}`;
}

export function verifySessionToken(token: string | undefined): boolean {
  if (!token) return false;
  const [payload, sig] = token.split(".");
  if (!payload || !sig) return false;
  const expected = createHmac("sha256", getSecret()).update(payload).digest("hex");
  if (!safeEqual(sig, expected)) return false;
  return Number(payload) > Date.now(); // 만료 확인
}

/** 서버 컴포넌트/라우트에서 현재 관리자 로그인 여부 확인 */
export function isAdminLoggedIn(): boolean {
  const token = cookies().get(SESSION_COOKIE)?.value;
  return verifySessionToken(token);
}

export const ADMIN_SESSION_COOKIE = SESSION_COOKIE;

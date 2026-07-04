"use client";

/**
 * 브라우저에서 사용하는 Supabase 클라이언트 (이 프로젝트에서 유일하게 클라이언트 측 Supabase 접근).
 * [보안] anon 키는 공개되어도 안전하도록 설계된 키입니다 (RLS가 이 롤에 전부 차단이라 아무 것도
 * 읽고 쓸 수 없음). 사진 업로드 시 이 클라이언트로 직접 Storage에 파일을 올리는데, 실제 업로드
 * 권한은 서버가 발급한 1회용 서명 토큰에서 나오므로 anon 키 자체가 권한을 주는 게 아닙니다.
 * SUPABASE_SERVICE_ROLE_KEY(서버 전용 비밀 키)는 절대 이 파일 근처에도 오면 안 됩니다.
 */
import { createClient } from "@supabase/supabase-js";

let client: ReturnType<typeof createClient> | null = null;

export function supabaseBrowser() {
  if (client) return client;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY 환경변수가 설정되지 않았습니다.");
  }
  client = createClient(url, key, { auth: { persistSession: false } });
  return client;
}

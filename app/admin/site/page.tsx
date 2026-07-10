/**
 * 관리자: 홈페이지 관리 (센터소개/위치/연락처 + 공지사항)
 * 특정 아이와 무관하게, 로그인 없이 보이는 공개 홈페이지(app/page.tsx)의 내용을 편집합니다.
 */
import Link from "next/link";
import { getSiteSettings, getNotices, DEFAULT_ABOUT_TEXT } from "@/lib/data";
import type { SiteSettings, Notice } from "@/lib/types";
import SiteSettingsForm from "@/components/admin/SiteSettingsForm";
import NoticeManager from "@/components/admin/NoticeManager";

export const dynamic = "force-dynamic";

export default async function SiteAdminPage() {
  let settings: SiteSettings = { aboutText: DEFAULT_ABOUT_TEXT, updatedAt: "" };
  let notices: Notice[] = [];
  try {
    settings = await getSiteSettings();
  } catch {
    // kakao_url 등 신규 컬럼 마이그레이션 전 — 기본값으로 대체
  }
  try {
    notices = await getNotices();
  } catch {
    // notices 테이블 마이그레이션 전 — 공지 없음으로 대체
  }

  return (
    <main className="min-h-screen">
      <header className="bg-white border-b border-sage-100 px-6 py-4">
        <Link href="/admin" className="text-sm text-sage-600">‹ 아동 목록</Link>
        <h1 className="text-lg font-bold mt-1">홈페이지 관리</h1>
        <p className="text-sm text-ink/50 mt-1">
          여기서 수정한 내용은 로그인 없이 누구나 보는 공개 홈페이지에 그대로 노출됩니다.
          아이 개인정보나 사진은 넣지 마세요.
        </p>
      </header>

      <div className="max-w-3xl mx-auto px-5 py-8 space-y-6">
        <SiteSettingsForm settings={settings} />
        <NoticeManager notices={notices} />
      </div>
    </main>
  );
}

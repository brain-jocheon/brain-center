/**
 * 관리자: 홈페이지 관리 (센터소개/위치/연락처 + 공지사항)
 * 특정 아이와 무관하게, 로그인 없이 보이는 공개 홈페이지(app/page.tsx)의 내용을 편집합니다.
 */
import Link from "next/link";
import { getSiteSettings, getNotices } from "@/lib/data";
import SiteSettingsForm from "@/components/admin/SiteSettingsForm";
import NoticeManager from "@/components/admin/NoticeManager";

export const dynamic = "force-dynamic";

export default async function SiteAdminPage() {
  const [settings, notices] = await Promise.all([getSiteSettings(), getNotices()]);

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

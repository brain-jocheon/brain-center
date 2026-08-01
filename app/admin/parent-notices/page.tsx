/**
 * 관리자: 학부모 전용 공지 관리 (대상 지정)
 * 로그인 없이 보이는 공개 홈페이지 공지(app/admin/site)와 완전히 별개 — 이 화면에서
 * 작성한 공지는 대상 조건에 맞는 아이의 학부모(토큰+비밀번호 로그인)에게만 보입니다.
 */
import Link from "next/link";
import { getParentNoticesAdmin, getChildren } from "@/lib/data";
import type { ParentNoticeAdmin } from "@/lib/types";
import ParentNoticeManager from "@/components/admin/ParentNoticeManager";

export const dynamic = "force-dynamic";

export default async function ParentNoticesPage() {
  // [주의] parent_notices 테이블 마이그레이션 전이어도 이 페이지가 깨지지 않게 별도 처리
  let notices: ParentNoticeAdmin[] = [];
  try {
    notices = await getParentNoticesAdmin();
  } catch {
    // parent_notices 테이블 마이그레이션 전 — 빈 목록으로 대체
  }

  const allChildren = await getChildren();
  const programOptions = Array.from(new Set(allChildren.map((c) => c.serviceType).filter((v): v is string => !!v)));
  const childOptions = allChildren
    .filter((c) => c.status === "active")
    .map((c) => ({ id: c.id, name: c.name, grade: c.grade }));

  return (
    <main className="min-h-screen">
      <header className="bg-white border-b border-sage-100 px-6 py-4">
        <Link href="/admin" className="text-sm text-sage-600">‹ 아동 목록</Link>
        <h1 className="text-lg font-bold mt-1">학부모 공지 관리</h1>
        <p className="text-sm text-ink/50 mt-1">
          여기서 작성한 공지는 대상 조건에 맞는 아이의 학부모(로그인 후)에게만 보입니다.
        </p>
      </header>

      <div className="max-w-3xl mx-auto px-5 py-8">
        <ParentNoticeManager notices={notices} programOptions={programOptions} children={childOptions} />
      </div>
    </main>
  );
}

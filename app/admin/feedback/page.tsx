/**
 * 관리자: 학부모 문의/건의사항 확인
 */
import Link from "next/link";
import { getParentFeedback, getChildren } from "@/lib/data";
import FeedbackList from "@/components/admin/FeedbackList";
import type { ParentFeedback } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function AdminFeedbackPage() {
  const children = await getChildren();
  const childNames: Record<string, { name: string; grade: string }> = Object.fromEntries(
    children.map((c) => [c.id, { name: c.name, grade: c.grade }])
  );

  // [주의] parent_feedback 테이블 마이그레이션 전이어도 이 페이지가 깨지지 않게 별도 처리
  let feedback: ParentFeedback[] = [];
  try {
    feedback = await getParentFeedback();
  } catch {
    // parent_feedback 테이블 마이그레이션 전 — 빈 목록으로 대체
  }

  return (
    <main className="min-h-screen">
      <header className="bg-white border-b border-sage-100 px-6 py-4">
        <Link href="/admin" className="text-sm text-sage-600">‹ 아동 목록</Link>
        <h1 className="text-lg font-bold mt-1">학부모 문의/건의사항</h1>
        <p className="text-sm text-ink/50 mt-1">
          학부모 마이페이지에서 남긴 문의와 건의사항이에요. 확인 후 필요하면 답변을 남겨주세요.
        </p>
      </header>

      <div className="max-w-3xl mx-auto px-5 py-8">
        <FeedbackList feedback={feedback} childNames={childNames} />
      </div>
    </main>
  );
}

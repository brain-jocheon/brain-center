/**
 * 관리자: 수업기록 빠른등록
 * 여러 아이가 함께 참여한 수업 하나를 날짜/활동/참여 아이/사진(선택)/코멘트와 함께
 * 한 번에 등록합니다. 아이별 코멘트는 QuickClassRecordForm에서 오버라이드 가능.
 */
import Link from "next/link";
import { getChildren, getActivityNames, getCommentTemplates, getAssignedChildIds } from "@/lib/data";
import { getCurrentActor } from "@/lib/auth";
import type { CommentTemplate } from "@/lib/types";
import QuickClassRecordForm from "@/components/admin/QuickClassRecordForm";

export const dynamic = "force-dynamic";

export default async function NewClassRecordPage() {
  const [allChildren, activityNames] = await Promise.all([getChildren(), getActivityNames()]);

  // [7단계] 선생님은 담당 아동만 선택 가능 — 서버가 저장 시점에도 다시 한 번 검사함
  const actor = getCurrentActor();
  let visibleChildren = allChildren;
  if (actor?.kind === "staff" && actor.role === "teacher") {
    const assignedIds = new Set(await getAssignedChildIds(actor.staffId));
    visibleChildren = allChildren.filter((c) => assignedIds.has(c.id));
  }

  const activeChildren = visibleChildren
    .filter((c) => c.status === "active")
    .map((c) => ({ id: c.id, name: c.name, grade: c.grade }));

  // [주의] comment_templates 테이블 마이그레이션 전이어도 이 페이지가 깨지지 않게 별도 처리
  let templates: CommentTemplate[] = [];
  try {
    templates = await getCommentTemplates();
  } catch {
    // comment_templates 테이블 마이그레이션 전 — 빈 목록으로 대체
  }

  return (
    <main className="min-h-screen">
      <header className="bg-white border-b border-sage-100 px-6 py-4">
        <Link href="/admin" className="text-sm text-sage-600">‹ 아동 목록</Link>
        <h1 className="text-lg font-bold mt-1">수업기록 빠른등록</h1>
        <p className="text-sm text-ink/50 mt-1">
          여러 아이가 함께 참여한 수업을 한 번에 기록하고, 코멘트는 아이마다 다르게 남길 수 있습니다.
        </p>
      </header>

      <div className="max-w-3xl mx-auto px-5 py-8">
        <QuickClassRecordForm
          selectableChildren={activeChildren}
          activityNameSuggestions={activityNames}
          initialTemplates={templates}
        />
      </div>
    </main>
  );
}

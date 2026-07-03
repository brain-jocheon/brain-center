"use client";
import Link from "next/link";

/** 인쇄 페이지 상단 도구 막대 — 인쇄물에는 나오지 않음 (.no-print) */
export default function PrintToolbar({ backHref }: { backHref: string }) {
  return (
    <div className="no-print max-w-[210mm] mx-auto mb-4 flex items-center justify-between px-2">
      <Link href={backHref} className="btn-ghost text-sm">‹ 돌아가기</Link>
      <div className="flex items-center gap-3">
        <span className="text-xs text-ink/50">
          인쇄 창에서 &ldquo;PDF로 저장&rdquo;을 선택하면 PDF 파일로 저장됩니다.
        </span>
        <button className="btn-primary text-sm" onClick={() => window.print()}>
          인쇄하기 / PDF 저장
        </button>
      </div>
    </div>
  );
}

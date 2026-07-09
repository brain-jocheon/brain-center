/**
 * 관리자: 아동 상세 (검사 이력 + 학부모 링크 관리)
 * 서술형 기질검사(reports.json)와 MT-PRIS(mtpris-reports.json) 리포트를
 * 검사일 기준으로 함께 나열합니다.
 */
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  getChild, getReportsByChild, getMtprisReportsByChild, getAccessTokens,
  getChildren, getPhotosByChild, getActivityNames, createSignedPhotoUrl,
  getBrainTestsByChild, createSignedBrainFileUrl, getAttendanceByChild,
} from "@/lib/data";
import { CANONICAL_NAMES } from "@/lib/content/mtpris/types";
import AccessLinkPanel from "@/components/admin/AccessLinkPanel";
import ChildInfoPanel from "@/components/admin/ChildInfoPanel";
import PhotoUploadForm from "@/components/admin/PhotoUploadForm";
import PhotoGallery, { type GalleryPhoto } from "@/components/admin/PhotoGallery";
import BrainTestForm from "@/components/admin/BrainTestForm";
import BrainTestList, { type BrainTestWithFileUrl } from "@/components/admin/BrainTestList";
import AttendanceCalendar from "@/components/admin/AttendanceCalendar";
import type { AttendanceRecord } from "@/lib/types";

export const dynamic = "force-dynamic";

type TimelineItem =
  | { kind: "temperament"; id: string; testDate: string; counselor: string; status: string; title: string; editHref: string; printHref: string }
  | { kind: "mtpris"; id: string; testDate: string; counselor: string; status: string; title: string; editHref: string; printHref: string; memoPublic: boolean; hasMemo: boolean };

export default async function ChildDetail({ params }: { params: { id: string } }) {
  const child = await getChild(params.id);
  if (!child) notFound();

  const [reports, mtprisReports, tokens, allChildren, photos, activityNames] = await Promise.all([
    getReportsByChild(child.id),
    getMtprisReportsByChild(child.id),
    getAccessTokens(),
    getChildren(),
    getPhotosByChild(child.id),
    getActivityNames(),
  ]);

  // [주의] brain_tests 테이블이 아직 마이그레이션 전이어도(배포 순서상 코드가 먼저
  // 나갈 수 있음) 이 페이지 전체(검사 이력·링크 관리 등)가 깨지지 않도록 별도 처리.
  let brainTestsWithUrl: BrainTestWithFileUrl[] = [];
  try {
    const brainTests = await getBrainTestsByChild(child.id);
    brainTestsWithUrl = await Promise.all(
      brainTests.map(async (t) => ({
        ...t,
        fileUrl: t.fileStoragePath ? (await createSignedBrainFileUrl(t.fileStoragePath)) ?? undefined : undefined,
      }))
    );
  } catch {
    // brain_tests 테이블 마이그레이션 전 — 빈 목록으로 대체
  }

  // [주의] attendance_records 테이블 마이그레이션 전이어도 이 페이지가 깨지지 않게 별도 처리
  let attendanceRecords: AttendanceRecord[] = [];
  try {
    attendanceRecords = await getAttendanceByChild(child.id);
  } catch {
    // attendance_records 테이블 마이그레이션 전 — 빈 목록으로 대체
  }

  const otherActiveChildren = allChildren
    .filter((c) => c.id !== child.id && c.status === "active")
    .map((c) => ({ id: c.id, name: c.name, grade: c.grade }));
  const childNames: Record<string, string> = Object.fromEntries(allChildren.map((c) => [c.id, c.name]));

  const galleryPhotos: GalleryPhoto[] = (
    await Promise.all(
      photos.map(async (p) => {
        const url = await createSignedPhotoUrl(p.storagePath);
        return url ? { ...p, url } : null;
      })
    )
  ).filter((p): p is GalleryPhoto => p !== null);

  const items: TimelineItem[] = [
    ...reports.map((r) => ({
      kind: "temperament" as const,
      id: r.id,
      testDate: r.testDate,
      counselor: r.counselor,
      status: r.status,
      title: r.testTypeName,
      editHref: `/admin/children/${child.id}/reports/${r.id}/edit`,
      printHref: `/admin/children/${child.id}/reports/${r.id}/print`,
    })),
    ...mtprisReports.map((r) => ({
      kind: "mtpris" as const,
      id: r.id,
      testDate: r.testDate,
      counselor: r.counselor,
      status: r.status,
      title: `다원재능 MT-PRIS (${r.mainType} ${CANONICAL_NAMES[r.mainType]})`,
      editHref: `/admin/children/${child.id}/mtpris/${r.id}/edit`,
      printHref: `/admin/children/${child.id}/mtpris/${r.id}/print`,
      memoPublic: r.memoPublic,
      hasMemo: !!r.memo,
    })),
  ].sort((a, b) => (a.testDate < b.testDate ? 1 : -1));

  return (
    <main className="min-h-screen">
      <header className="bg-white border-b border-sage-100 px-6 py-4">
        <Link href="/admin" className="text-sm text-sage-600">‹ 아동 목록</Link>
        <h1 className="text-lg font-bold mt-1">
          {child.name} <span className="font-normal text-ink/50 text-base">{child.grade}</span>
        </h1>
      </header>

      <div className="max-w-3xl mx-auto px-5 py-8 space-y-5">
        <ChildInfoPanel child={child} />

        {items.length === 0 && (
          <div className="card text-center text-sm text-ink/50 py-10">
            아직 등록된 검사가 없습니다.
            <br />
            Supabase의 reports 또는 mtpris_reports 테이블에 항목을 추가하면 여기 표시됩니다. (README 참고)
          </div>
        )}

        {items.map((r) => {
          const access = tokens.find((t) => t.reportId === r.id && t.active);
          return (
            <section key={`${r.kind}-${r.id}`} className="card">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div>
                  <p className="font-bold flex items-center gap-2">
                    {r.title}
                    {r.kind === "mtpris" && (
                      <span className="text-[10px] bg-sage-100 text-sage-700 rounded-full px-2 py-0.5 font-medium">MT-PRIS</span>
                    )}
                  </p>
                  <p className="text-sm text-ink/60 mt-0.5">
                    검사일 {r.testDate} · 담당 {r.counselor} ·{" "}
                    <span className={r.status === "published" ? "text-sage-600" : "text-apricot-600"}>
                      {r.status === "published" ? "공개됨" : "작성 중"}
                    </span>
                    {r.kind === "mtpris" && r.hasMemo && (
                      <>
                        {" · "}
                        <span className={r.memoPublic ? "text-sage-600" : "text-ink/40"}>
                          메모 {r.memoPublic ? "공개" : "비공개"}
                        </span>
                      </>
                    )}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Link href={r.editHref} className="btn-ghost text-sm">수정</Link>
                  <Link href={r.printHref} className="btn-primary text-sm !py-2.5">인쇄 / PDF</Link>
                </div>
              </div>

              {/* 학부모 링크 */}
              <AccessLinkPanel
                reportId={r.id}
                reportKind={r.kind}
                active={access ? { token: access.token } : null}
                childBirthDate={child.birthDate}
              />
            </section>
          );
        })}

        <section>
          <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
            <p className="section-label">출결 관리</p>
          </div>
          <AttendanceCalendar childId={child.id} records={attendanceRecords} />
        </section>

        <section>
          <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
            <p className="section-label">뇌기능검사</p>
          </div>
          <div className="space-y-4">
            <BrainTestForm childId={child.id} />
            <BrainTestList tests={brainTestsWithUrl} />
          </div>
        </section>

        <section>
          <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
            <p className="section-label">활동 사진 / 앨범</p>
          </div>
          <div className="space-y-4">
            <PhotoUploadForm
              lockedChildId={child.id}
              selectableChildren={otherActiveChildren}
              activityNameSuggestions={activityNames}
            />
            <div className="card">
              <PhotoGallery photos={galleryPhotos} childNames={childNames} />
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}

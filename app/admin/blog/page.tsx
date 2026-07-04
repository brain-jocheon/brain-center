/**
 * 관리자: 센터 소식 관리
 * 특정 아이 상세 화면에 들어가지 않고, 블로그처럼 센터 전체 소식(수업/행사 사진 등)을
 * 작성·관리하는 화면입니다. 여기서 "센터 소식에 게시"로 올린 사진은 로그인(토큰+비밀번호
 * 인증)한 모든 학부모의 화면에 노출됩니다 (특정 아이 태그 여부와 무관).
 */
import Link from "next/link";
import { getBlogPhotos, getChildren, getActivityNames, createSignedPhotoUrl } from "@/lib/data";
import PhotoUploadForm from "@/components/admin/PhotoUploadForm";
import PhotoGallery, { type GalleryPhoto } from "@/components/admin/PhotoGallery";

export const dynamic = "force-dynamic";

export default async function BlogAdminPage() {
  const [photos, allChildren, activityNames] = await Promise.all([
    getBlogPhotos(),
    getChildren(),
    getActivityNames(),
  ]);

  const activeChildren = allChildren
    .filter((c) => c.status === "active")
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

  return (
    <main className="min-h-screen">
      <header className="bg-white border-b border-sage-100 px-6 py-4">
        <Link href="/admin" className="text-sm text-sage-600">‹ 아동 목록</Link>
        <h1 className="text-lg font-bold mt-1">센터 소식 관리</h1>
        <p className="text-sm text-ink/50 mt-1">
          여기서 "센터 소식에 게시"로 올린 사진은 아이 태그와 무관하게 로그인한 모든 학부모에게 보입니다.
        </p>
      </header>

      <div className="max-w-3xl mx-auto px-5 py-8 space-y-5">
        <PhotoUploadForm
          selectableChildren={activeChildren}
          activityNameSuggestions={activityNames}
          showBlogToggle
          defaultIsPublicToBlog
          triggerLabel="+ 새 소식 작성"
        />
        <div className="card">
          <PhotoGallery photos={galleryPhotos} childNames={childNames} />
        </div>
      </div>
    </main>
  );
}

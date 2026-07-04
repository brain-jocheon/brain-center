"use client";

/**
 * 활동 사진 갤러리 — (활동일, 활동명)으로 그룹핑해서 앨범처럼 보여줍니다.
 * 썸네일 URL은 서버 컴포넌트가 미리 서명해서 내려준 값을 그대로 씁니다 (이 컴포넌트는 재서명하지 않음).
 */

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { ActivityPhoto } from "@/lib/types";

const ACTIVITY_TYPE_LABEL: Record<string, string> = {
  class: "수업", craft: "만들기", cooking: "요리", neurofeedback: "뉴로피드백", event: "행사", other: "기타",
};

export type GalleryPhoto = ActivityPhoto & { url: string };

export default function PhotoGallery({
  photos,
  childNames,
}: {
  photos: GalleryPhoto[];
  childNames: Record<string, string>;
}) {
  const groups = groupByActivity(photos);

  if (photos.length === 0) {
    return <p className="text-sm text-ink/50 py-4 text-center">아직 등록된 활동 사진이 없습니다.</p>;
  }

  return (
    <div className="space-y-6">
      {groups.map((g) => (
        <div key={g.key}>
          <p className="text-sm font-semibold mb-2">
            {g.activityDate} · {g.activityName}
            <span className="text-xs text-ink/40 font-normal ml-2">{ACTIVITY_TYPE_LABEL[g.activityType]}</span>
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {g.photos.map((p) => <PhotoCard key={p.id} photo={p} childNames={childNames} />)}
          </div>
        </div>
      ))}
    </div>
  );
}

function groupByActivity(photos: GalleryPhoto[]) {
  const map = new Map<string, GalleryPhoto[]>();
  for (const p of photos) {
    const key = `${p.activityDate}__${p.activityName}`;
    const list = map.get(key) ?? [];
    list.push(p);
    map.set(key, list);
  }
  return Array.from(map.entries())
    .map(([key, list]) => ({
      key,
      activityDate: list[0].activityDate,
      activityName: list[0].activityName,
      activityType: list[0].activityType,
      photos: list,
    }))
    .sort((a, b) => (a.activityDate < b.activityDate ? 1 : -1));
}

function PhotoCard({ photo, childNames }: { photo: GalleryPhoto; childNames: Record<string, string> }) {
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [form, setForm] = useState({
    description: photo.description ?? "",
    isPublicToParent: photo.isPublicToParent,
    memo: photo.memo ?? "",
  });
  const router = useRouter();

  async function handleSave() {
    setSaving(true);
    setMessage("");
    const res = await fetch(`/api/admin/photos/${photo.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    setSaving(false);
    if (res.ok) {
      setEditing(false);
      router.refresh();
    } else {
      setMessage("저장에 실패했습니다.");
    }
  }

  async function handleDelete() {
    if (!confirm("이 사진을 삭제하시겠습니까? 되돌릴 수 없습니다.")) return;
    setSaving(true);
    const res = await fetch(`/api/admin/photos/${photo.id}`, { method: "DELETE" });
    setSaving(false);
    if (res.ok) {
      router.refresh();
    } else {
      setMessage("삭제에 실패했습니다.");
    }
  }

  const taggedNames = photo.studentIds.map((id) => childNames[id]).filter(Boolean).join(", ");

  return (
    <div className="rounded-xl border border-sage-100 overflow-hidden bg-white">
      <img src={photo.url} alt={photo.activityName} className="w-full aspect-square object-cover" />
      <div className="p-2">
        <div className="flex items-center justify-between gap-1">
          <span className={`text-[10px] rounded-full px-2 py-0.5 font-medium ${photo.isPublicToParent ? "bg-sage-100 text-sage-700" : "bg-apricot-50 text-apricot-600"}`}>
            {photo.isPublicToParent ? "공개" : "비공개"}
          </span>
          <div className="flex gap-1">
            <button className="text-xs text-sage-600 underline" onClick={() => setEditing((v) => !v)}>수정</button>
            <button className="text-xs text-apricot-600 underline" disabled={saving} onClick={handleDelete}>삭제</button>
          </div>
        </div>
        {taggedNames && <p className="text-[11px] text-ink/40 mt-1 truncate">{taggedNames}</p>}
        <p className="text-[11px] text-ink/40">등록 {photo.createdAt.slice(0, 10)}</p>

        {editing && (
          <div className="mt-2 space-y-2 border-t border-sage-100 pt-2">
            <textarea
              className="input min-h-14 text-xs"
              placeholder="사진 설명"
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
            />
            <textarea
              className="input min-h-14 text-xs"
              placeholder="관리자 메모"
              value={form.memo}
              onChange={(e) => setForm((f) => ({ ...f, memo: e.target.value }))}
            />
            <label className="flex items-center gap-2 text-xs">
              <input
                type="checkbox"
                checked={form.isPublicToParent}
                onChange={(e) => setForm((f) => ({ ...f, isPublicToParent: e.target.checked }))}
              />
              학부모에게 공개
            </label>
            {message && <p className="text-[11px] text-apricot-600">{message}</p>}
            <button className="btn-primary text-xs !px-3 !py-1.5" disabled={saving} onClick={handleSave}>
              {saving ? "저장 중..." : "저장"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

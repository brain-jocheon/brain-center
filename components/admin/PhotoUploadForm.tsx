"use client";

/**
 * 활동 사진 업로드 폼 — 여러 장을 한 번에, 공통 메타데이터로 업로드합니다.
 * [흐름] 파일마다: (1) 서버에서 서명 업로드 URL 발급 → (2) 브라우저에서 Supabase Storage로 직접 업로드
 * (Vercel 요청 본문 4.5MB 제한을 피하기 위해 파일 바이트는 우리 서버를 거치지 않음) →
 * (3) 서버에 메타데이터만 저장. 파일 하나가 실패해도 나머지는 계속 진행합니다.
 */

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabaseBrowserClient";

const PHOTO_BUCKET = "activity-photos";
const ACTIVITY_TYPE_LABEL: Record<string, string> = {
  class: "수업", craft: "만들기", cooking: "요리", neurofeedback: "뉴로피드백", event: "행사", other: "기타",
};
const ALLOWED_EXT = ["jpg", "jpeg", "png", "webp"];

export default function PhotoUploadForm({
  childId,
  otherChildren,
  activityNameSuggestions,
}: {
  childId: string;
  otherChildren: { id: string; name: string; grade: string }[];
  activityNameSuggestions: string[];
}) {
  const [open, setOpen] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const [activityDate, setActivityDate] = useState("");
  const [activityName, setActivityName] = useState("");
  const [activityType, setActivityType] = useState("class");
  const [description, setDescription] = useState("");
  const [isPublicToParent, setIsPublicToParent] = useState(false);
  const [memo, setMemo] = useState("");
  const [taggedIds, setTaggedIds] = useState<Set<string>>(new Set());
  const [childFilter, setChildFilter] = useState("");
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState<string[]>([]);
  const [message, setMessage] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  const filteredOtherChildren = useMemo(() => {
    const q = childFilter.trim().toLowerCase();
    if (!q) return otherChildren;
    return otherChildren.filter((c) => c.name.toLowerCase().includes(q));
  }, [otherChildren, childFilter]);

  function toggleTag(id: string) {
    setTaggedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function reset() {
    setFiles([]);
    if (fileInputRef.current) fileInputRef.current.value = "";
    setDescription("");
    setMemo("");
    setIsPublicToParent(false);
    setTaggedIds(new Set());
    setChildFilter("");
    setMessage("");
    setProgress([]);
  }

  async function handleUpload() {
    if (files.length === 0 || !activityDate || !activityName.trim()) return;
    setUploading(true);
    setMessage("");
    setProgress([]);

    const studentIds = [childId, ...Array.from(taggedIds)];
    let successCount = 0;

    for (const file of files) {
      const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
      if (!ALLOWED_EXT.includes(ext)) {
        setProgress((p) => [...p, `${file.name}: 허용되지 않는 형식 (jpg/jpeg/png/webp만 가능)`]);
        continue;
      }
      try {
        const urlRes = await fetch("/api/admin/photos/upload-url", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ childId, filename: file.name, contentType: file.type }),
        });
        if (!urlRes.ok) {
          const data = await urlRes.json().catch(() => null);
          setProgress((p) => [...p, `${file.name}: ${data?.message || "업로드 URL 발급 실패"}`]);
          continue;
        }
        const { path, token } = await urlRes.json();

        const { error: uploadError } = await supabaseBrowser()
          .storage.from(PHOTO_BUCKET)
          .uploadToSignedUrl(path, token, file);
        if (uploadError) {
          setProgress((p) => [...p, `${file.name}: 업로드 실패 (${uploadError.message})`]);
          continue;
        }

        const createRes = await fetch("/api/admin/photos", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            storagePath: path,
            activityDate,
            activityName: activityName.trim(),
            activityType,
            description: description.trim() || undefined,
            isPublicToParent,
            memo: memo.trim() || undefined,
            studentIds,
          }),
        });
        if (!createRes.ok) {
          const data = await createRes.json().catch(() => null);
          setProgress((p) => [...p, `${file.name}: ${data?.message || "저장 실패"}`]);
          continue;
        }
        successCount += 1;
        setProgress((p) => [...p, `${file.name}: 완료`]);
      } catch {
        setProgress((p) => [...p, `${file.name}: 네트워크 오류로 실패`]);
      }
    }

    setUploading(false);
    if (successCount > 0) {
      setMessage(`${successCount}장 업로드 완료`);
      router.refresh();
    }
    if (successCount === files.length) {
      setTimeout(() => { reset(); setOpen(false); }, 800);
    }
  }

  if (!open) {
    return (
      <button className="btn-primary text-sm" onClick={() => setOpen(true)}>+ 사진 업로드</button>
    );
  }

  return (
    <div className="card">
      <p className="section-label mb-4">활동 사진 업로드</p>

      <label className="block mb-4">
        <span className="block text-sm font-medium mb-1.5">사진 선택 (여러 장 가능, jpg/jpeg/png/webp)</span>
        <input
          ref={fileInputRef}
          className="input"
          type="file"
          accept="image/jpeg,image/png,image/webp"
          multiple
          onChange={(e) => setFiles(Array.from(e.target.files ?? []))}
        />
        {files.length > 0 && <p className="text-xs text-ink/50 mt-1">{files.length}개 선택됨</p>}
      </label>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <label className="block">
          <span className="block text-sm font-medium mb-1.5">활동일</span>
          <input className="input" type="date" value={activityDate} onChange={(e) => setActivityDate(e.target.value)} />
        </label>
        <label className="block">
          <span className="block text-sm font-medium mb-1.5">활동명</span>
          <input
            className="input"
            list="activity-name-suggestions"
            value={activityName}
            onChange={(e) => setActivityName(e.target.value)}
            placeholder="예: 피자타르트 만들기"
          />
          <datalist id="activity-name-suggestions">
            {activityNameSuggestions.map((n) => <option key={n} value={n} />)}
          </datalist>
        </label>
        <label className="block">
          <span className="block text-sm font-medium mb-1.5">활동 유형</span>
          <select className="input" value={activityType} onChange={(e) => setActivityType(e.target.value)}>
            {Object.entries(ACTIVITY_TYPE_LABEL).map(([v, label]) => (
              <option key={v} value={v}>{label}</option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-2 mt-6 text-sm">
          <input type="checkbox" checked={isPublicToParent} onChange={(e) => setIsPublicToParent(e.target.checked)} />
          학부모에게 공개
        </label>
      </div>

      <label className="block mt-4">
        <span className="block text-sm font-medium mb-1.5">사진 설명 (학부모에게 표시됨)</span>
        <textarea className="input min-h-16" value={description} onChange={(e) => setDescription(e.target.value)} />
      </label>
      <label className="block mt-4">
        <span className="block text-sm font-medium mb-1.5">관리자 메모 (학부모에게 표시 안 됨)</span>
        <textarea className="input min-h-16" value={memo} onChange={(e) => setMemo(e.target.value)} />
      </label>

      {otherChildren.length > 0 && (
        <div className="mt-4">
          <span className="block text-sm font-medium mb-1.5">함께 나온 다른 아이 (선택)</span>
          <input
            className="input mb-2"
            placeholder="이름으로 검색"
            value={childFilter}
            onChange={(e) => setChildFilter(e.target.value)}
          />
          <div className="max-h-40 overflow-y-auto rounded-xl border border-sage-100 p-2 space-y-1">
            {filteredOtherChildren.length === 0 && <p className="text-xs text-ink/40 px-2 py-1">검색 결과가 없습니다.</p>}
            {filteredOtherChildren.map((c) => (
              <label key={c.id} className="flex items-center gap-2 text-sm px-2 py-1 rounded-lg hover:bg-sage-50">
                <input type="checkbox" checked={taggedIds.has(c.id)} onChange={() => toggleTag(c.id)} />
                {c.name} <span className="text-ink/40 text-xs">{c.grade}</span>
              </label>
            ))}
          </div>
        </div>
      )}

      {progress.length > 0 && (
        <ul className="text-xs text-ink/60 mt-4 space-y-0.5">
          {progress.map((p, i) => <li key={i}>{p}</li>)}
        </ul>
      )}
      {message && <p className="text-sm text-sage-600 mt-2">{message}</p>}

      <div className="flex items-center gap-2 mt-5">
        <button
          className="btn-primary"
          disabled={uploading || files.length === 0 || !activityDate || !activityName.trim()}
          onClick={handleUpload}
        >
          {uploading ? "업로드 중..." : "업로드"}
        </button>
        <button className="btn-ghost" onClick={() => { reset(); setOpen(false); }}>취소</button>
      </div>
    </div>
  );
}

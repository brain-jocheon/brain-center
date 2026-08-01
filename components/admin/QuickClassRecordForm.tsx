"use client";

/**
 * 수업기록 빠른등록 — 날짜/활동 → 참여 아이 다중선택 → 사진(선택) → 전체 코멘트(템플릿 삽입 가능)
 * → 아이별 코멘트 오버라이드+공개여부 → 저장, 순서로 한 화면에 이어서 입력합니다.
 * 사진은 기존 PhotoUploadForm과 같은 서명업로드 흐름을 그대로 재사용하되, classRecordId를
 * 붙여서 이 수업기록과 묶어 저장합니다.
 */

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabaseBrowserClient";
import type { CommentTemplate } from "@/lib/types";

const PHOTO_BUCKET = "activity-photos";
const ACTIVITY_TYPE_LABEL: Record<string, string> = {
  class: "수업", craft: "만들기", cooking: "요리", neurofeedback: "뉴로피드백", event: "행사", other: "기타",
};
const ALLOWED_EXT = ["jpg", "jpeg", "png", "webp"];

type ChildOption = { id: string; name: string; grade: string };
type PerChildState = { override: boolean; comment: string; isPublicToParent: boolean };

export default function QuickClassRecordForm({
  selectableChildren,
  activityNameSuggestions,
  initialTemplates,
}: {
  selectableChildren: ChildOption[];
  activityNameSuggestions: string[];
  initialTemplates: CommentTemplate[];
}) {
  const [classDate, setClassDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [activityName, setActivityName] = useState("");
  const [activityType, setActivityType] = useState("class");
  const [childFilter, setChildFilter] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [files, setFiles] = useState<File[]>([]);
  const [photosPublic, setPhotosPublic] = useState(false);
  const [sharedComment, setSharedComment] = useState("");
  const [perChild, setPerChild] = useState<Record<string, PerChildState>>({});
  const [templates, setTemplates] = useState<CommentTemplate[]>(initialTemplates);
  const [newTemplateText, setNewTemplateText] = useState("");
  const [templateTarget, setTemplateTarget] = useState<"shared" | string>("shared");
  const [saving, setSaving] = useState(false);
  const [progress, setProgress] = useState<string[]>([]);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  const filteredChildren = useMemo(() => {
    const q = childFilter.trim().toLowerCase();
    if (!q) return selectableChildren;
    return selectableChildren.filter((c) => c.name.toLowerCase().includes(q));
  }, [selectableChildren, childFilter]);

  const selectedChildren = useMemo(
    () => selectableChildren.filter((c) => selectedIds.has(c.id)),
    [selectableChildren, selectedIds]
  );

  function toggleChild(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function getPerChild(id: string): PerChildState {
    return perChild[id] ?? { override: false, comment: "", isPublicToParent: false };
  }

  function updatePerChild(id: string, patch: Partial<PerChildState>) {
    setPerChild((prev) => ({ ...prev, [id]: { ...getPerChild(id), ...patch } }));
  }

  function insertTemplate(text: string) {
    if (templateTarget === "shared") {
      setSharedComment((prev) => (prev.trim() ? `${prev.trim()} ${text}` : text));
    } else {
      const current = getPerChild(templateTarget);
      const merged = current.comment.trim() ? `${current.comment.trim()} ${text}` : text;
      updatePerChild(templateTarget, { comment: merged });
    }
  }

  async function addTemplate() {
    const text = newTemplateText.trim();
    if (!text) return;
    try {
      const res = await fetch("/api/admin/comment-templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      if (!res.ok) return;
      const { template } = await res.json();
      setTemplates((prev) => [template, ...prev]);
      setNewTemplateText("");
    } catch {
      // 무시 — 템플릿 저장 실패는 본 등록 흐름을 막지 않음
    }
  }

  async function removeTemplate(id: string) {
    setTemplates((prev) => prev.filter((t) => t.id !== id));
    try {
      await fetch(`/api/admin/comment-templates/${id}`, { method: "DELETE" });
    } catch {
      // 무시
    }
  }

  const canSubmit = !!classDate && !!activityName.trim() && selectedIds.size > 0 && !saving;

  async function handleSave() {
    if (!canSubmit) return;
    setSaving(true);
    setError("");
    setMessage("");
    setProgress([]);

    const childComments: Record<string, { comment?: string; isPublicToParent: boolean }> = {};
    for (const id of Array.from(selectedIds)) {
      const state = getPerChild(id);
      childComments[id] = {
        comment: state.override ? state.comment.trim() || undefined : undefined,
        isPublicToParent: state.isPublicToParent,
      };
    }

    let recordId: string;
    try {
      const res = await fetch("/api/admin/class-records", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          classDate,
          activityName: activityName.trim(),
          activityType,
          comment: sharedComment.trim() || undefined,
          childIds: Array.from(selectedIds),
          childComments,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setError(data?.message || "수업기록 저장에 실패했습니다.");
        setSaving(false);
        return;
      }
      const data = await res.json();
      recordId = data.record.id;
    } catch {
      setError("네트워크 오류로 저장에 실패했습니다.");
      setSaving(false);
      return;
    }

    let photoSuccessCount = 0;
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
          body: JSON.stringify({ childId: Array.from(selectedIds)[0], filename: file.name, contentType: file.type }),
        });
        if (!urlRes.ok) {
          setProgress((p) => [...p, `${file.name}: 업로드 URL 발급 실패`]);
          continue;
        }
        const { path, token } = await urlRes.json();
        const { error: uploadError } = await supabaseBrowser().storage.from(PHOTO_BUCKET).uploadToSignedUrl(path, token, file);
        if (uploadError) {
          setProgress((p) => [...p, `${file.name}: 업로드 실패 (${uploadError.message})`]);
          continue;
        }
        const createRes = await fetch("/api/admin/photos", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            storagePath: path,
            activityDate: classDate,
            activityName: activityName.trim(),
            activityType,
            isPublicToParent: photosPublic,
            isPublicToBlog: false,
            studentIds: Array.from(selectedIds),
            classRecordId: recordId,
          }),
        });
        if (!createRes.ok) {
          setProgress((p) => [...p, `${file.name}: 저장 실패`]);
          continue;
        }
        photoSuccessCount += 1;
        setProgress((p) => [...p, `${file.name}: 완료`]);
      } catch {
        setProgress((p) => [...p, `${file.name}: 네트워크 오류로 실패`]);
      }
    }

    setSaving(false);
    setMessage(`수업기록 저장 완료${files.length > 0 ? ` (사진 ${photoSuccessCount}/${files.length}장)` : ""}`);
    setTimeout(() => router.push("/admin"), 900);
  }

  return (
    <div className="space-y-5">
      <div className="card">
        <p className="section-label mb-4">언제, 무슨 활동</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <label className="block">
            <span className="block text-sm font-medium mb-1.5">날짜</span>
            <input className="input" type="date" value={classDate} onChange={(e) => setClassDate(e.target.value)} />
          </label>
          <label className="block">
            <span className="block text-sm font-medium mb-1.5">활동명</span>
            <input
              className="input"
              list="quick-record-activity-suggestions"
              value={activityName}
              onChange={(e) => setActivityName(e.target.value)}
              placeholder="예: 인지학습 수업"
            />
            <datalist id="quick-record-activity-suggestions">
              {activityNameSuggestions.map((n) => <option key={n} value={n} />)}
            </datalist>
          </label>
          <label className="block sm:col-span-2">
            <span className="block text-sm font-medium mb-1.5">활동 유형</span>
            <select className="input" value={activityType} onChange={(e) => setActivityType(e.target.value)}>
              {Object.entries(ACTIVITY_TYPE_LABEL).map(([v, label]) => (
                <option key={v} value={v}>{label}</option>
              ))}
            </select>
          </label>
        </div>
      </div>

      <div className="card">
        <p className="section-label mb-3">오늘 참여한 아이</p>
        <input
          className="input mb-2"
          placeholder="이름으로 검색"
          value={childFilter}
          onChange={(e) => setChildFilter(e.target.value)}
        />
        <div className="max-h-48 overflow-y-auto rounded-xl border border-sage-100 p-2 space-y-1">
          {filteredChildren.length === 0 && <p className="text-xs text-ink/40 px-2 py-1">검색 결과가 없습니다.</p>}
          {filteredChildren.map((c) => (
            <label key={c.id} className="flex items-center gap-2 text-sm px-2 py-1 rounded-lg hover:bg-sage-50">
              <input type="checkbox" checked={selectedIds.has(c.id)} onChange={() => toggleChild(c.id)} />
              {c.name} <span className="text-ink/40 text-xs">{c.grade}</span>
            </label>
          ))}
        </div>
        {selectedIds.size > 0 && (
          <p className="text-xs text-sage-600 mt-2">{selectedIds.size}명 선택됨</p>
        )}
      </div>

      <div className="card">
        <p className="section-label mb-3">사진 (선택 — 없어도 저장 가능)</p>
        <input
          ref={fileInputRef}
          className="input"
          type="file"
          accept="image/jpeg,image/png,image/webp"
          multiple
          onChange={(e) => setFiles(Array.from(e.target.files ?? []))}
        />
        {files.length > 0 && (
          <>
            <p className="text-xs text-ink/50 mt-1 mb-2">{files.length}개 선택됨</p>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={photosPublic} onChange={(e) => setPhotosPublic(e.target.checked)} />
              이 사진들을 학부모에게 공개
            </label>
          </>
        )}
      </div>

      <div className="card">
        <p className="section-label mb-2">코멘트 템플릿</p>
        <p className="text-xs text-ink/50 mb-3">칩을 누르면 현재 선택된 코멘트 칸({templateTarget === "shared" ? "전체 코멘트" : selectedChildren.find((c) => c.id === templateTarget)?.name ?? "코멘트"})에 문구가 추가됩니다.</p>
        <div className="flex flex-wrap gap-1.5 mb-3">
          {templates.length === 0 && <p className="text-xs text-ink/40">등록된 템플릿이 없습니다. 아래에서 추가해 보세요.</p>}
          {templates.map((t) => (
            <span key={t.id} className="inline-flex items-center gap-1 bg-sage-50 border border-sage-200 rounded-full pl-3 pr-1 py-1 text-xs">
              <button type="button" onClick={() => insertTemplate(t.text)} className="text-ink/70 hover:text-sage-700">{t.text}</button>
              <button
                type="button"
                onClick={() => removeTemplate(t.id)}
                className="w-4 h-4 rounded-full text-ink/30 hover:text-apricot-600 hover:bg-apricot-100 flex items-center justify-center"
                aria-label="템플릿 삭제"
              >
                ×
              </button>
            </span>
          ))}
        </div>
        <div className="flex gap-2">
          <input
            className="input flex-1"
            placeholder="자주 쓰는 문구 추가 (예: 오늘 즐겁게 참여했어요)"
            value={newTemplateText}
            onChange={(e) => setNewTemplateText(e.target.value)}
          />
          <button type="button" className="btn-ghost text-sm shrink-0" onClick={addTemplate}>+ 추가</button>
        </div>
      </div>

      <div className="card">
        <p className="section-label mb-2">전체 코멘트</p>
        <p className="text-xs text-ink/50 mb-2">아래에서 아이별로 따로 지정하지 않으면, 이 문구가 선택된 아이 모두에게 기본으로 쓰입니다.</p>
        <textarea
          className="input min-h-20"
          value={sharedComment}
          onFocus={() => setTemplateTarget("shared")}
          onChange={(e) => setSharedComment(e.target.value)}
          placeholder="오늘 수업 내용을 간단히 남겨주세요"
        />
      </div>

      {selectedChildren.length > 0 && (
        <div className="card">
          <p className="section-label mb-3">아이별 코멘트 · 공개 여부</p>
          <div className="space-y-3">
            {selectedChildren.map((c) => {
              const state = getPerChild(c.id);
              return (
                <div key={c.id} className="rounded-xl border border-sage-100 p-3">
                  <div className="flex items-center justify-between flex-wrap gap-2 mb-2">
                    <p className="text-sm font-semibold">{c.name} <span className="text-ink/40 text-xs font-normal">{c.grade}</span></p>
                    <label className="flex items-center gap-2 text-xs">
                      <input
                        type="checkbox"
                        checked={state.override}
                        onChange={(e) => updatePerChild(c.id, { override: e.target.checked })}
                      />
                      이 아이만 다르게 쓰기
                    </label>
                  </div>
                  {state.override && (
                    <textarea
                      className="input min-h-16 mb-2"
                      value={state.comment}
                      onFocus={() => setTemplateTarget(c.id)}
                      onChange={(e) => updatePerChild(c.id, { comment: e.target.value })}
                      placeholder={`${c.name}에게만 다르게 남길 코멘트`}
                    />
                  )}
                  {!state.override && sharedComment.trim() && (
                    <p className="text-xs text-ink/40 mb-2">전체 코멘트와 동일: “{sharedComment.trim()}”</p>
                  )}
                  <label className="flex items-center gap-2 text-xs">
                    <input
                      type="checkbox"
                      checked={state.isPublicToParent}
                      onChange={(e) => updatePerChild(c.id, { isPublicToParent: e.target.checked })}
                    />
                    이 아이 학부모에게 공개
                  </label>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {progress.length > 0 && (
        <ul className="text-xs text-ink/60 space-y-0.5">
          {progress.map((p, i) => <li key={i}>{p}</li>)}
        </ul>
      )}
      {error && <p className="text-sm text-apricot-600">{error}</p>}
      {message && <p className="text-sm text-sage-600">{message}</p>}

      <div className="flex items-center gap-2">
        <button className="btn-primary" disabled={!canSubmit} onClick={handleSave}>
          {saving ? "저장 중..." : "수업기록 저장"}
        </button>
      </div>
    </div>
  );
}

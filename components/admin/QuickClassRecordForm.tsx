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
import RatingStepper from "./RatingStepper";

const PHOTO_BUCKET = "activity-photos";
const ACTIVITY_TYPE_LABEL: Record<string, string> = {
  class: "수업", craft: "만들기", cooking: "요리", neurofeedback: "뉴로피드백", event: "행사", other: "기타",
};
const ALLOWED_EXT = ["jpg", "jpeg", "png", "webp"];

type ChildOption = { id: string; name: string; grade: string };
type AiDraft = { detail: string; parent: string; guidance: string; model: string };
type Ratings = {
  participationLevel: number | null;
  concentrationLevel: number | null;
  understandingLevel: number | null;
  emotionalStateLevel: number | null;
  interactionLevel: number | null;
};
type PerChildState = Ratings & {
  override: boolean;
  comment: string;
  teacherMemo: string;
  strengthsNote: string;
  difficultiesNote: string;
  specialNote: string;
  nextSessionGoal: string;
  parentActivitySummary: string;
  parentPositiveMoment: string;
  parentObservedChange: string;
  parentNextGoal: string;
  parentHomeTip: string;
  aiLoading: boolean;
  aiDraft: AiDraft | null;
  aiMessage: string;
  aiUsedForComment: boolean;
};

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
  const [lessonGoal, setLessonGoal] = useState("");
  const [participation, setParticipation] = useState("");
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
    return (
      perChild[id] ?? {
        override: false,
        comment: "",
        teacherMemo: "",
        strengthsNote: "",
        difficultiesNote: "",
        specialNote: "",
        nextSessionGoal: "",
        parentActivitySummary: "",
        parentPositiveMoment: "",
        parentObservedChange: "",
        parentNextGoal: "",
        parentHomeTip: "",
        participationLevel: null,
        concentrationLevel: null,
        understandingLevel: null,
        emotionalStateLevel: null,
        interactionLevel: null,
        aiLoading: false,
        aiDraft: null,
        aiMessage: "",
        aiUsedForComment: false,
      }
    );
  }

  function updatePerChild(id: string, patch: Partial<PerChildState>) {
    setPerChild((prev) => ({ ...prev, [id]: { ...getPerChild(id), ...patch } }));
  }

  async function generateAiDraft(childId: string) {
    const state = getPerChild(childId);
    if (!state.teacherMemo.trim()) return;
    updatePerChild(childId, { aiLoading: true, aiMessage: "", aiDraft: null });
    try {
      const res = await fetch("/api/admin/ai/class-record-draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          childId,
          activityName: activityName.trim(),
          activityType,
          classDate,
          lessonGoal: lessonGoal.trim() || undefined,
          participation: participation.trim() || undefined,
          strengthsNote: state.strengthsNote.trim() || undefined,
          difficultiesNote: state.difficultiesNote.trim() || undefined,
          teacherMemo: state.teacherMemo.trim(),
        }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        updatePerChild(childId, { aiLoading: false, aiMessage: data?.message || "AI 초안 생성에 실패했습니다." });
        return;
      }
      if (!data?.ok) {
        updatePerChild(childId, { aiLoading: false, aiMessage: data?.message || "AI 초안 생성에 실패했습니다." });
        return;
      }
      updatePerChild(childId, {
        aiLoading: false,
        aiMessage: "",
        aiDraft: { ...data.draft, model: data.model },
      });
    } catch {
      updatePerChild(childId, { aiLoading: false, aiMessage: "네트워크 오류로 AI 초안 생성에 실패했습니다." });
    }
  }

  function useAiDraftAsComment(childId: string) {
    const state = getPerChild(childId);
    if (!state.aiDraft) return;
    updatePerChild(childId, { override: true, comment: state.aiDraft.parent, aiUsedForComment: true });
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

    const childComments: Record<string, Record<string, unknown>> = {};
    for (const id of Array.from(selectedIds)) {
      const state = getPerChild(id);
      childComments[id] = {
        comment: state.override ? state.comment.trim() || undefined : undefined,
        // [15단계/보안] 여기서 무엇을 보내든 서버가 생성 시점엔 항상 false로 저장함(자동공개 금지) —
        // 학부모 공개는 "수업 코멘트" 탭에서 관리자가 나중에 승인해야 함.
        isPublicToParent: false,
        strengthsNote: state.strengthsNote.trim() || undefined,
        difficultiesNote: state.difficultiesNote.trim() || undefined,
        teacherMemo: state.teacherMemo.trim() || undefined,
        specialNote: state.specialNote.trim() || undefined,
        nextSessionGoal: state.nextSessionGoal.trim() || undefined,
        parentActivitySummary: state.parentActivitySummary.trim() || undefined,
        parentPositiveMoment: state.parentPositiveMoment.trim() || undefined,
        parentObservedChange: state.parentObservedChange.trim() || undefined,
        parentNextGoal: state.parentNextGoal.trim() || undefined,
        parentHomeTip: state.parentHomeTip.trim() || undefined,
        participationLevel: state.participationLevel ?? undefined,
        concentrationLevel: state.concentrationLevel ?? undefined,
        understandingLevel: state.understandingLevel ?? undefined,
        emotionalStateLevel: state.emotionalStateLevel ?? undefined,
        interactionLevel: state.interactionLevel ?? undefined,
        ...(state.aiDraft
          ? {
              aiDraftDetail: state.aiDraft.detail,
              aiDraftParent: state.aiDraft.parent,
              aiDraftGuidance: state.aiDraft.guidance,
              aiGeneratedAt: new Date().toISOString(),
              aiModel: state.aiDraft.model,
            }
          : {}),
        finalSource: state.aiUsedForComment ? "ai_edited" : state.comment.trim() ? "manual" : undefined,
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
          lessonGoal: lessonGoal.trim() || undefined,
          participation: participation.trim() || undefined,
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
          <label className="block">
            <span className="block text-sm font-medium mb-1.5">수업목표 (선택)</span>
            <input className="input" value={lessonGoal} onChange={(e) => setLessonGoal(e.target.value)} placeholder="예: 순서대로 지시 따르기" />
          </label>
          <label className="block">
            <span className="block text-sm font-medium mb-1.5">참여도 (선택)</span>
            <input className="input" value={participation} onChange={(e) => setParticipation(e.target.value)} placeholder="예: 적극적" />
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
          <p className="section-label mb-3">아이별 관찰 기록</p>
          <p className="text-xs text-ink/40 mb-3">학부모 공개는 저장 후 "수업 코멘트" 탭에서 관리자가 승인해야 반영됩니다.</p>
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

                  <div className="grid grid-cols-3 sm:grid-cols-5 gap-2 mt-2">
                    <RatingStepper label="참여도" value={state.participationLevel ?? undefined} onChange={(v) => updatePerChild(c.id, { participationLevel: v })} />
                    <RatingStepper label="집중도" value={state.concentrationLevel ?? undefined} onChange={(v) => updatePerChild(c.id, { concentrationLevel: v })} />
                    <RatingStepper label="이해도" value={state.understandingLevel ?? undefined} onChange={(v) => updatePerChild(c.id, { understandingLevel: v })} />
                    <RatingStepper label="정서상태" value={state.emotionalStateLevel ?? undefined} onChange={(v) => updatePerChild(c.id, { emotionalStateLevel: v })} />
                    <RatingStepper label="상호작용" value={state.interactionLevel ?? undefined} onChange={(v) => updatePerChild(c.id, { interactionLevel: v })} />
                  </div>

                  <div className="mt-3 pt-3 border-t border-sage-100">
                    <p className="text-xs font-medium text-ink/60 mb-1.5">짧은 메모 (선택 — AI 초안에도 쓰입니다)</p>
                    <div className="grid grid-cols-2 gap-2 mb-2">
                      <input
                        className="input !py-1.5 text-xs"
                        placeholder="잘한 점"
                        value={state.strengthsNote}
                        onChange={(e) => updatePerChild(c.id, { strengthsNote: e.target.value })}
                      />
                      <input
                        className="input !py-1.5 text-xs"
                        placeholder="어려워한 점"
                        value={state.difficultiesNote}
                        onChange={(e) => updatePerChild(c.id, { difficultiesNote: e.target.value })}
                      />
                      <input
                        className="input !py-1.5 text-xs"
                        placeholder="특이사항"
                        value={state.specialNote}
                        onChange={(e) => updatePerChild(c.id, { specialNote: e.target.value })}
                      />
                      <input
                        className="input !py-1.5 text-xs"
                        placeholder="다음 시간 목표"
                        value={state.nextSessionGoal}
                        onChange={(e) => updatePerChild(c.id, { nextSessionGoal: e.target.value })}
                      />
                    </div>
                    <textarea
                      className="input !py-1.5 text-xs min-h-12 mb-2"
                      placeholder="자유메모 (예: 오늘 처음 보는 도형도 스스로 맞췄음)"
                      value={state.teacherMemo}
                      onChange={(e) => updatePerChild(c.id, { teacherMemo: e.target.value })}
                    />

                    <details className="rounded-lg border border-sage-100 p-2.5 mb-2">
                      <summary className="text-xs font-medium text-sage-700 cursor-pointer select-none">
                        학부모 공개용 초안 (선택 — 나중에 작성해도 됩니다. 관리자 승인 전엔 학부모에게 안 보입니다)
                      </summary>
                      <div className="mt-2 space-y-2">
                        <input className="input !py-1.5 text-xs" placeholder="오늘의 활동" value={state.parentActivitySummary} onChange={(e) => updatePerChild(c.id, { parentActivitySummary: e.target.value })} />
                        <input className="input !py-1.5 text-xs" placeholder="아이의 긍정적인 반응" value={state.parentPositiveMoment} onChange={(e) => updatePerChild(c.id, { parentPositiveMoment: e.target.value })} />
                        <input className="input !py-1.5 text-xs" placeholder="관찰된 변화" value={state.parentObservedChange} onChange={(e) => updatePerChild(c.id, { parentObservedChange: e.target.value })} />
                        <input className="input !py-1.5 text-xs" placeholder="다음 목표" value={state.parentNextGoal} onChange={(e) => updatePerChild(c.id, { parentNextGoal: e.target.value })} />
                        <input className="input !py-1.5 text-xs" placeholder="가정에서 참고할 내용" value={state.parentHomeTip} onChange={(e) => updatePerChild(c.id, { parentHomeTip: e.target.value })} />
                      </div>
                    </details>

                    <button
                      type="button"
                      className="btn-ghost !px-3 !py-1.5 text-xs"
                      disabled={!state.teacherMemo.trim() || state.aiLoading}
                      onClick={() => generateAiDraft(c.id)}
                    >
                      {state.aiLoading ? "AI 초안 생성 중..." : "AI 초안 생성"}
                    </button>
                    {state.aiMessage && <p className="text-xs text-ink/50 mt-2">{state.aiMessage}</p>}
                    {state.aiDraft && (
                      <div className="mt-2 space-y-2">
                        <AiDraftBlock label="내부용 상세" text={state.aiDraft.detail} />
                        <AiDraftBlock label="학부모용 코멘트" text={state.aiDraft.parent}>
                          <button
                            type="button"
                            className="text-[11px] text-sage-600 underline underline-offset-2"
                            onClick={() => useAiDraftAsComment(c.id)}
                          >
                            이 내용을 코멘트로 사용
                          </button>
                        </AiDraftBlock>
                        <AiDraftBlock label="다음 지도 방향" text={state.aiDraft.guidance} />
                      </div>
                    )}
                  </div>
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

function AiDraftBlock({ label, text, children }: { label: string; text: string; children?: React.ReactNode }) {
  return (
    <div className="rounded-lg bg-sage-50 p-2">
      <div className="flex items-center justify-between gap-2 mb-1">
        <p className="text-[11px] font-medium text-sage-700">{label}</p>
        {children}
      </div>
      <p className="text-xs text-ink/70 whitespace-pre-wrap leading-relaxed">{text}</p>
    </div>
  );
}

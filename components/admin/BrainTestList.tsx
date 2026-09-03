"use client";

/**
 * 뇌기능검사 목록 — 지표·의견·8단계 신규 필드 수정/삭제, 원본 파일은 서버가 미리 서명한 URL로 열람.
 * [7단계] canEdit=false(선생님)이면 수정/삭제 버튼 없이 읽기 전용으로만 보여줌 —
 * API 자체도 관리자 전용으로 막혀 있지만(app/api/admin/brain-tests), 애초에 못 누르게.
 * [11단계] "자동 추출 시도"는 파일에서 텍스트/표를 뽑아 지표 후보를 보여줄 뿐, 사람이
 * 후보를 직접 골라 눌러야만(칩 클릭) 실제 지표에 반영됨 — 자동으로 확정되지 않음.
 * [12단계] 이미지·"AI 이미지 인식" 경로는 Claude Vision을 호출해 실제 AI 비용이 든다 —
 * 버튼 문구에 "(비용 발생)"을 명시해서 무료 추출과 헷갈리지 않게 함.
 */

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { BrainTest, BrainIndicator } from "@/lib/types";
import { STATUS_LABEL } from "./brainTestStatus";
import { deriveCandidateIndicators } from "@/lib/extraction/heuristics";

export type BrainTestWithFileUrl = BrainTest & { fileUrl?: string };

const CONFIDENCE_LABEL: Record<string, string> = { none: "없음", low: "낮음", high: "높음" };
const IMAGE_EXTS = new Set(["jpg", "jpeg", "png", "webp"]);

/** [13단계] AI 해석에서 나온 학부모용 요약을 쓸 때 항상 자동으로 붙임 — 사람이 안 붙여도
 * 되게(AI가 문구를 빼먹을 수 있어 프롬프트만 믿지 않음). */
const AI_DISCLAIMER = "이 해석은 교육·상담 참고 자료이며 의학적 진단이 아닙니다.";

function readAiField(interpretation: Record<string, unknown> | undefined, key: string): string {
  const value = interpretation?.[key];
  return typeof value === "string" ? value : "";
}

export default function BrainTestList({ tests, canEdit }: { tests: BrainTestWithFileUrl[]; canEdit: boolean }) {
  if (tests.length === 0) {
    return <p className="text-sm text-ink/50 py-4 text-center">아직 등록된 뇌기능검사가 없습니다.</p>;
  }

  return (
    <div className="space-y-4">
      {tests.map((t) => (
        <BrainTestCard key={t.id} test={t} canEdit={canEdit} />
      ))}
    </div>
  );
}

function BrainTestCard({ test, canEdit }: { test: BrainTestWithFileUrl; canEdit: boolean }) {
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [testType, setTestType] = useState(test.testType ?? "");
  const [testName, setTestName] = useState(test.testName ?? "");
  const [measuringOrg, setMeasuringOrg] = useState(test.measuringOrg ?? "");
  const [measuredBy, setMeasuredBy] = useState(test.measuredBy ?? "");
  const [status, setStatus] = useState<BrainTest["status"]>(test.status ?? "draft");
  const [indicators, setIndicators] = useState<BrainIndicator[]>(test.indicators.length ? test.indicators : [{ label: "", value: "" }]);
  const [opinion, setOpinion] = useState(test.opinion ?? "");
  const [parentSummary, setParentSummary] = useState(test.parentSummary ?? "");
  const [finalInterpretation, setFinalInterpretation] = useState(test.finalInterpretation ?? "");
  const [isPublicToParent, setIsPublicToParent] = useState(test.isPublicToParent);
  const [extracting, setExtracting] = useState(false);
  const [extractWarnings, setExtractWarnings] = useState<{ duplicate?: string; nameMismatch?: string } | null>(null);
  const [extractError, setExtractError] = useState("");
  const [interpreting, setInterpreting] = useState(false);
  const [interpretError, setInterpretError] = useState("");
  const router = useRouter();

  const candidateIndicators = useMemo(() => deriveCandidateIndicators(test.rawExtracted ?? null), [test.rawExtracted]);
  const fileExt = (test.fileName ?? test.fileStoragePath ?? "").split(".").pop()?.toLowerCase() ?? "";

  function addCandidateAsIndicator(candidate: { label: string; value: string }) {
    setIndicators((prev) => {
      if (prev.some((row) => row.label === candidate.label && row.value === candidate.value)) return prev;
      const nonEmpty = prev.filter((row) => row.label || row.value);
      return [...nonEmpty, candidate];
    });
  }

  async function handleExtract(mode?: "vision") {
    setExtracting(true);
    setExtractError("");
    setExtractWarnings(null);
    const res = await fetch(`/api/admin/brain-tests/${test.id}/extract`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(mode ? { mode } : {}),
    });
    const data = await res.json().catch(() => null);
    setExtracting(false);
    if (!res.ok || !data?.ok) {
      setExtractError(data?.message || "추출에 실패했습니다.");
      return;
    }
    setExtractWarnings({ duplicate: data.duplicateWarning, nameMismatch: data.nameMismatchWarning });
    setEditing(true);
    router.refresh();
  }

  async function handleInterpret() {
    setInterpreting(true);
    setInterpretError("");
    const res = await fetch(`/api/admin/brain-tests/${test.id}/interpret`, { method: "POST" });
    const data = await res.json().catch(() => null);
    setInterpreting(false);
    if (!res.ok || !data?.ok) {
      setInterpretError(data?.message || "AI 해석 생성에 실패했습니다.");
      return;
    }
    setEditing(true);
    router.refresh();
  }

  function useParentSummaryFromAi(aiInterpretation: Record<string, unknown> | undefined) {
    const text = readAiField(aiInterpretation, "parentSummary");
    if (!text) return;
    setParentSummary(`${text}\n\n${AI_DISCLAIMER}`);
  }

  function useSummaryAsFinalInterpretation(aiInterpretation: Record<string, unknown> | undefined) {
    const parts = [
      readAiField(aiInterpretation, "summary"),
      readAiField(aiInterpretation, "strengths") && `강점: ${readAiField(aiInterpretation, "strengths")}`,
      readAiField(aiInterpretation, "attentionAreas") && `주의영역: ${readAiField(aiInterpretation, "attentionAreas")}`,
    ].filter(Boolean);
    if (parts.length === 0) return;
    setFinalInterpretation(parts.join("\n\n"));
  }

  async function handleConfirmExtraction() {
    setSaving(true);
    setMessage("");
    const res = await fetch(`/api/admin/brain-tests/${test.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        indicators, opinion, isPublicToParent,
        testType, testName, measuringOrg, measuredBy, parentSummary, finalInterpretation,
        status: "confirmed", confirmExtraction: true,
      }),
    });
    setSaving(false);
    if (res.ok) {
      setStatus("confirmed");
      setEditing(false);
      router.refresh();
    } else {
      setMessage("저장에 실패했습니다.");
    }
  }

  function updateIndicator(i: number, patch: Partial<BrainIndicator>) {
    setIndicators((prev) => prev.map((row, idx) => (idx === i ? { ...row, ...patch } : row)));
  }
  function addIndicator() {
    setIndicators((prev) => [...prev, { label: "", value: "" }]);
  }
  function removeIndicator(i: number) {
    setIndicators((prev) => prev.filter((_, idx) => idx !== i));
  }

  async function handleSave() {
    setSaving(true);
    setMessage("");
    const res = await fetch(`/api/admin/brain-tests/${test.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        indicators, opinion, isPublicToParent,
        testType, testName, measuringOrg, measuredBy, parentSummary, finalInterpretation, status,
      }),
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
    if (!confirm("이 뇌기능검사를 삭제하시겠습니까? 원본 파일도 함께 삭제되며 되돌릴 수 없습니다.")) return;
    setSaving(true);
    const res = await fetch(`/api/admin/brain-tests/${test.id}`, { method: "DELETE" });
    setSaving(false);
    if (res.ok) router.refresh();
    else setMessage("삭제에 실패했습니다.");
  }

  const currentStatus = test.status ?? "draft";

  return (
    <div className="rounded-xl border border-sage-100 p-4 bg-white">
      <div className="flex items-center justify-between flex-wrap gap-2 mb-2">
        <div>
          <p className="font-bold text-sm">
            검사일 {test.testDate} · 담당 {test.counselor}
            {test.testType && <span className="text-ink/40 font-normal"> · {test.testType}</span>}
          </p>
          <div className="flex items-center gap-1.5 mt-1 flex-wrap">
            <span className={`text-[10px] rounded-full px-2 py-0.5 font-medium ${test.isPublicToParent ? "bg-sage-100 text-sage-700" : "bg-apricot-50 text-apricot-600"}`}>
              {test.isPublicToParent ? "학부모 공개" : "학부모 비공개"}
            </span>
            <span className="text-[10px] rounded-full px-2 py-0.5 font-medium bg-ink/5 text-ink/50">
              {STATUS_LABEL[currentStatus]}
            </span>
            {test.approvedAt && (
              <span className="text-[10px] text-ink/35">승인 {test.approvedBy} · {test.approvedAt.slice(0, 10)}</span>
            )}
            {test.extractionConfidence && (
              <span className="text-[10px] rounded-full px-2 py-0.5 font-medium bg-sky-50 text-sky-700">
                추출 신뢰도 {CONFIDENCE_LABEL[test.extractionConfidence] ?? test.extractionConfidence}
              </span>
            )}
          </div>
        </div>
        <div className="flex gap-2">
          {test.fileUrl && (
            <a className="text-xs text-sage-600 underline underline-offset-2" href={test.fileUrl} target="_blank" rel="noreferrer">
              원본 PDF 보기
            </a>
          )}
          {canEdit && test.fileStoragePath && (
            <button className="text-xs text-sage-600 underline underline-offset-2" disabled={extracting} onClick={() => handleExtract()}>
              {extracting
                ? "추출 중..."
                : IMAGE_EXTS.has(fileExt)
                ? test.rawExtracted ? "AI로 다시 인식(비용 발생)" : "AI로 인식 시도(비용 발생)"
                : test.rawExtracted ? "다시 추출" : "자동 추출 시도"}
            </button>
          )}
          {canEdit && fileExt === "pdf" && test.extractionConfidence === "none" && (
            <button className="text-xs text-sky-700 underline underline-offset-2" disabled={extracting} onClick={() => handleExtract("vision")}>
              {extracting ? "인식 중..." : "AI 이미지 인식으로 재시도(비용 발생)"}
            </button>
          )}
          {canEdit && test.indicators.length > 0 && (
            <button className="text-xs text-sage-600 underline underline-offset-2" disabled={interpreting} onClick={handleInterpret}>
              {interpreting ? "해석 생성 중..." : test.aiInterpretation ? "AI 해석 다시 생성" : "AI 해석 생성"}
            </button>
          )}
          {canEdit && (
            <>
              <button className="text-xs text-sage-600 underline underline-offset-2" onClick={() => setEditing((v) => !v)}>수정</button>
              <button className="text-xs text-apricot-600 underline underline-offset-2" disabled={saving} onClick={handleDelete}>삭제</button>
            </>
          )}
        </div>
      </div>

      {extractError && <p className="text-xs text-apricot-600 mb-2">{extractError}</p>}
      {interpretError && <p className="text-xs text-apricot-600 mb-2">{interpretError}</p>}

      {!editing && (
        <>
          {(test.testName || test.measuringOrg || test.measuredBy) && (
            <p className="text-xs text-ink/50 mb-1.5">
              {[test.testName, test.measuringOrg, test.measuredBy].filter(Boolean).join(" · ")}
            </p>
          )}
          {test.indicators.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mb-2">
              {test.indicators.map((i, idx) => (
                <span key={idx} className="text-xs bg-sage-50 text-sage-700 rounded-full px-2.5 py-1">
                  {i.label} {i.value}
                </span>
              ))}
            </div>
          )}
          {test.opinion && <p className="text-sm text-ink/80 whitespace-pre-wrap leading-relaxed">{test.opinion}</p>}
          {test.finalInterpretation && (
            <p className="text-sm text-ink/80 whitespace-pre-wrap leading-relaxed mt-2">
              <span className="font-medium">종합소견</span> {test.finalInterpretation}
            </p>
          )}
          {test.parentSummary && (
            <p className="text-xs text-sage-700 bg-sage-50 rounded-lg p-2 mt-2 whitespace-pre-wrap leading-relaxed">
              <span className="font-medium">학부모 공개용 요약</span> {test.parentSummary}
            </p>
          )}
        </>
      )}

      {editing && canEdit && (
        <div className="mt-2 space-y-2 border-t border-sage-100 pt-3">
          {test.rawExtracted && (
            <div className="rounded-lg bg-sky-50 border border-sky-100 p-3 space-y-2">
              <p className="text-xs font-medium text-sky-700">추출 결과 (파일에서 자동으로 뽑아본 값 — 규칙 기반 추정이라 틀리거나 놓칠 수 있습니다)</p>
              {(extractWarnings?.duplicate || extractWarnings?.nameMismatch) && (
                <div className="space-y-1">
                  {extractWarnings.duplicate && <p className="text-xs text-apricot-600">⚠ {extractWarnings.duplicate}</p>}
                  {extractWarnings.nameMismatch && <p className="text-xs text-apricot-600">⚠ {extractWarnings.nameMismatch}</p>}
                </div>
              )}
              {test.extractionConfidence === "none" ? (
                <p className="text-xs text-ink/50">텍스트에서 지표 후보를 찾지 못했습니다 — 스캔된 이미지 파일일 수 있습니다(이미지 인식은 추후 지원 예정). 원본을 직접 확인해 지표를 입력해 주세요.</p>
              ) : candidateIndicators.length === 0 ? (
                <p className="text-xs text-ink/50">표시할 후보가 없습니다.</p>
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  {candidateIndicators.map((c, i) => (
                    <button
                      key={i}
                      type="button"
                      className="text-xs bg-white border border-sky-200 text-sky-700 rounded-full px-2.5 py-1 hover:bg-sky-100"
                      onClick={() => addCandidateAsIndicator(c)}
                    >
                      + {c.label} {c.value}
                    </button>
                  ))}
                </div>
              )}
              {(test.rawExtracted.type === "pdf" || test.rawExtracted.type === "vision") && (
                <details className="text-xs text-ink/50">
                  <summary className="cursor-pointer text-sky-700">원본 추출 텍스트 보기</summary>
                  <pre className="whitespace-pre-wrap mt-1 max-h-48 overflow-y-auto">{test.rawExtracted.text}</pre>
                </details>
              )}
            </div>
          )}
          {test.aiInterpretation && (
            <div className="rounded-lg bg-sage-50 border border-sage-100 p-3 space-y-2">
              <p className="text-xs font-medium text-sage-700">AI 해석 (검토 후 반영해 주세요 — 자동으로 저장되지 않습니다)</p>
              <p className="text-xs text-ink/70 whitespace-pre-wrap"><span className="font-medium">요약</span> {readAiField(test.aiInterpretation, "summary")}</p>
              <p className="text-xs text-ink/70 whitespace-pre-wrap"><span className="font-medium">강점</span> {readAiField(test.aiInterpretation, "strengths")}</p>
              <p className="text-xs text-ink/70 whitespace-pre-wrap"><span className="font-medium">주의영역</span> {readAiField(test.aiInterpretation, "attentionAreas")}</p>
              <p className="text-xs text-ink/70 whitespace-pre-wrap"><span className="font-medium">학부모용</span> {readAiField(test.aiInterpretation, "parentSummary")}</p>
              <div className="flex gap-3">
                <button type="button" className="text-[11px] text-sage-700 underline underline-offset-2" onClick={() => useParentSummaryFromAi(test.aiInterpretation)}>
                  학부모용 요약 사용(면책문구 자동 포함)
                </button>
                <button type="button" className="text-[11px] text-sage-700 underline underline-offset-2" onClick={() => useSummaryAsFinalInterpretation(test.aiInterpretation)}>
                  종합소견에 반영
                </button>
              </div>
            </div>
          )}
          <div className="grid grid-cols-2 gap-2">
            <input className="input !py-2 text-sm" placeholder="검사 종류" value={testType} onChange={(e) => setTestType(e.target.value)} />
            <input className="input !py-2 text-sm" placeholder="검사명" value={testName} onChange={(e) => setTestName(e.target.value)} />
            <input className="input !py-2 text-sm" placeholder="측정기관" value={measuringOrg} onChange={(e) => setMeasuringOrg(e.target.value)} />
            <input className="input !py-2 text-sm" placeholder="측정자" value={measuredBy} onChange={(e) => setMeasuredBy(e.target.value)} />
          </div>
          <select className="input !py-2 text-sm" value={status} onChange={(e) => setStatus(e.target.value as BrainTest["status"])}>
            {Object.entries(STATUS_LABEL).map(([v, label]) => (
              <option key={v} value={v}>{label}</option>
            ))}
          </select>
          {indicators.map((row, i) => (
            <div key={i} className="flex gap-2">
              <input className="input !py-2 text-sm" placeholder="지표명" value={row.label} onChange={(e) => updateIndicator(i, { label: e.target.value })} />
              <input className="input !py-2 text-sm" placeholder="값" value={row.value} onChange={(e) => updateIndicator(i, { value: e.target.value })} />
              <button type="button" className="btn-ghost !px-3 text-xs shrink-0" onClick={() => removeIndicator(i)} disabled={indicators.length === 1}>삭제</button>
            </div>
          ))}
          <button type="button" className="text-xs text-sage-600 underline underline-offset-2" onClick={addIndicator}>+ 지표 추가</button>
          <textarea className="input min-h-24 text-sm" placeholder="의견(내부용)" value={opinion} onChange={(e) => setOpinion(e.target.value)} />
          <textarea className="input min-h-16 text-sm" placeholder="AI 해석 기반 종합소견(선택)" value={finalInterpretation} onChange={(e) => setFinalInterpretation(e.target.value)} />
          <textarea className="input min-h-16 text-sm" placeholder="학부모 공개용 요약(선택)" value={parentSummary} onChange={(e) => setParentSummary(e.target.value)} />
          <label className="flex items-center gap-2 text-xs">
            <input type="checkbox" checked={isPublicToParent} onChange={(e) => setIsPublicToParent(e.target.checked)} />
            학부모에게 공개
          </label>
          {message && <p className="text-xs text-apricot-600">{message}</p>}
          <div className="flex items-center gap-2">
            <button className="btn-primary text-xs !px-3 !py-1.5" disabled={saving} onClick={handleSave}>
              {saving ? "저장 중..." : "저장"}
            </button>
            {currentStatus === "needs_review" && (
              <button className="btn-ghost text-xs !px-3 !py-1.5 !text-sage-700 !border-sage-300" disabled={saving} onClick={handleConfirmExtraction}>
                확인 완료로 저장
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

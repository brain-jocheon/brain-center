"use client";

/**
 * MT-PRIS 결과 입력 폼
 * ---------------------------------------------------------------------
 * 서술형 리포트와 달리, 여기서는 "원본 값 5가지"만 입력합니다.
 * (대표기능 · 바탕기능 · P/R/I/S 현재성 점수 · 상담 메모)
 * 문장은 저장하지 않고 lib/mtpris/generate.ts가 매번 자동으로 만듭니다.
 */

import { useState } from "react";
import { useRouter } from "next/navigation";
import { MAIN_CODES, SUB_CODES, CANONICAL_NAMES } from "@/lib/content/mtpris/types";
import type { MainCode, SubCode } from "@/lib/content/mtpris/types";
import type { MtprisRawInput } from "@/lib/mtpris/types";

const SUB_LABELS: Record<SubCode, string> = {
  p1: "p1 자랑/몰입", p2: "p2 환호/인정", p3: "p3 자유/의미",
  r1: "r1 질서/달성", r2: "r2 만족/여유", r3: "r3 정돈/도움",
  i1: "i1 평화/소통", i2: "i2 터득/토론", i3: "i3 재미/대화",
  s1: "s1 단란/보호", s2: "s2 배려/통제", s3: "s3 몽상/평온",
};

export default function MtprisEditForm({ initial }: { initial: MtprisRawInput }) {
  const [input, setInput] = useState<MtprisRawInput>(initial);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const router = useRouter();

  function update(partial: Partial<MtprisRawInput>) {
    setInput((r) => ({ ...r, ...partial }));
  }

  async function handleSave() {
    setSaving(true);
    setMessage("");
    const res = await fetch("/api/admin/mtpris-reports", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
    setSaving(false);
    if (res.ok) {
      setMessage("저장되었습니다.");
      router.refresh();
    } else {
      const data = await res.json().catch(() => ({}));
      setMessage(data.message || "저장에 실패했습니다. 다시 시도해 주세요.");
    }
  }

  return (
    <div className="space-y-5">
      <section className="card">
        <p className="section-label mb-4">기본 정보</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="검사일">
            <input className="input" type="date" value={input.testDate}
              onChange={(e) => update({ testDate: e.target.value })} />
          </Field>
          <Field label="담당자">
            <input className="input" value={input.counselor}
              onChange={(e) => update({ counselor: e.target.value })} />
          </Field>
          <Field label="공개 상태">
            <select className="input" value={input.status}
              onChange={(e) => update({ status: e.target.value as MtprisRawInput["status"] })}>
              <option value="draft">작성 중 (학부모에게 안 보임)</option>
              <option value="published">공개 (학부모 열람 가능)</option>
            </select>
          </Field>
        </div>
      </section>

      <section className="card">
        <p className="section-label mb-1">기질 원본 값</p>
        <p className="text-xs text-ink/50 mb-4">
          이 값들만 있으면 리포트 전체 문장이 자동으로 만들어집니다. 기질명은 임의로 수정할 수 없습니다.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="대표기능 (활동할 때의 나)">
            <select className="input" value={input.mainType}
              onChange={(e) => update({ mainType: e.target.value as MainCode })}>
              {MAIN_CODES.map((c) => (
                <option key={c} value={c}>{c} {CANONICAL_NAMES[c]}</option>
              ))}
            </select>
          </Field>
          <Field label="바탕기능 (회복할 때의 나)">
            <select className="input" value={input.subType}
              onChange={(e) => update({ subType: e.target.value as SubCode })}>
              {SUB_CODES.map((c) => (
                <option key={c} value={c}>{SUB_LABELS[c]}</option>
              ))}
            </select>
          </Field>
        </div>

        <p className="text-sm font-medium mt-5 mb-2">PRIS 현재성 점수 (0~100)</p>
        <div className="grid grid-cols-4 gap-3">
          {(["P", "R", "I", "S"] as const).map((k) => (
            <Field key={k} label={k}>
              <input className="input text-center" type="number" min={0} max={100}
                value={input.scores[k]}
                onChange={(e) => update({
                  scores: { ...input.scores, [k]: Math.max(0, Math.min(100, Number(e.target.value) || 0)) },
                })} />
            </Field>
          ))}
        </div>
      </section>

      <section className="card">
        <p className="section-label mb-1">상담 메모</p>
        <p className="text-xs text-ink/50 mb-4">
          ⚠️ [보안] 메모는 기본적으로 학부모에게 보이지 않습니다. 공개가 필요한 경우에만 아래 토글을 켜세요.
        </p>
        <textarea className="input min-h-24" value={input.memo ?? ""}
          onChange={(e) => update({ memo: e.target.value })}
          placeholder="상담 중 참고할 내용을 자유롭게 적으세요 (내부용)" />
        <label className="flex items-center gap-2 mt-3 text-sm">
          <input type="checkbox" checked={input.memoPublic}
            onChange={(e) => update({ memoPublic: e.target.checked })} />
          이 메모를 학부모 화면에도 공개합니다
        </label>
      </section>

      <div className="sticky bottom-4 flex items-center justify-end gap-3">
        {message && <span className="text-sm bg-white rounded-full px-4 py-2 border border-sage-100">{message}</span>}
        <button className="btn-primary shadow-lg" onClick={handleSave} disabled={saving}>
          {saving ? "저장 중..." : "저장하기"}
        </button>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block mb-4 last:mb-0">
      <span className="block text-sm font-medium mb-1.5">{label}</span>
      {children}
    </label>
  );
}

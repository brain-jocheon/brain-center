"use client";

/**
 * 학부모 전용 공지(대상분리) 작성/수정/삭제 — 로그인(토큰+비밀번호) 후에만 보입니다.
 * [주의] 로그인 없이 보이는 공개 홈페이지 공지(NoticeManager.tsx)와 완전히 별개입니다.
 * 이 화면에서 만든 공지는 대상 조건(전체/상태별/프로그램별/요일별/특정 아이)에
 * 맞는 아이의 학부모에게만 보입니다.
 */

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { ParentNoticeAdmin } from "@/lib/types";

type AudienceType = ParentNoticeAdmin["audienceType"];

const AUDIENCE_LABEL: Record<AudienceType, string> = {
  all: "전체",
  status: "이용 상태별",
  program: "프로그램별",
  weekday: "수업 요일별",
  child: "특정 아이",
};
const STATUS_LABEL: Record<string, string> = { active: "이용중", waiting: "대기", ended: "종결" };
const WEEKDAY_LABEL = ["일", "월", "화", "수", "목", "금", "토"];

function audienceSummary(n: ParentNoticeAdmin): string {
  if (n.audienceType === "all") return "전체";
  if (n.audienceType === "status") return `이용상태: ${STATUS_LABEL[n.audienceValue ?? ""] ?? n.audienceValue}`;
  if (n.audienceType === "program") return `프로그램: ${n.audienceValue}`;
  if (n.audienceType === "weekday") return `요일: ${WEEKDAY_LABEL[Number(n.audienceValue)] ?? n.audienceValue}요일`;
  return `아이 지정`;
}

export default function ParentNoticeManager({
  notices,
  programOptions,
  children,
}: {
  notices: ParentNoticeAdmin[];
  programOptions: string[];
  children: { id: string; name: string; grade: string }[];
}) {
  const [creating, setCreating] = useState(false);

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="section-label">학부모 전용 공지</p>
        {!creating && (
          <button className="btn-primary text-sm !px-4 !py-2" onClick={() => setCreating(true)}>
            + 새 공지 작성
          </button>
        )}
      </div>

      {creating && (
        <NoticeEditor programOptions={programOptions} children={children} onDone={() => setCreating(false)} />
      )}

      <div className="space-y-3">
        {notices.length === 0 && !creating && (
          <p className="text-sm text-ink/40 text-center py-6">아직 작성된 학부모 공지가 없습니다.</p>
        )}
        {notices.map((n) => (
          <NoticeCard key={n.id} notice={n} programOptions={programOptions} children={children} />
        ))}
      </div>
    </section>
  );
}

function NoticeCard({
  notice,
  programOptions,
  children,
}: {
  notice: ParentNoticeAdmin;
  programOptions: string[];
  children: { id: string; name: string; grade: string }[];
}) {
  const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const router = useRouter();

  async function handleDelete() {
    if (!confirm(`"${notice.title}" 공지를 삭제하시겠습니까?`)) return;
    setDeleting(true);
    const res = await fetch(`/api/admin/parent-notices/${notice.id}`, { method: "DELETE" });
    setDeleting(false);
    if (res.ok) router.refresh();
    else alert("삭제에 실패했습니다. 다시 시도해 주세요.");
  }

  if (editing) {
    return (
      <NoticeEditor notice={notice} programOptions={programOptions} children={children} onDone={() => setEditing(false)} />
    );
  }

  return (
    <div className="card">
      <div className="flex items-start justify-between gap-3 mb-2">
        <div>
          <p className="font-bold">{notice.title}</p>
          <p className="text-[11px] text-sage-600 mt-0.5">{audienceSummary(notice)}</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button className="text-xs text-sage-600 underline underline-offset-2" onClick={() => setEditing(true)}>수정</button>
          <button className="text-xs text-apricot-600 underline underline-offset-2" disabled={deleting} onClick={handleDelete}>삭제</button>
        </div>
      </div>
      <p className="text-sm text-ink/70 whitespace-pre-wrap leading-relaxed mb-2">{notice.body}</p>
      <p className="text-xs text-ink/35">{notice.createdAt.slice(0, 10)}</p>
    </div>
  );
}

function NoticeEditor({
  notice,
  programOptions,
  children,
  onDone,
}: {
  notice?: ParentNoticeAdmin;
  programOptions: string[];
  children: { id: string; name: string; grade: string }[];
  onDone: () => void;
}) {
  const [title, setTitle] = useState(notice?.title ?? "");
  const [body, setBody] = useState(notice?.body ?? "");
  const [audienceType, setAudienceType] = useState<AudienceType>(notice?.audienceType ?? "all");
  const [audienceValue, setAudienceValue] = useState(notice?.audienceValue ?? "");
  const [childFilter, setChildFilter] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const router = useRouter();

  const filteredChildren = useMemo(() => {
    const q = childFilter.trim().toLowerCase();
    if (!q) return children;
    return children.filter((c) => c.name.toLowerCase().includes(q));
  }, [children, childFilter]);
  const selectedChild = children.find((c) => c.id === audienceValue);

  const canSubmit =
    !!title.trim() && !!body.trim() && (audienceType === "all" || !!audienceValue);

  async function handleSave() {
    setSaving(true);
    setMessage("");
    const res = await fetch(
      notice ? `/api/admin/parent-notices/${notice.id}` : "/api/admin/parent-notices",
      {
        method: notice ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, body, audienceType, audienceValue: audienceType === "all" ? undefined : audienceValue }),
      }
    );
    setSaving(false);
    if (res.ok) {
      router.refresh();
      onDone();
    } else {
      const data = await res.json().catch(() => null);
      setMessage(data?.message || "저장에 실패했습니다. 다시 시도해 주세요.");
    }
  }

  return (
    <div className="card">
      <label className="block mb-3">
        <span className="block text-sm font-medium mb-1.5">제목</span>
        <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="예: 8월 방학 특강 안내" />
      </label>
      <label className="block mb-3">
        <span className="block text-sm font-medium mb-1.5">내용</span>
        <textarea className="input min-h-28" value={body} onChange={(e) => setBody(e.target.value)} />
      </label>

      <label className="block mb-3">
        <span className="block text-sm font-medium mb-1.5">대상</span>
        <select
          className="input"
          value={audienceType}
          onChange={(e) => { setAudienceType(e.target.value as AudienceType); setAudienceValue(""); }}
        >
          {(Object.keys(AUDIENCE_LABEL) as AudienceType[]).map((t) => (
            <option key={t} value={t}>{AUDIENCE_LABEL[t]}</option>
          ))}
        </select>
      </label>

      {audienceType === "status" && (
        <label className="block mb-3">
          <span className="block text-sm font-medium mb-1.5">이용 상태</span>
          <select className="input" value={audienceValue} onChange={(e) => setAudienceValue(e.target.value)}>
            <option value="">선택해 주세요</option>
            {Object.entries(STATUS_LABEL).map(([v, label]) => (
              <option key={v} value={v}>{label}</option>
            ))}
          </select>
        </label>
      )}

      {audienceType === "program" && (
        <label className="block mb-3">
          <span className="block text-sm font-medium mb-1.5">프로그램</span>
          <select className="input" value={audienceValue} onChange={(e) => setAudienceValue(e.target.value)}>
            <option value="">선택해 주세요</option>
            {programOptions.map((p) => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>
        </label>
      )}

      {audienceType === "weekday" && (
        <label className="block mb-3">
          <span className="block text-sm font-medium mb-1.5">수업 요일</span>
          <select className="input" value={audienceValue} onChange={(e) => setAudienceValue(e.target.value)}>
            <option value="">선택해 주세요</option>
            {WEEKDAY_LABEL.map((label, i) => (
              <option key={i} value={String(i)}>{label}요일</option>
            ))}
          </select>
        </label>
      )}

      {audienceType === "child" && (
        <div className="mb-3">
          <span className="block text-sm font-medium mb-1.5">아이 선택</span>
          {selectedChild ? (
            <div className="flex items-center gap-2 text-sm bg-sage-50 rounded-lg px-3 py-2">
              <span className="font-medium">{selectedChild.name}</span>
              <span className="text-ink/40 text-xs">{selectedChild.grade}</span>
              <button className="text-xs text-apricot-600 ml-auto" onClick={() => setAudienceValue("")}>변경</button>
            </div>
          ) : (
            <>
              <input
                className="input mb-2"
                placeholder="이름으로 검색"
                value={childFilter}
                onChange={(e) => setChildFilter(e.target.value)}
              />
              <div className="max-h-40 overflow-y-auto rounded-xl border border-sage-100 p-2 space-y-1">
                {filteredChildren.length === 0 && <p className="text-xs text-ink/40 px-2 py-1">검색 결과가 없습니다.</p>}
                {filteredChildren.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setAudienceValue(c.id)}
                    className="w-full text-left text-sm px-2 py-1 rounded-lg hover:bg-sage-50"
                  >
                    {c.name} <span className="text-ink/40 text-xs">{c.grade}</span>
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {message && <p className="text-sm text-apricot-600 mb-2">{message}</p>}
      <div className="flex items-center gap-2">
        <button className="btn-primary" disabled={saving || !canSubmit} onClick={handleSave}>
          {saving ? "저장 중..." : "저장"}
        </button>
        <button className="btn-ghost" onClick={onDone}>취소</button>
      </div>
    </div>
  );
}

"use client";

/**
 * 학부모 화면 — 우리 아이 활동 사진 (공개 설정된 사진만, 서버가 이미 필터링해서 내려줌)
 * 활동일·활동명으로 그룹핑해서 앨범처럼 보여주고, 클릭하면 크게 봅니다.
 */

import { useState } from "react";
import type { ParentPhoto, ParentChildComment } from "@/lib/types";

const ACTIVITY_TYPE_LABEL: Record<string, string> = {
  class: "수업", craft: "만들기", cooking: "요리", neurofeedback: "뉴로피드백", event: "행사", other: "기타",
};

export default function ActivityAlbumSection({
  photos,
  comments = [],
}: {
  photos: ParentPhoto[];
  /** 사진과 같은 날짜·활동명으로 묶여 표시되는 수업 코멘트(공개 설정된 것만, 서버가 이미 필터링) */
  comments?: ParentChildComment[];
}) {
  const [selected, setSelected] = useState<ParentPhoto | null>(null);
  const [commentExpanded, setCommentExpanded] = useState(false);
  if (photos.length === 0 && comments.length === 0) return null;

  const groups = mergeGroups(photos, comments);

  function openPhoto(p: ParentPhoto) {
    setSelected(p);
    setCommentExpanded(false);
  }

  return (
    <section className="card">
      <p className="section-label mb-2">우리 아이 활동 사진</p>
      <p className="text-xs text-ink/50 mb-4 leading-relaxed">
        활동 사진은 아이의 수업 참여 모습과 성장 과정을 함께 나누기 위한 공간입니다.
        <br />
        사진은 보호자 확인용으로만 제공되며, 외부 공유는 자제해 주세요.
      </p>
      <div className="space-y-5">
        {groups.map((g) => (
          <div key={g.key}>
            <p className="text-sm font-semibold mb-2">
              {g.activityDate} · {g.activityName}
              <span className="text-xs text-ink/40 font-normal ml-2">{ACTIVITY_TYPE_LABEL[g.activityType]}</span>
            </p>
            {g.photos.length > 0 && (
              <div className="grid grid-cols-3 gap-2">
                {g.photos.map((p) => (
                  <button key={p.id} onClick={() => openPhoto(p)} className="aspect-square rounded-lg overflow-hidden">
                    <img src={p.url} alt={p.activityName} className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            )}
            {g.comment && (
              <p className="text-sm text-ink/70 mt-1.5 leading-relaxed whitespace-pre-wrap">{g.comment}</p>
            )}
          </div>
        ))}
      </div>

      {selected && (
        <div
          className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4"
          onClick={() => setSelected(null)}
        >
          <div className="max-w-lg w-full max-h-[85vh] overflow-y-auto rounded-lg" onClick={(e) => e.stopPropagation()}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={selected.url} alt={selected.activityName} className="w-full" />
            <div className="bg-white rounded-b-lg p-4">
              <p className="font-semibold text-sm">{selected.activityDate} · {selected.activityName}</p>
              {selected.description && (
                <>
                  <p
                    className={`mt-1.5 text-ink/70 leading-relaxed cursor-pointer transition-all ${
                      commentExpanded ? "text-lg" : "text-sm"
                    }`}
                    onClick={() => setCommentExpanded((v) => !v)}
                  >
                    {selected.description}
                  </p>
                  <p className="text-[11px] text-sage-500 mt-1">
                    {commentExpanded ? "눌러서 작게 보기" : "눌러서 크게 보기"}
                  </p>
                </>
              )}
              <button className="btn-ghost text-xs mt-3" onClick={() => setSelected(null)}>닫기</button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

/** 사진과 코멘트를 같은 날짜+활동명 키로 묶습니다. 사진 없이 코멘트만 있는 세션은
 * photos가 빈 배열인 그룹으로 나타나고(위에서 그리드 없이 텍스트만 렌더링), 사진과 코멘트가
 * 둘 다 있으면 그리드 아래에 코멘트가 함께 표시됩니다. */
function mergeGroups(photos: ParentPhoto[], comments: ParentChildComment[]) {
  type Group = { key: string; activityDate: string; activityName: string; activityType: string; photos: ParentPhoto[]; comment?: string };
  const map = new Map<string, Group>();
  for (const p of photos) {
    const key = `${p.activityDate}__${p.activityName}`;
    const g = map.get(key) ?? { key, activityDate: p.activityDate, activityName: p.activityName, activityType: p.activityType, photos: [] };
    g.photos.push(p);
    map.set(key, g);
  }
  for (const c of comments) {
    const key = `${c.classDate}__${c.activityName}`;
    const g = map.get(key) ?? { key, activityDate: c.classDate, activityName: c.activityName, activityType: c.activityType, photos: [] };
    g.comment = c.comment;
    map.set(key, g);
  }
  return Array.from(map.values()).sort((a, b) => (a.activityDate < b.activityDate ? 1 : -1));
}

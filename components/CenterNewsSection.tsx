"use client";

/**
 * 학부모 화면 — 센터 소식 (특정 아이 태그와 무관하게, 로그인한 모든 학부모에게 공통으로 보이는 피드)
 * ActivityAlbumSection("우리 아이 활동 사진")과 별개 섹션입니다 — 이건 센터 전체 소식입니다.
 */

import { useState } from "react";
import type { ParentPhoto } from "@/lib/types";

const ACTIVITY_TYPE_LABEL: Record<string, string> = {
  class: "수업", craft: "만들기", cooking: "요리", neurofeedback: "뉴로피드백", event: "행사", other: "기타",
};

export default function CenterNewsSection({ photos }: { photos: ParentPhoto[] }) {
  const [selected, setSelected] = useState<ParentPhoto | null>(null);
  const [commentExpanded, setCommentExpanded] = useState(false);
  if (photos.length === 0) return null;

  const groups = groupByActivity(photos);

  function openPhoto(p: ParentPhoto) {
    setSelected(p);
    setCommentExpanded(false);
  }

  return (
    <section className="card">
      <p className="section-label mb-2">센터 소식</p>
      <p className="text-xs text-ink/50 mb-4 leading-relaxed">
        요즘 센터에서 아이들과 함께한 활동을 전해드립니다.
      </p>
      <div className="space-y-5">
        {groups.map((g) => (
          <div key={g.key}>
            <p className="text-sm font-semibold mb-2">
              {g.activityDate} · {g.activityName}
              <span className="text-xs text-ink/40 font-normal ml-2">{ACTIVITY_TYPE_LABEL[g.activityType]}</span>
            </p>
            <div className="grid grid-cols-3 gap-2">
              {g.photos.map((p) => (
                <button key={p.id} onClick={() => openPhoto(p)} className="aspect-square rounded-lg overflow-hidden">
                  <img src={p.url} alt={p.activityName} className="w-full h-full object-cover" />
                </button>
              ))}
            </div>
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

function groupByActivity(photos: ParentPhoto[]) {
  const map = new Map<string, ParentPhoto[]>();
  for (const p of photos) {
    const key = `${p.activityDate}__${p.activityName}`;
    const list = map.get(key) ?? [];
    list.push(p);
    map.set(key, list);
  }
  return Array.from(map.entries()).map(([key, list]) => ({
    key,
    activityDate: list[0].activityDate,
    activityName: list[0].activityName,
    activityType: list[0].activityType,
    photos: list,
  }));
}

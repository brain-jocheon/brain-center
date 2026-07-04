"use client";

/**
 * 학부모 화면 — 우리 아이 활동 사진 (공개 설정된 사진만, 서버가 이미 필터링해서 내려줌)
 * 활동일·활동명으로 그룹핑해서 앨범처럼 보여주고, 클릭하면 크게 봅니다.
 */

import { useState } from "react";
import type { ParentPhoto } from "@/lib/types";

const ACTIVITY_TYPE_LABEL: Record<string, string> = {
  class: "수업", craft: "만들기", cooking: "요리", neurofeedback: "뉴로피드백", event: "행사", other: "기타",
};

export default function ActivityAlbumSection({ photos }: { photos: ParentPhoto[] }) {
  const [selected, setSelected] = useState<ParentPhoto | null>(null);
  if (photos.length === 0) return null;

  const groups = groupByActivity(photos);

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
            <div className="grid grid-cols-3 gap-2">
              {g.photos.map((p) => (
                <button key={p.id} onClick={() => setSelected(p)} className="aspect-square rounded-lg overflow-hidden">
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
          <div className="max-w-lg w-full" onClick={(e) => e.stopPropagation()}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={selected.url} alt={selected.activityName} className="w-full rounded-t-lg" />
            <div className="bg-white rounded-b-lg p-4">
              <p className="font-semibold text-sm">{selected.activityDate} · {selected.activityName}</p>
              {selected.description && <p className="text-sm text-ink/70 mt-1 leading-relaxed">{selected.description}</p>}
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

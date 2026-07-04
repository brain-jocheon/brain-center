"use client";

/**
 * "쉽게 보기" — 대표기질을 색상 섹션 + 관점 리프레이밍(약점처럼 보이는 것 → 실제 강점) 표로
 * 간단하게 보여주는 화면. 어려운 용어 대신 2인칭·짧은 문장 위주로 구성했습니다.
 */
import { CANONICAL_NAMES, type MainCode } from "@/lib/content/mtpris/types";
import { SIMPLE_TRAIT_CONTENT } from "@/lib/content/mtpris/simple";

export default function SimpleTraitView({ mainType }: { mainType: MainCode }) {
  const name = CANONICAL_NAMES[mainType];
  const c = SIMPLE_TRAIT_CONTENT[mainType];

  return (
    <div className="space-y-5">
      <section className="card">
        <SectionHeader no={1} title="대표 기질 특성" />
        <div className="rounded-xl border border-sage-200 bg-sage-50 p-4">
          <p className="text-lg font-bold mb-1">
            {c.emoji} {name} ({c.englishName}) - {c.tagline}
          </p>
          <p className="text-sm leading-relaxed mt-2">{c.description}</p>
        </div>
      </section>

      <section className="card">
        <SectionHeader no={2} title="심리적 특징 및 태도" />
        <ul className="space-y-2">
          {c.traits.map((t, i) => (
            <li key={i} className="flex gap-2 text-[14px] leading-relaxed">
              <span className="text-sage-400 shrink-0">•</span>
              <span>{t}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="card">
        <SectionHeader no={3} title="관점 리프레이밍" color="sage" />
        <p className="text-center text-sm bg-sage-50 rounded-lg py-2.5 px-3 mb-3 text-sage-700 font-medium">
          "단점처럼 보이는 행동도 뒤집어보면 강력한 재능입니다."
        </p>
        <div className="space-y-2">
          {c.reframes.map((r, i) => (
            <div key={i} className="rounded-lg border border-sage-100 p-3 text-sm">
              <p className="text-ink/45">{r.weakness}</p>
              <p className="text-sage-700 font-medium mt-1">→ {r.strength}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function SectionHeader({ no, title, color = "ink" }: { no: number; title: string; color?: "ink" | "sage" }) {
  return (
    <div className={`rounded-xl ${color === "sage" ? "bg-sage-600" : "bg-ink"} text-white px-4 py-2.5 text-sm font-semibold mb-4`}>
      {no}. {title}
    </div>
  );
}

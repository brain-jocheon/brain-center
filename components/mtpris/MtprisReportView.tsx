"use client";

/**
 * MT-PRIS 학부모 모바일 리포트
 * ---------------------------------------------------------------------
 * [설계 원칙] 핵심 요약 + 가정 지도법 중심 (조건 2번)
 * - 원자료(MAIN_RAW)와 다짐 문장은 이 화면에 절대 포함하지 않습니다.
 *   (서버가 counselorAppendix를 이미 제거한 데이터만 내려줍니다)
 * - 인쇄용 전체 해석은 관리자 인쇄 화면에서 확인합니다.
 */
import { useState } from "react";
import type { ParentMtprisContent } from "@/lib/mtpris/mask";
import type { ParentPhoto } from "@/lib/types";
import type { MainCode } from "@/lib/content/mtpris/types";
import QuadrantChart from "./QuadrantChart";
import SimpleTraitView from "./SimpleTraitView";
import ActivityAlbumSection from "../ActivityAlbumSection";
import CenterNewsSection from "../CenterNewsSection";

export default function MtprisReportView({
  content,
  childMaskedName,
  childGrade,
  testDate,
  counselor,
  photos,
  blogPhotos,
}: {
  content: ParentMtprisContent;
  childMaskedName: string;
  childGrade: string;
  testDate: string;
  counselor: string;
  photos: ParentPhoto[];
  blogPhotos: ParentPhoto[];
}) {
  const { summary, scoreRows, comparison, trait, rest, talents, learning, career, closingQuote, memo } = content;
  const [mode, setMode] = useState<"detailed" | "simple">("detailed");
  const mainCode = summary.mainName.slice(0, 2) as MainCode;

  return (
    <main className="min-h-screen pb-14">
      <header className="bg-sage-700 text-white px-6 pt-10 pb-14 rounded-b-[2rem]">
        <div className="max-w-md mx-auto">
          <p className="text-xs tracking-widest opacity-80 mb-2">학습심리브레인센터</p>
          <h1 className="text-2xl font-bold leading-snug">
            {childMaskedName} 어린이의
            <br />
            다원재능 MT-PRIS 리포트
          </h1>
          <p className="mt-4 text-sm opacity-85">
            {childGrade} · 검사일 {testDate} · 담당 {counselor}
          </p>
        </div>
      </header>

      <div className="max-w-md mx-auto px-5 -mt-6 space-y-5">
        {/* 핵심 요약 */}
        <section className="card avoid-break">
          <p className="section-label mb-2">한눈에 보는 우리 아이</p>
          <p className="leading-relaxed">{summary.headline}</p>
          <div className="mt-4 grid grid-cols-2 gap-2 text-sm">
            <div className="rounded-xl bg-sage-50 px-3 py-2.5">
              <span className="text-sage-700 font-semibold block text-xs mb-0.5">대표기질</span>
              {summary.mainName}
            </div>
            <div className="rounded-xl bg-apricot-50 px-3 py-2.5">
              <span className="text-apricot-600 font-semibold block text-xs mb-0.5">학습스타일</span>
              {summary.learningName}
            </div>
          </div>
        </section>

        {/* 현재성 그래프 */}
        <section className="card">
          <p className="section-label mb-1">현재성 에너지 그래프</p>
          <p className="text-xs text-ink/50 mb-4">
            점수는 좋고 나쁨이 아니라, 지금 아이가 많이 쓰고 있는 에너지를 보여줍니다.
          </p>
          <QuadrantChart
            scores={{ P: content.scores.P, R: content.scores.R, I: content.scores.I, S: content.scores.S }}
            nativeCode={summary.mainName.charAt(0) as any}
            currentCode={summary.topEnergy.code}
          />
          <ul className="mt-4 space-y-2">
            {scoreRows.map((s) => (
              <li key={s.code} className="text-[13px] flex gap-2">
                <span className="font-semibold shrink-0 w-16">{s.name}</span>
                <span className="text-ink/70">{s.comment}</span>
              </li>
            ))}
          </ul>
        </section>

        {/* 타고난 모습 vs 지금의 모습 */}
        <section className="card bg-sage-50 border-sage-100">
          <p className="section-label mb-2">타고난 모습과 지금의 모습</p>
          <p className="text-[15px] leading-relaxed">{comparison.text}</p>
        </section>

        {/* 쉽게 보기 전환 */}
        <div className="flex justify-center">
          <div className="inline-flex rounded-full bg-white border border-sage-200 p-1 text-sm">
            <button
              className={`px-4 py-1.5 rounded-full transition-colors ${mode === "detailed" ? "bg-sage-600 text-white" : "text-ink/50"}`}
              onClick={() => setMode("detailed")}
            >
              자세히 보기
            </button>
            <button
              className={`px-4 py-1.5 rounded-full transition-colors ${mode === "simple" ? "bg-sage-600 text-white" : "text-ink/50"}`}
              onClick={() => setMode("simple")}
            >
              쉽게 보기
            </button>
          </div>
        </div>

        {mode === "simple" ? (
          <SimpleTraitView mainType={mainCode} />
        ) : (
          <>
            {/* 기질 해석 */}
            <section className="card">
              <p className="section-label mb-3">아이의 기질 특성</p>
              <p className="leading-relaxed mb-4">{trait.summary}</p>
              <ul className="space-y-2 mb-4">
                {trait.features.map((f, i) => (
                  <li key={i} className="flex gap-2.5 text-[15px] leading-relaxed">
                    <span className="text-sage-400 shrink-0">✦</span>
                    <span>{f}</span>
                  </li>
                ))}
              </ul>
              <div className="rounded-xl bg-sage-50 px-4 py-3 text-sm leading-relaxed">
                {trait.one}
              </div>
            </section>

            {/* 힘들 때 모습 / 성장 포인트 */}
            <section className="card">
              <p className="section-label mb-3">힘들 때 보일 수 있는 모습과 성장 포인트</p>
              <p className="text-[15px] leading-relaxed mb-3">{trait.stress}</p>
              <p className="text-[15px] leading-relaxed text-sage-700">{trait.growth}</p>
            </section>

            {/* 회복(쉼) */}
            <section className="card">
              <p className="section-label mb-1">아이가 회복되는 방식</p>
              <p className="text-xs text-ink/50 mb-4">바탕기능: {summary.subName}</p>
              <div className="grid grid-cols-1 gap-3">
                <div>
                  <p className="font-semibold text-sm mb-1.5">충전되는 것</p>
                  <ul className="space-y-1">
                    {rest.charge.map((c, i) => (
                      <li key={i} className="flex gap-2 text-[14px] text-ink/85"><span className="text-sage-400">·</span>{c}</li>
                    ))}
                  </ul>
                </div>
                <div>
                  <p className="font-semibold text-sm mb-1.5">방전되는 것</p>
                  <ul className="space-y-1">
                    {rest.drain.map((c, i) => (
                      <li key={i} className="flex gap-2 text-[14px] text-ink/85"><span className="text-apricot-400">·</span>{c}</li>
                    ))}
                  </ul>
                </div>
              </div>
            </section>

            {/* 부모님 가이드 (학습 지도 중심) */}
            <section className="card bg-apricot-50 border-apricot-100">
              <p className="section-label mb-4 !text-apricot-600">가정에서 이렇게 함께해 주세요</p>
              <GuideBlock title="잘 배우는 환경" items={learning.environment} />
              <GuideBlock title="의욕을 살리는 말" items={learning.motivation} />
              <div className="mb-1">
                <p className="font-semibold text-sm mb-2">부모님 코칭 팁</p>
                <ul className="space-y-1.5">
                  {learning.coaching.map((c, i) => (
                    <li key={i} className="flex gap-2 text-[14px] leading-relaxed text-ink/85"><span className="text-ink/30 shrink-0">·</span><span>{c}</span></li>
                  ))}
                </ul>
              </div>
              <div className="mt-4 rounded-xl bg-white/70 px-4 py-3 text-[13px] text-ink/70 leading-relaxed">
                <strong className="text-apricot-600">주의할 점 · </strong>{learning.caution}
              </div>
            </section>

            {/* 인품재능 (요약) */}
            <section className="card">
              <p className="section-label mb-3">이 아이에게 연결된 인품재능</p>
              <div className="flex flex-wrap gap-1.5 mb-3">
                {talents.performance.map((p) => (
                  <span key={p.name} className="text-xs bg-sage-100 text-sage-700 rounded-full px-3 py-1">{p.name}</span>
                ))}
                {talents.virtues.map((v) => (
                  <span key={v.name} className="text-xs bg-apricot-100 text-apricot-600 rounded-full px-3 py-1">{v.name}</span>
                ))}
              </div>
              <p className="text-xs text-ink/50">
                자세한 설명과 실천 다짐은 센터 상담 시 안내해 드립니다.
              </p>
            </section>

            {/* 진로 힌트 (짧게) */}
            <section className="card">
              <p className="section-label mb-2">먼 훗날을 위한 작은 힌트</p>
              <p className="text-[15px] leading-relaxed mb-3">
                <strong>{career.title}</strong> 유형은 {career.identity}에 가깝습니다. {career.summary}
              </p>
              <div className="flex flex-wrap gap-1.5">
                {career.fields.map((f) => (
                  <span key={f} className="text-xs bg-sage-50 border border-sage-100 rounded-full px-3 py-1">{f}</span>
                ))}
              </div>
            </section>

            {/* 상담 메모 (공개 설정된 경우만) */}
            {memo && (
              <section className="card bg-sage-50 border-sage-100">
                <p className="section-label mb-2">상담 메모</p>
                <p className="text-[14px] leading-relaxed text-ink/80">{memo}</p>
              </section>
            )}
          </>
        )}

        <ActivityAlbumSection photos={photos} />
        <CenterNewsSection photos={blogPhotos} />

        <footer className="text-center text-xs text-ink/45 leading-relaxed pt-2 px-4">
          <p className="mb-3">{closingQuote}</p>
          본 결과지는 보호자 상담 및 가정 지도 참고용이며,
          <br />
          외부 공유를 삼가 주세요.
          <p className="mt-3">ⓒ 학습심리브레인센터</p>
        </footer>
      </div>
    </main>
  );
}

function GuideBlock({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="mb-5">
      <h3 className="font-semibold text-sm mb-2">{title}</h3>
      <ul className="space-y-1.5">
        {items.map((item, i) => (
          <li key={i} className="flex gap-2 text-[14px] leading-relaxed text-ink/85">
            <span className="text-ink/30 shrink-0">·</span>
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

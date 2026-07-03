"use client";

import { useState } from "react";
import Link from "next/link";
import type { MtprisContent } from "@/lib/mtpris/types";
import type { Child } from "@/lib/types";
import QuadrantChart from "@/components/mtpris/QuadrantChart";

/**
 * MT-PRIS A4 인쇄 화면
 * ---------------------------------------------------------------------
 * [보안/정책] "상담사용 부록"(원자료 세계관·두려움·욕망/분노, 다짐 문장, 상담 질문)은
 * 기본적으로 꺼져 있으며, 학부모에게 전달하는 인쇄물에는 제외해야 합니다.
 * → 아래 체크박스(화면 전용, 인쇄되지 않음)로 상담 중 필요할 때만 켜서 확인하세요.
 */
export default function MtprisPrintSheet({
  child,
  content,
  testDate,
  counselor,
}: {
  child: Child;
  content: MtprisContent;
  testDate: string;
  counselor: string;
}) {
  const [includeAppendix, setIncludeAppendix] = useState(false);
  const { summary, scoreRows, prisOverview, comparison, readerCurrent, trait, rest, talents, learning, career, closingQuote, memo, memoPublic, counselorAppendix } = content;
  const nativeCode = summary.mainName.charAt(0) as any;

  return (
    <div className="min-h-screen bg-sage-50/60 py-8 print:py-0 print:bg-white">
      {/* 화면 전용 도구 막대 */}
      <div className="no-print max-w-[210mm] mx-auto mb-4 flex items-center justify-between px-2 flex-wrap gap-3">
        <Link href={`/admin/children/${child.id}`} className="btn-ghost text-sm">‹ 돌아가기</Link>
        <div className="flex items-center gap-4">
          <label className="flex items-center gap-2 text-sm bg-white rounded-full px-4 py-2 border border-sage-200">
            <input type="checkbox" checked={includeAppendix} onChange={(e) => setIncludeAppendix(e.target.checked)} />
            상담사용 부록 포함
            <span className="text-xs text-apricot-600">(학부모 배포용은 체크 해제)</span>
          </label>
          <button className="btn-primary text-sm" onClick={() => window.print()}>
            인쇄하기 / PDF 저장
          </button>
        </div>
      </div>

      <div className="print-sheet text-[13px] leading-relaxed">
        {/* 표지 */}
        <header className="border-b-2 border-sage-700 pb-4 mb-6 avoid-break">
          <p className="text-[11px] tracking-[0.25em] text-sage-600 font-semibold mb-1">
            학습심리브레인센터 · Multiple Talent PRIS
          </p>
          <h1 className="text-[22px] font-bold text-sage-800">다원재능 나를 이해하는 리포트</h1>
          <table className="w-full mt-4 text-[12px]">
            <tbody>
              <tr>
                <InfoCell label="아동 이름" value={child.name} />
                <InfoCell label="학년" value={child.grade} />
                <InfoCell label="검사일" value={testDate} />
              </tr>
              <tr>
                <InfoCell label="대표기능" value={summary.mainName} />
                <InfoCell label="바탕기능" value={summary.subName} />
                <InfoCell label="담당자" value={counselor} />
              </tr>
              <tr>
                <InfoCell label="학습스타일" value={summary.learningName} />
                <InfoCell label="직무적합성" value={career.title} />
                <InfoCell label="발행" value="학습심리브레인센터" />
              </tr>
            </tbody>
          </table>
        </header>

        {/* 1. 현재성 그래프 + PRIS 4에너지 */}
        <section className="avoid-break mb-6">
          <SectionTitle no="1" title="현재성 그래프와 PRIS 네 가지 에너지" />
          <div className="grid grid-cols-[auto_1fr] gap-6 items-start">
            <QuadrantChart
              scores={content.scores}
              nativeCode={nativeCode}
              currentCode={summary.topEnergy.code}
              compact
            />
            <table className="w-full">
              <thead>
                <tr className="text-left text-ink/50">
                  <th className="font-medium pb-1">영역</th>
                  <th className="font-medium pb-1">점수</th>
                  <th className="font-medium pb-1">상담 해석 포인트</th>
                </tr>
              </thead>
              <tbody>
                {scoreRows.map((s) => (
                  <tr key={s.code} className="border-t border-sage-100">
                    <td className="py-1 font-semibold">{s.name}</td>
                    <td className="py-1">{s.score}</td>
                    <td className="py-1">{s.comment}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="grid grid-cols-4 gap-2 mt-4">
            {prisOverview.map((p) => (
              <div key={p.code} className="rounded-lg border border-sage-100 p-2">
                <p className="font-bold text-sage-700 text-[12px]">{p.name}</p>
                <p className="text-[11px] text-ink/70 mt-0.5">{p.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* 2. 타고난 모습과 지금의 모습 */}
        <section className="avoid-break mb-6">
          <SectionTitle no="2" title="타고난 모습과 지금의 모습" />
          <p className="mb-2">{readerCurrent}</p>
          <div className="rounded-lg bg-sage-50 p-3">{comparison.text}</div>
        </section>

        {/* 3. 기질 해석 */}
        <section className="avoid-break mb-6">
          <SectionTitle no="3" title="대표기질 특성과 심리적 특징" />
          <p className="mb-3">{trait.summary}</p>
          <div className="grid grid-cols-2 gap-4">
            <div className="rounded-lg border border-sage-200 p-3">
              <p className="font-bold text-sage-700 mb-1.5">대표기질 특성</p>
              <PrintList items={trait.features} />
            </div>
            <div className="rounded-lg border border-sage-200 p-3">
              <p className="font-bold text-sage-700 mb-1.5">심리적 특징 및 태도</p>
              <PrintList items={trait.psych} />
            </div>
          </div>
          <div className="rounded-lg bg-sage-50 p-3 mt-3">
            <strong>이해하면 좋은 한 문장 · </strong>{trait.one}
          </div>
        </section>

        {/* 4. 기질 특성 더 깊이 보기 */}
        <section className="mb-6">
          <SectionTitle no="4" title="기질 특성 더 깊이 보기" />
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-3">
              <LabeledText label="행동 방식" text={trait.behavior} />
              <LabeledText label="관계 방식" text={trait.relation} />
              <LabeledText label="힘들 때 나타날 수 있는 모습" text={trait.stress} warn />
              <LabeledText label="성장 포인트" text={trait.growth} highlight />
            </div>
            <div className="space-y-3">
              <div className="avoid-break rounded-lg border border-sage-100 p-3">
                <p className="font-bold text-sage-700 mb-1.5">나에게 힘이 되는 방법</p>
                <PrintList items={trait.good} />
              </div>
              <div className="avoid-break rounded-lg border border-apricot-100 p-3">
                <p className="font-bold text-apricot-600 mb-1.5">나를 힘들게 하는 자극</p>
                <PrintList items={trait.bad} />
              </div>
              {includeAppendix && (
                <div className="avoid-break rounded-lg border border-sage-100 p-3">
                  <p className="font-bold text-sage-700 mb-1.5">스스로 생각해볼 질문</p>
                  <PrintList items={counselorAppendix.questions} />
                </div>
              )}
            </div>
          </div>
        </section>

        {/* 5. 바탕기능 회복 */}
        <section className="avoid-break mb-6">
          <SectionTitle no="5" title="바탕기능: 내가 회복되는 방식" />
          <p className="mb-2"><strong>{summary.subName}</strong> · {rest.coach}</p>
          <div className="grid grid-cols-2 gap-4">
            <div className="rounded-lg border border-sage-100 p-3">
              <p className="font-bold text-sage-700 mb-1.5">쉼을 얻는 조건</p>
              <PrintList items={rest.conditions} />
            </div>
            <div className="rounded-lg border border-sage-100 p-3">
              <p className="font-bold text-sage-700 mb-1.5">충전 / 방전</p>
              <p className="text-[12px] mb-1"><strong>충전:</strong> {rest.charge.join(", ")}</p>
              <p className="text-[12px]"><strong>방전:</strong> {rest.drain.join(", ")}</p>
            </div>
          </div>
        </section>

        {/* 6. 인품재능 */}
        <section className="page-break mb-6">
          <SectionTitle no="6" title="인품재능: 수행능력과 덕성능력" />
          <p className="text-[11px] text-ink/50 mb-3">{talents.intro}</p>
          <p className="font-bold text-sage-700 mb-1.5">수행 재능</p>
          <div className="grid grid-cols-3 gap-2 mb-4">
            {talents.performance.map((p) => (
              <div key={p.name} className="avoid-break rounded-lg border border-sage-100 p-2">
                <strong className="text-[12px]">{p.name}</strong>
                <p className="text-[11px] text-ink/70 mt-0.5">{p.desc}</p>
              </div>
            ))}
          </div>
          <p className="font-bold text-sage-700 mb-1.5">덕성 재능</p>
          <div className="flex flex-wrap gap-1.5 mb-2">
            {talents.virtues.map((v) => (
              <span key={v.name} className="text-[11px] bg-apricot-50 border border-apricot-100 rounded-full px-2.5 py-0.5">{v.name}</span>
            ))}
          </div>
          <div className="grid grid-cols-4 gap-2">
            {talents.virtues.map((v) => (
              <div key={v.name} className="avoid-break rounded-lg border border-apricot-100 p-2">
                <strong className="text-[12px]">{v.name}</strong>
                <p className="text-[11px] text-ink/70 mt-0.5">{v.desc}</p>
                <p className="text-[10px] text-ink/40 mt-0.5">보상: {v.reward}</p>
              </div>
            ))}
          </div>

          {includeAppendix && (
            <div className="mt-4 page-break">
              <p className="font-bold text-sage-700 mb-2">나의 다짐 (활동지)</p>
              <div className="grid grid-cols-3 gap-2">
                {[...talents.performance.map((p) => p.name), ...talents.virtues.map((v) => v.name)].map((name) => {
                  const pledgeSrc =
                    counselorAppendix.performancePledges.find((x) => x.name === name) ??
                    counselorAppendix.virtuePledges.find((x) => x.name === name);
                  if (!pledgeSrc) return null;
                  return (
                    <div key={name} className="avoid-break rounded-lg border border-sage-100 p-2">
                      <strong className="text-[12px]">{name} 다짐</strong>
                      <ul className="mt-1 space-y-0.5">
                        {pledgeSrc.pledges.map((pl, i) => (
                          <li key={i} className="text-[10.5px] text-ink/70">☐ {pl}</li>
                        ))}
                      </ul>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </section>

        {/* 7. 학습스타일 */}
        <section className="avoid-break mb-6">
          <SectionTitle no="7" title="학습스타일 해석" />
          <p className="mb-3">{learning.summary}</p>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-3">
              <LabeledText label="잘 배우는 환경" list={learning.environment} />
              <LabeledText label="의욕을 살리는 말" list={learning.motivation} />
            </div>
            <div className="space-y-3">
              <LabeledText label="부모/교사 코칭" list={learning.coaching} />
              <LabeledText label="주의할 점" text={learning.caution} warn />
            </div>
          </div>
        </section>

        {/* 8. 직무적합성 */}
        <section className="avoid-break mb-8">
          <SectionTitle no="8" title="직무적합성 해석" />
          <p className="mb-3"><strong>{career.title}</strong> 유형은 {career.identity}입니다. {career.summary}</p>
          <div className="grid grid-cols-2 gap-4">
            <LabeledText label="직무 강점" list={career.strengths} />
            <div>
              <LabeledText label="추천 역할" list={career.roles} />
              <div className="mt-2"><LabeledText label="추천 분야" list={career.fields} /></div>
            </div>
          </div>
          <div className="rounded-lg border border-apricot-100 p-3 mt-3">
            <strong className="text-apricot-600">주의점 · </strong>{career.caution}
          </div>
          <p className="mt-2">{career.growth}</p>
        </section>

        {/* 상담 메모 */}
        {memo && (
          <section className="avoid-break mb-6 rounded-lg border border-sage-200 p-3">
            <p className="font-bold text-sage-700 mb-1">
              상담 메모 {memoPublic ? "(학부모 공개)" : ""}
            </p>
            <p>{memo}</p>
          </section>
        )}

        {/* 마무리 글귀 */}
        <section className="avoid-break mb-6 rounded-lg bg-sage-50 p-4 text-center">
          {closingQuote}
        </section>

        {/* 상담사용 부록 (원자료) */}
        {includeAppendix && (
          <section className="page-break">
            <div className="mb-3 rounded-lg bg-apricot-50 border border-apricot-200 p-2 text-center text-[11px] text-apricot-600 font-semibold">
              ⚠️ 상담사용 부록 — 학부모 배포용 인쇄에서는 이 페이지를 제외하세요
            </div>
            <SectionTitle no="9" title="상담사용 부록: 원자료 기반 심층 정보" />
            <table className="kv w-full text-[12px]">
              <tbody>
                <tr><th className="text-left text-ink/50 w-24 align-top py-1">키워드</th><td className="py-1">{counselorAppendix.mainRaw.keywords.join(", ")}</td></tr>
                <tr><th className="text-left text-ink/50 align-top py-1">세계관</th><td className="py-1">{counselorAppendix.mainRaw.world}</td></tr>
                <tr><th className="text-left text-ink/50 align-top py-1">살맛</th><td className="py-1">{counselorAppendix.mainRaw.vital}</td></tr>
                <tr><th className="text-left text-ink/50 align-top py-1">구호/두려움</th><td className="py-1">{counselorAppendix.mainRaw.slogan} · 두려움: {counselorAppendix.mainRaw.fear}</td></tr>
                <tr><th className="text-left text-ink/50 align-top py-1">욕망/반응</th><td className="py-1">욕망: {counselorAppendix.mainRaw.desire}<br />긴장 지점: {counselorAppendix.mainRaw.anger}</td></tr>
              </tbody>
            </table>
            <div className="grid grid-cols-2 gap-4 mt-3">
              <div>
                <p className="font-bold text-sage-700 mb-1.5">원자료 기준 강점</p>
                <PrintList items={counselorAppendix.mainRaw.strengths} />
              </div>
              <div>
                <p className="font-bold text-apricot-600 mb-1.5">원자료 기준 주의점</p>
                <PrintList items={counselorAppendix.mainRaw.risks} />
              </div>
            </div>
          </section>
        )}

        <footer className="border-t border-sage-200 pt-3 mt-6 text-center text-[10px] text-ink/50">
          본 결과지는 보호자 상담 및 가정 지도 참고용이며, 외부 공유를 삼가 주세요.
          <span className="mx-2">|</span>ⓒ 학습심리브레인센터
        </footer>
      </div>
    </div>
  );
}

function SectionTitle({ no, title }: { no: string; title: string }) {
  return (
    <h2 className="flex items-center gap-2 text-[15px] font-bold text-sage-800 mb-2.5">
      <span
        className="inline-flex w-5 h-5 items-center justify-center rounded-full bg-sage-700 text-white text-[11px]"
        style={{ printColorAdjust: "exact", WebkitPrintColorAdjust: "exact" }}
      >
        {no}
      </span>
      {title}
    </h2>
  );
}

function InfoCell({ label, value }: { label: string; value: string }) {
  return (
    <>
      <td className="py-1 pr-2 text-ink/50 whitespace-nowrap w-[70px]">{label}</td>
      <td className="py-1 pr-6 font-medium">{value}</td>
    </>
  );
}

function PrintList({ items }: { items: string[] }) {
  return (
    <ul className="space-y-1">
      {items.map((s, i) => (
        <li key={i} className="flex gap-1.5">
          <span className="text-ink/40">·</span>
          <span>{s}</span>
        </li>
      ))}
    </ul>
  );
}

function LabeledText({
  label, text, list, warn, highlight,
}: { label: string; text?: string; list?: string[]; warn?: boolean; highlight?: boolean }) {
  return (
    <div className={`avoid-break rounded-lg p-3 border ${warn ? "border-apricot-100 bg-apricot-50/40" : highlight ? "border-sage-200 bg-sage-50" : "border-sage-100"}`}>
      <p className="font-bold text-sage-700 mb-1">{label}</p>
      {text && <p>{text}</p>}
      {list && <PrintList items={list} />}
    </div>
  );
}

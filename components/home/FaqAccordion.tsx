"use client";

/**
 * 홈페이지 FAQ 아코디언 — 클릭하면 펼쳐지는 자주 묻는 질문 목록.
 */

import { useState } from "react";

const FAQS: { q: string; a: string }[] = [
  {
    q: "검사는 몇 세부터 가능한가요?",
    a: "유아부터 청소년까지 폭넓게 진행하고 있어요. 검사 종류에 따라 적정 연령이 조금씩 달라서, 정확한 안내는 상담 시 편하게 문의해 주세요.",
  },
  {
    q: "뉴로피드백은 어떤 아이에게 도움이 되나요?",
    a: "산만함, 집중 유지의 어려움, 긴장, 학습 피로, 자기조절이 어려운 아이에게 도움이 될 수 있어요. 아이 상태를 먼저 살펴본 뒤 필요 여부를 함께 안내해 드립니다.",
  },
  {
    q: "검사만 받아도 되나요?",
    a: "네, 가능합니다. 검사와 해석 상담만 진행하셔도 되고, 이후 필요에 따라 프로그램을 이어가실 수도 있어요.",
  },
  {
    q: "바우처 이용이 가능한가요?",
    a: "네, 아동청소년심리지원서비스·아동청소년비전형성서비스 바우처를 이용하실 수 있어요. 대상 여부는 상담 시 함께 확인해 드립니다.",
  },
  {
    q: "수업은 주 몇 회 진행되나요?",
    a: "프로그램과 아이 상황에 따라 달라져요. 초기 상담에서 아이에게 맞는 빈도를 함께 정합니다.",
  },
  {
    q: "부모 상담도 포함되나요?",
    a: "네, 검사 결과 해석과 가정 지도 방향 안내를 위해 부모님 상담을 함께 진행하고 있어요.",
  },
  {
    q: "아이가 낯을 많이 가리는데 괜찮을까요?",
    a: "처음엔 낯설어하는 아이도 많아요. 아이의 속도에 맞춰 천천히 적응할 수 있도록 살펴봐 드릴게요.",
  },
  {
    q: "학습 문제가 없어도 기질검사를 받을 수 있나요?",
    a: "그럼요. 기질검사는 문제를 찾기 위한 검사가 아니라 아이를 더 깊이 이해하기 위한 검사라, 학습에 어려움이 없는 아이도 많이 받고 있어요.",
  },
  {
    q: "결과지는 어떻게 확인하나요?",
    a: "문자 또는 카카오톡으로 전달드리는 개별 링크로 확인하실 수 있어요. 이 페이지 아래쪽 \"학부모 안내\"에서도 확인하실 수 있습니다.",
  },
  {
    q: "초기 상담은 어떻게 예약하나요?",
    a: "아래 상담 문의 버튼이나 전화로 편하게 연락 주시면, 상담 일정을 함께 잡아드릴게요.",
  },
];

export default function FaqAccordion() {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  return (
    <div className="max-w-2xl mx-auto space-y-2.5">
      {FAQS.map((item, i) => {
        const open = openIndex === i;
        return (
          <div key={i} className="card !p-0 overflow-hidden">
            <button
              type="button"
              onClick={() => setOpenIndex(open ? null : i)}
              className="w-full flex items-center justify-between gap-3 px-5 py-4 text-left"
            >
              <span className="font-medium text-[15px]">
                <span className="text-sage-600 mr-2">Q.</span>
                {item.q}
              </span>
              <span className={`text-sage-400 shrink-0 transition-transform ${open ? "rotate-45" : ""}`}>＋</span>
            </button>
            {open && (
              <div className="px-5 pb-4 text-sm text-ink/70 leading-relaxed">
                <span className="text-apricot-600 font-semibold mr-2">A.</span>
                {item.a}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

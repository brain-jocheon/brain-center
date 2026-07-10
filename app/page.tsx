import Link from "next/link";
import { getSiteSettings, getNotices, DEFAULT_ABOUT_TEXT } from "@/lib/data";
import type { SiteSettings, Notice } from "@/lib/types";
import HomeParentLogin from "@/components/HomeParentLogin";
import FaqAccordion from "@/components/home/FaqAccordion";

/**
 * 첫 화면 (상담 문의 전환 중심 홈페이지)
 * ---------------------------------------------------------------------
 * 학부모는 문자/카카오톡으로 받은 개별 링크로 바로 결과지에 접속하므로,
 * 이 화면은 (1) 검색 등으로 처음 들어온 방문자가 센터를 신뢰하고 상담
 * 문의로 이어지도록 안내하고 (2) 링크를 잘못 못 받은 분들을 안내하는
 * 역할을 함께 합니다.
 *
 * [주의] 실제 아이 얼굴이 담긴 사진은 노출하지 않습니다. 활동 사진/소식은
 * "로그인한 학부모에게만" 보여주기로 정한 기존 결정과 충돌하지 않도록,
 * 공개 화면에는 안내 문구와 아이콘 플레이스홀더만 둡니다.
 *
 * [주의] 상담 문의 버튼은 실제로 연결된 채널(전화번호)이 있을 때만 tel:
 * 링크로 걸고, 없으면 #contact 섹션(주소·안내 문구)으로 스크롤만 하도록
 * 처리했습니다 — 존재하지 않는 카카오톡 채널 등을 임의로 만들어 링크하지
 * 않습니다.
 *
 * 센터소개/위치/연락처/공지사항은 관리자 화면(/admin/site)에서 편집하며,
 * 여기서는 그 값을 그대로 불러와 보여줍니다. site_settings/notices 테이블이
 * 아직 마이그레이션 전이어도(운영 배포 순서상 코드가 먼저 나갈 수 있음)
 * 공개 홈페이지가 깨지지 않도록 안전한 기본값으로 대체합니다.
 */
export const dynamic = "force-dynamic";

const RECOMMEND_ITEMS = [
  "집중 시간이 짧고 쉽게 산만해지는 아이",
  "공부를 시작하기까지 시간이 오래 걸리는 아이",
  "감정 기복이 크거나 예민한 아이",
  "자신감이 부족하고 “못해요”라는 말을 자주 하는 아이",
  "친구 관계에서 위축되거나 갈등이 잦은 아이",
  "학습보다 먼저 정서 안정과 자기조절이 필요한 아이",
  "검사 결과를 바탕으로 아이를 더 깊이 이해하고 싶은 부모님",
];

const DIFF_POINTS = [
  { title: "기질과 정서를 함께 살펴봅니다", desc: "학습 문제만 보지 않고, 아이의 타고난 기질과 마음 상태를 함께 살펴봅니다." },
  { title: "뇌기능검사와 뉴로피드백 훈련을 연결합니다", desc: "검사에서 확인한 지표를 바탕으로 아이에게 필요한 훈련 방향을 제안합니다." },
  { title: "검사 결과를 실제 수업과 상담에 반영합니다", desc: "검사로 끝나지 않고, 결과가 수업 설계와 상담 내용에 그대로 이어집니다." },
  { title: "가정 지도 방향까지 안내합니다", desc: "부모 상담을 통해 집에서도 실천할 수 있는 방법을 함께 나눕니다." },
  { title: "아이의 작은 변화까지 관찰합니다", desc: "매 수업의 관찰 내용을 기록하고, 변화의 흐름을 놓치지 않습니다." },
  { title: "흥미와 성취감을 함께 키웁니다", desc: "만들기·요리·창작 활동으로 배움을 즐겁게 경험하도록 돕습니다." },
];

const PROGRAMS = [
  {
    emoji: "🧠",
    title: "뉴로피드백 두뇌훈련",
    sub: "파낙토스 기반",
    intro: "뇌파를 측정해 집중력·정서조절과 관련된 뇌기능을 훈련하는 프로그램입니다. 파낙토스 장비를 기반으로 진행합니다.",
    who: "집중을 유지하기 어렵거나, 산만함·과잉행동, 정서 기복이 있는 아이",
    how: "뇌파 측정 후 아이에게 맞는 훈련 프로그램을 설계하고, 정기적으로 훈련하며 변화를 관찰합니다.",
    result: "집중 시간이 늘고, 스스로 감정을 조절하는 힘이 자라는 데 도움이 될 수 있습니다.",
  },
  {
    emoji: "📊",
    title: "뇌기능검사 및 해석 상담",
    sub: "",
    intro: "핵심 뇌기능 지표를 검사하고, 그 결과를 부모님이 이해하기 쉽게 풀어드리는 해석 상담입니다.",
    who: "집중력, 학습 능력, 정서 상태를 객관적으로 확인하고 싶은 모든 아이",
    how: "검사 진행 후 전문 상담사가 결과를 함께 살펴보며 아이의 강점과 보완이 필요한 부분을 안내합니다.",
    result: "아이의 행동 뒤에 있는 이유를 이해하고, 이후 방향을 정하는 데 도움이 됩니다.",
  },
  {
    emoji: "🧭",
    title: "다원재능 기질검사",
    sub: "MT-PRIS",
    intro: "타고난 기질과 재능을 살펴보는 검사로, 아이의 학습 스타일과 성향을 함께 확인합니다.",
    who: "자신에게 맞는 학습 방법을 찾고 싶은 아이, 기질을 깊이 이해하고 싶은 부모님",
    how: "검사 후 모바일 리포트로 결과를 전달하고, 상담을 통해 자세히 안내합니다.",
    result: "아이의 강점을 발견하고, 맞춤형 학습·양육 방향을 세우는 데 도움이 됩니다.",
  },
  {
    emoji: "🌱",
    title: "정서·자존감 성장 프로그램",
    sub: "",
    intro: "감정을 알아차리고 표현하는 힘, 자기 자신을 긍정적으로 바라보는 힘을 키우는 프로그램입니다.",
    who: "자신감이 부족하거나, 감정 표현이 서툴거나, 예민하고 위축된 아이",
    how: "놀이와 활동 중심으로 감정을 다루는 연습을 하며, 아이의 속도에 맞춰 진행합니다.",
    result: "자신을 더 편안하게 받아들이고, 감정을 조절하는 힘이 자라는 데 도움이 됩니다.",
  },
  {
    emoji: "🎯",
    title: "진로탐색 및 자기주도학습 프로그램",
    sub: "",
    intro: "아이의 흥미와 강점을 탐색하고, 스스로 학습을 계획하고 실천하는 힘을 키우는 프로그램입니다.",
    who: "학습 동기가 낮거나, 스스로 공부 계획을 세우기 어려워하는 아이",
    how: "검사 결과와 상담을 바탕으로 아이의 흥미 영역을 탐색하고, 실천 가능한 학습 습관을 함께 만듭니다.",
    result: "공부를 스스로 해내는 경험이 쌓이며 학습 태도가 안정되는 데 도움이 됩니다.",
  },
  {
    emoji: "🎨",
    title: "만들기·요리·창작 활동",
    sub: "",
    intro: "손을 움직이며 결과물을 완성하는 활동을 통해 성취감과 즐거움을 경험하는 프로그램입니다.",
    who: "학습에 부담을 느끼거나, 성취 경험이 부족한 아이",
    how: "만들기·요리·창작 활동을 통해 계획하고 완성하는 과정을 자연스럽게 익힙니다.",
    result: "작은 성공 경험이 쌓이며 자신감과 집중력이 함께 자라는 데 도움이 됩니다.",
  },
  {
    emoji: "🤝",
    title: "바우처 서비스",
    sub: "아동청소년심리지원 · 비전형성",
    intro: "정부·지자체 바우처를 통해 심리지원 및 비전형성 프로그램을 이용하실 수 있습니다.",
    who: "바우처 대상에 해당하는 아동·청소년",
    how: "대상 여부 확인 후 아이에게 맞는 프로그램으로 연결해 드립니다.",
    result: "부담을 낮추고 꾸준히 프로그램에 참여하는 데 도움이 됩니다.",
  },
];

const FLOW_STEPS = [
  { n: 1, title: "상담 문의", desc: "전화 또는 상담 문의로 편하게 시작하세요." },
  { n: 2, title: "초기 상담 및 검사 안내", desc: "아이의 상황을 듣고, 필요한 검사를 안내해 드립니다." },
  { n: 3, title: "뇌기능검사 / 기질검사 진행", desc: "아이에게 맞는 검사를 진행합니다." },
  { n: 4, title: "결과 해석 상담", desc: "검사 결과를 이해하기 쉽게 함께 살펴봅니다." },
  { n: 5, title: "아이 맞춤 프로그램 진행", desc: "결과를 바탕으로 아이에게 맞는 프로그램을 진행합니다." },
  { n: 6, title: "변화 관찰 및 부모 상담", desc: "변화를 기록하고, 부모님과 꾸준히 소통합니다." },
];

const PARENT_BENEFITS = [
  "왜 아이가 쉽게 산만해지는지 이해할 수 있어요",
  "아이의 기질과 학습 스타일을 알 수 있어요",
  "감정 기복과 예민함의 원인을 이해할 수 있어요",
  "집에서 실천할 수 있는 칭찬·지도 방법을 알 수 있어요",
  "센터 수업을 통해 어떤 방향으로 성장할 수 있는지 알 수 있어요",
];

const TESTIMONIALS = [
  "아이를 혼내기 전에 먼저 이해하게 되었어요.",
  "검사 결과를 듣고 아이의 행동을 다르게 보게 되었어요.",
  "공부 문제라고만 생각했는데 정서와 기질도 중요하다는 걸 알게 되었어요.",
  "아이가 수업을 부담스러워하지 않고 즐겁게 참여해요.",
  "작은 변화도 함께 봐주셔서 안심이 되었어요.",
];

const GALLERY_PLACEHOLDERS = [
  { emoji: "🏠", label: "센터 내부 공간" },
  { emoji: "🧠", label: "뉴로피드백 훈련 공간" },
  { emoji: "✂️", label: "만들기 활동 결과물" },
  { emoji: "🍳", label: "요리 활동 준비물" },
  { emoji: "📝", label: "수업 활동지" },
  { emoji: "🍂", label: "계절별 프로그램 모습" },
  { emoji: "🗂️", label: "검사 및 상담 공간" },
];

export default async function Home() {
  let settings: SiteSettings = { aboutText: DEFAULT_ABOUT_TEXT, updatedAt: "" };
  let notices: Notice[] = [];
  try {
    settings = await getSiteSettings();
  } catch {
    // site_settings 테이블 마이그레이션 전 — 기본 문구로 대체
  }
  try {
    notices = await getNotices();
  } catch {
    // notices 테이블 마이그레이션 전 — 공지 없음으로 대체
  }

  const phoneDigits = settings.phone ? settings.phone.replace(/[^0-9+]/g, "") : "";
  const contactHref = phoneDigits ? `tel:${phoneDigits}` : "#contact";

  return (
    <main className="min-h-screen">
      {/* 상단 네비게이션 */}
      <header className="sticky top-0 z-30 bg-linen/90 backdrop-blur border-b border-sage-100">
        <div className="max-w-5xl mx-auto px-5 sm:px-6 h-16 flex items-center justify-between gap-3">
          <span className="font-bold text-ink tracking-tight shrink-0">학습심리브레인센터</span>
          <nav className="hidden md:flex items-center gap-6 text-sm text-ink/70">
            <a href="#recommend" className="hover:text-sage-700 transition-colors">이런 아이라면</a>
            <a href="#programs" className="hover:text-sage-700 transition-colors">프로그램</a>
            <a href="#flow" className="hover:text-sage-700 transition-colors">이용 안내</a>
            <a href="#reviews" className="hover:text-sage-700 transition-colors">이야기</a>
            <a href="#faq" className="hover:text-sage-700 transition-colors">FAQ</a>
          </nav>
          <div className="flex items-center gap-3 shrink-0">
            <Link href="/admin" className="hidden sm:inline text-xs text-sage-400 underline underline-offset-4">
              센터 관리자 입장
            </Link>
            <a href={contactHref} className="btn-primary !px-4 !py-2 text-sm">
              상담 문의
            </a>
          </div>
        </div>
      </header>

      {/* 히어로 */}
      <section className="bg-sage-800 text-white px-6 pt-16 pb-24">
        <div className="max-w-3xl mx-auto text-center">
          <p className="section-label !text-sage-200 mb-4">제주 조천 아동·청소년 성장지원센터</p>
          <h1 className="text-3xl sm:text-4xl font-bold leading-snug mb-5">
            아이의 집중력, 감정, 학습 태도에는
            <br />
            <span className="text-sage-200">반드시 이유가 있습니다.</span>
          </h1>
          <p className="text-sage-100/90 text-[15px] sm:text-base leading-relaxed mb-9 max-w-xl mx-auto">
            학습심리브레인센터는 기질검사, 뇌기능검사, 뉴로피드백 훈련, 정서·자존감
            프로그램을 통해 우리 아이에게 맞는 성장 방향을 함께 찾아갑니다.
          </p>
          <div className="flex items-center justify-center gap-3 flex-wrap">
            <a href={contactHref} className="btn-primary !bg-white !text-sage-800 hover:!bg-sage-50">
              우리 아이 상담 문의하기
            </a>
            <a
              href="#programs"
              className="inline-flex items-center justify-center rounded-full border border-white/30 px-6 py-3 text-white font-medium hover:bg-white/10 transition-colors"
            >
              프로그램 자세히 보기
            </a>
          </div>
        </div>
      </section>

      <div className="max-w-5xl mx-auto px-5 sm:px-6">
        {/* 이런 아이에게 추천해요 */}
        <section id="recommend" className="scroll-mt-20 -mt-12 mb-20">
          <div className="card max-w-3xl mx-auto py-9 px-6 sm:px-9">
            <p className="section-label mb-2 text-center">이런 아이에게 추천해요</p>
            <h2 className="text-xl sm:text-2xl font-bold text-center mb-7">
              혹시, 우리 아이 이야기 같지 않으신가요?
            </h2>
            <ul className="space-y-3 max-w-xl mx-auto mb-8">
              {RECOMMEND_ITEMS.map((item) => (
                <li key={item} className="flex gap-2.5 text-[15px] leading-relaxed">
                  <span className="text-sage-600 font-bold shrink-0">✓</span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
            <div className="text-center">
              <p className="text-sm text-ink/60 mb-4">하나라도 해당된다면, 편하게 상담부터 받아보세요.</p>
              <a href={contactHref} className="btn-primary">상담 문의하기</a>
            </div>
          </div>
        </section>

        {/* 차별점 */}
        <section id="diff" className="scroll-mt-20 mb-20">
          <div className="text-center mb-9">
            <p className="section-label mb-2">학습심리브레인센터가 다른 점</p>
            <h2 className="text-xl sm:text-2xl font-bold leading-snug max-w-2xl mx-auto">
              검사, 상담, 두뇌훈련, 정서활동을 따로따로 하지 않고
              <br className="hidden sm:block" />
              아이 한 명의 성장 흐름 안에서 연결합니다.
            </h2>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {DIFF_POINTS.map((p) => (
              <div key={p.title} className="card">
                <p className="font-bold mb-1.5 leading-snug">{p.title}</p>
                <p className="text-sm text-ink/60 leading-relaxed">{p.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* 센터 소개 */}
        <section id="about" className="scroll-mt-20 mb-20">
          <div className="card max-w-3xl mx-auto py-10 px-8 text-center">
            <p className="section-label mb-3">센터 소개</p>
            <p className="text-[15px] sm:text-base leading-loose text-ink/80 whitespace-pre-line">
              {settings.aboutText}
            </p>
            {(settings.address || settings.phone) && (
              <div className="mt-6 pt-6 border-t border-sage-100 flex flex-wrap items-center justify-center gap-x-6 gap-y-1 text-sm text-ink/60">
                {settings.address && <span>📍 {settings.address}</span>}
                {settings.phone && <span>📞 {settings.phone}</span>}
              </div>
            )}
          </div>
        </section>

        {/* 프로그램 상세 */}
        <section id="programs" className="scroll-mt-20 mb-20">
          <div className="text-center mb-9">
            <p className="section-label mb-2">프로그램 안내</p>
            <h2 className="text-xl sm:text-2xl font-bold">아이에게 필요한 것을 정확히 찾아드려요</h2>
          </div>
          <div className="grid sm:grid-cols-2 gap-5">
            {PROGRAMS.map((p) => (
              <div key={p.title} className="card">
                <div className="flex items-start gap-3 mb-3">
                  <span className="text-2xl shrink-0">{p.emoji}</span>
                  <div>
                    <p className="font-bold leading-snug">{p.title}</p>
                    {p.sub && <p className="text-xs text-sage-600">{p.sub}</p>}
                  </div>
                </div>
                <p className="text-sm text-ink/70 leading-relaxed mb-3">{p.intro}</p>
                <dl className="space-y-2 text-[13px] mb-4">
                  <div className="flex gap-2">
                    <dt className="shrink-0 text-ink/40 w-16">이런 아이</dt>
                    <dd className="text-ink/70 leading-relaxed">{p.who}</dd>
                  </div>
                  <div className="flex gap-2">
                    <dt className="shrink-0 text-ink/40 w-16">진행 방식</dt>
                    <dd className="text-ink/70 leading-relaxed">{p.how}</dd>
                  </div>
                  <div className="flex gap-2">
                    <dt className="shrink-0 text-ink/40 w-16">기대 변화</dt>
                    <dd className="text-ink/70 leading-relaxed">{p.result}</dd>
                  </div>
                </dl>
                <a href={contactHref} className="btn-ghost !py-2 text-sm w-full">
                  이 프로그램 문의하기
                </a>
              </div>
            ))}
          </div>
        </section>

        {/* 센터 이용 흐름 */}
        <section id="flow" className="scroll-mt-20 mb-20">
          <div className="text-center mb-9">
            <p className="section-label mb-2">센터 이용 흐름</p>
            <h2 className="text-xl sm:text-2xl font-bold">이렇게 진행돼요</h2>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {FLOW_STEPS.map((s) => (
              <div key={s.n} className="card flex gap-3.5 items-start">
                <span className="shrink-0 w-8 h-8 rounded-full bg-sage-600 text-white text-sm font-bold flex items-center justify-center">
                  {s.n}
                </span>
                <div>
                  <p className="font-bold mb-1">{s.title}</p>
                  <p className="text-sm text-ink/60 leading-relaxed">{s.desc}</p>
                </div>
              </div>
            ))}
          </div>
          <div className="text-center mt-8">
            <a href={contactHref} className="btn-primary">상담 문의하기</a>
          </div>
        </section>

        {/* 부모님이 얻을 수 있는 것 */}
        <section id="parentbenefit" className="scroll-mt-20 mb-20">
          <div className="card max-w-3xl mx-auto py-9 px-6 sm:px-9 !bg-sage-50 !border-sage-100">
            <p className="section-label mb-2 text-center">부모님이 얻을 수 있는 것</p>
            <h2 className="text-xl sm:text-2xl font-bold text-center mb-7">
              검사와 상담을 통해 이런 것들을 알 수 있어요
            </h2>
            <ul className="space-y-3 max-w-xl mx-auto">
              {PARENT_BENEFITS.map((item) => (
                <li key={item} className="flex gap-2.5 text-[15px] leading-relaxed">
                  <span className="text-sage-600 shrink-0">🌿</span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* 공지사항 (관리자 화면에서 작성, 로그인 없이 누구나 열람 가능) */}
        {notices.length > 0 && (
          <section id="notices" className="scroll-mt-20 mb-20">
            <div className="text-center mb-8">
              <p className="section-label mb-2">공지사항</p>
              <h2 className="text-xl sm:text-2xl font-bold">센터 소식을 전해드려요</h2>
            </div>
            <div className="max-w-2xl mx-auto space-y-3">
              {notices.slice(0, 5).map((n) => (
                <div key={n.id} className="card">
                  <div className="flex items-baseline justify-between gap-3 mb-1.5">
                    <p className="font-bold">{n.title}</p>
                    <p className="text-xs text-ink/35 shrink-0">{n.createdAt.slice(0, 10)}</p>
                  </div>
                  <p className="text-sm text-ink/70 whitespace-pre-line leading-relaxed">{n.body}</p>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* 후기/신뢰 */}
        <section id="reviews" className="scroll-mt-20 mb-20">
          <div className="text-center mb-3">
            <p className="section-label mb-2">학부모님들의 이야기</p>
            <h2 className="text-xl sm:text-2xl font-bold">학부모님들이 상담 후 자주 말씀하시는 변화</h2>
          </div>
          <p className="text-center text-xs text-ink/45 mb-8 max-w-md mx-auto leading-relaxed">
            아래 내용은 실제 상담 과정에서 학부모님들이 자주 나누어 주시는 이야기를
            바탕으로 정리했습니다.
          </p>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {TESTIMONIALS.map((t) => (
              <div key={t} className="card py-6 px-5 !bg-apricot-50 !border-apricot-100">
                <p className="text-[15px] leading-relaxed text-ink/80">
                  <span className="text-apricot-600 mr-1">“</span>
                  {t}
                  <span className="text-apricot-600 ml-1">”</span>
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* 사진 및 활동 기록 */}
        <section id="gallery" className="scroll-mt-20 mb-20">
          <div className="text-center mb-8">
            <p className="section-label mb-2">센터 둘러보기</p>
            <h2 className="text-xl sm:text-2xl font-bold">이런 공간에서, 이런 활동을 해요</h2>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
            {GALLERY_PLACEHOLDERS.map((g) => (
              <div key={g.label} className="card py-7 px-3 text-center">
                <p className="text-3xl mb-2.5">{g.emoji}</p>
                <p className="text-sm font-medium text-ink/70">{g.label}</p>
              </div>
            ))}
          </div>
          <p className="text-center text-xs text-ink/40 mt-6 leading-relaxed">
            아이들의 얼굴이 담긴 사진은 개인정보 보호를 위해 게시하지 않으며, 공간과
            활동 사진은 순차적으로 채워나갈 예정입니다. 우리 아이의 실제 활동 사진은
            전용 리포트 링크에 로그인하시면 확인하실 수 있습니다.
          </p>
        </section>

        {/* FAQ */}
        <section id="faq" className="scroll-mt-20 mb-20">
          <div className="text-center mb-9">
            <p className="section-label mb-2">자주 묻는 질문</p>
            <h2 className="text-xl sm:text-2xl font-bold">궁금하신 점을 미리 확인해 보세요</h2>
          </div>
          <FaqAccordion />
        </section>

        {/* 학부모 안내 */}
        <section id="parents" className="scroll-mt-20 mb-20">
          <div className="card max-w-md mx-auto text-center py-10">
            <p className="section-label mb-3">학부모 안내</p>
            <h3 className="text-lg font-bold mb-4">아이 성장 결과 리포트</h3>
            <p className="text-sm leading-relaxed text-ink/70 mb-8">
              검사 결과지는 문자 또는 카카오톡으로 전달된
              <br />
              개별 링크를 통해 확인하실 수 있습니다.
              <br />
              링크를 받지 못하셨다면 센터로 문의해 주세요.
            </p>
            <Link href="/admin" className="text-xs text-sage-400 underline underline-offset-4">
              센터 관리자 입장
            </Link>
            <HomeParentLogin />
          </div>
        </section>

        {/* 상담 문의 CTA */}
        <section id="contact" className="scroll-mt-20 mb-20">
          <div className="card max-w-2xl mx-auto text-center py-11 px-6 sm:px-10 !bg-sage-800 !text-white !border-sage-800 !shadow-none">
            <h2 className="text-xl sm:text-2xl font-bold leading-snug mb-3">
              우리 아이에게 맞는 방법이 궁금하다면,
              <br />
              먼저 상담으로 시작해보세요.
            </h2>
            {(settings.address || settings.phone) && (
              <p className="text-sm text-sage-100/90 mb-7">
                {settings.address && <>📍 {settings.address}</>}
                {settings.address && settings.phone && <span className="mx-2">·</span>}
                {settings.phone && <>📞 {settings.phone}</>}
              </p>
            )}
            {!settings.phone && (
              <p className="text-sm text-sage-100/80 mb-7">
                전화 상담 연결을 준비 중입니다. 아래 학부모 안내를 확인하시거나,
                센터로 직접 문의해 주세요.
              </p>
            )}
            <div className="flex flex-wrap items-center justify-center gap-2.5">
              <a href={contactHref} className="btn-primary !bg-white !text-sage-800 hover:!bg-sage-50">
                상담 문의하기
              </a>
              <a
                href={contactHref}
                className="inline-flex items-center justify-center rounded-full border border-white/30 px-6 py-3 text-white font-medium hover:bg-white/10 transition-colors"
              >
                전화 상담하기
              </a>
              <a
                href={contactHref}
                className="inline-flex items-center justify-center rounded-full border border-white/30 px-6 py-3 text-white font-medium hover:bg-white/10 transition-colors"
              >
                카카오톡 문의하기
              </a>
              <a
                href={contactHref}
                className="inline-flex items-center justify-center rounded-full border border-white/30 px-6 py-3 text-white font-medium hover:bg-white/10 transition-colors"
              >
                무료체험·초기상담 신청하기
              </a>
            </div>
          </div>
        </section>
      </div>

      <footer className="border-t border-sage-100 py-8 text-center text-xs text-ink/40">
        ⓒ 학습심리브레인센터
      </footer>
    </main>
  );
}

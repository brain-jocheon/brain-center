import Link from "next/link";
import { getSiteSettings, getNotices, DEFAULT_ABOUT_TEXT } from "@/lib/data";
import type { SiteSettings, Notice } from "@/lib/types";

/**
 * 첫 화면 (센터 소개형 홈페이지)
 * ---------------------------------------------------------------------
 * 학부모는 문자/카카오톡으로 받은 개별 링크로 바로 결과지에 접속하므로,
 * 이 화면은 (1) 검색 등으로 처음 들어온 방문자에게 센터를 소개하고
 * (2) 링크를 잘못 못 받은 분들을 안내하는 역할을 함께 합니다.
 *
 * [주의] 센터 소식 섹션은 실제 아이 활동 사진을 노출하지 않습니다.
 * 활동 사진/소식은 "로그인한 학부모에게만" 보여주기로 정한 기존 결정과
 * 충돌하지 않도록, 여기서는 안내 문구만 두고 실제 사진은 넣지 않습니다.
 *
 * 센터소개/위치/연락처/공지사항은 관리자 화면(/admin/site)에서 편집하며,
 * 여기서는 그 값을 그대로 불러와 보여줍니다. site_settings/notices 테이블이
 * 아직 마이그레이션 전이어도(운영 배포 순서상 코드가 먼저 나갈 수 있음)
 * 공개 홈페이지가 깨지지 않도록 안전한 기본값으로 대체합니다.
 */
export const dynamic = "force-dynamic";

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

  return (
    <main className="min-h-screen">
      {/* 상단 네비게이션 */}
      <header className="sticky top-0 z-30 bg-linen/90 backdrop-blur border-b border-sage-100">
        <div className="max-w-5xl mx-auto px-6 h-16 flex items-center justify-between">
          <span className="font-bold text-ink tracking-tight">학습심리브레인센터</span>
          <nav className="hidden sm:flex items-center gap-7 text-sm text-ink/70">
            <a href="#about" className="hover:text-sage-700 transition-colors">센터소개</a>
            <a href="#services" className="hover:text-sage-700 transition-colors">제공 서비스</a>
            <a href="#news" className="hover:text-sage-700 transition-colors">센터 소식</a>
            <a href="#parents" className="hover:text-sage-700 transition-colors">학부모 안내</a>
          </nav>
          <Link href="/admin" className="text-xs text-sage-400 underline underline-offset-4 shrink-0">
            센터 관리자 입장
          </Link>
        </div>
      </header>

      {/* 히어로 */}
      <section className="bg-sage-800 text-white px-6 pt-20 pb-28">
        <div className="max-w-3xl mx-auto text-center">
          <p className="section-label !text-sage-200 mb-4">CHILD GROWTH &amp; PSYCHOLOGY CENTER</p>
          <h1 className="text-3xl sm:text-4xl font-bold leading-snug mb-5">
            아이의 기질과 마음을 이해하는
            <br />
            <span className="text-sage-200">가장 정확한 첫걸음</span>
          </h1>
          <p className="text-sage-100/90 text-[15px] sm:text-base leading-relaxed mb-9 max-w-xl mx-auto">
            기질 · 정서 · 학습 · 뇌기능을 함께 살펴보고, 우리 아이에게 꼭 맞는
            성장 방향을 제안해 드립니다.
          </p>
          <div className="flex items-center justify-center gap-3 flex-wrap">
            <a href="#about" className="btn-primary bg-white !text-sage-800 hover:!bg-sage-50">
              센터 소개 보기
            </a>
            <a
              href="#parents"
              className="inline-flex items-center justify-center rounded-full border border-white/30 px-6 py-3 text-white font-medium hover:bg-white/10 transition-colors"
            >
              학부모이신가요?
            </a>
          </div>
        </div>
      </section>

      <div className="max-w-5xl mx-auto px-6">
        {/* 센터 소개 */}
        <section id="about" className="scroll-mt-20 -mt-14 mb-16">
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

        {/* 제공 서비스 */}
        <section id="services" className="scroll-mt-20 mb-20">
          <div className="text-center mb-8">
            <p className="section-label mb-2">제공 서비스</p>
            <h2 className="text-xl sm:text-2xl font-bold">아이에게 필요한 것을 정확히 찾아드려요</h2>
          </div>
          <div className="grid sm:grid-cols-3 gap-4">
            <ServiceCard
              emoji="🧭"
              title="기질검사 (MT-PRIS)"
              desc="타고난 기질과 지금의 모습을 함께 살펴보고, 아이의 강점과 학습 방향을 알려드립니다."
            />
            <ServiceCard
              emoji="🧠"
              title="뇌기능검사 · 뉴로피드백"
              desc="핵심 뇌기능 지표를 확인하고, 훈련을 통해 집중력과 정서 조절을 함께 키워갑니다."
            />
            <ServiceCard
              emoji="🌱"
              title="정서 · 자존감 프로그램"
              desc="마음이 건강해야 학습도 자란다는 원칙으로, 정서 안정과 자존감을 함께 다집니다."
            />
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

        {/* 센터 소식/활동 미리보기 (실제 사진은 학부모 전용 - 여기서는 안내만) */}
        <section id="news" className="scroll-mt-20 mb-20">
          <div className="card max-w-3xl mx-auto py-10 px-8 text-center bg-apricot-50 border-apricot-100">
            <p className="section-label !text-apricot-600 mb-3">센터 소식</p>
            <p className="text-[15px] leading-relaxed text-ink/75 mb-1">
              수업·프로그램 활동 소식을 꾸준히 기록하고 있어요.
            </p>
            <p className="text-[15px] leading-relaxed text-ink/75">
              실제 활동 사진은 우리 아이 전용 리포트 링크에 로그인하시면
              확인하실 수 있습니다.
            </p>
          </div>
        </section>

        {/* 후기 (플레이스홀더 - 추후 실제 후기로 교체 필요) */}
        <section id="reviews" className="mb-20">
          <div className="text-center mb-8">
            <p className="section-label mb-2">후기</p>
            <h2 className="text-xl sm:text-2xl font-bold">함께해 주신 학부모님들의 이야기</h2>
          </div>
          <div className="grid sm:grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="card py-6 px-5 text-sm text-ink/40 text-center leading-relaxed">
                실제 학부모 후기가 준비되면
                <br />이 자리에 넣어주세요.
              </div>
            ))}
          </div>
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
          </div>
        </section>
      </div>

      <footer className="border-t border-sage-100 py-8 text-center text-xs text-ink/40">
        ⓒ 학습심리브레인센터
      </footer>
    </main>
  );
}

function ServiceCard({ emoji, title, desc }: { emoji: string; title: string; desc: string }) {
  return (
    <div className="card py-7 px-6 text-center">
      <p className="text-3xl mb-3">{emoji}</p>
      <p className="font-bold mb-2">{title}</p>
      <p className="text-sm text-ink/60 leading-relaxed">{desc}</p>
    </div>
  );
}

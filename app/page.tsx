import Link from "next/link";

/**
 * 첫 화면 (랜딩)
 * 학부모는 문자/카카오톡으로 받은 개별 링크로 바로 접속하므로,
 * 이 페이지는 잘못 들어온 방문자를 위한 간단한 안내 역할만 합니다.
 */
export default function Home() {
  return (
    <main className="min-h-screen flex items-center justify-center px-6">
      <div className="card max-w-md w-full text-center py-10">
        <p className="section-label mb-3">학습심리브레인센터</p>
        <h1 className="text-2xl font-bold mb-4">아이 성장 결과 리포트</h1>
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
    </main>
  );
}

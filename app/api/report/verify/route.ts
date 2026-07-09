/**
 * =====================================================================
 * 학부모 비밀번호 검증 API
 * ---------------------------------------------------------------------
 * POST { token, password }
 *  → 성공: 종류에 따라 마스킹된 리포트(temperament) 또는
 *          마스킹된 MT-PRIS 콘텐츠(mtpris) 반환
 *  → 실패: 401
 *
 * [보안 처리 요약]
 * 1. 토큰 존재 + 활성 + 만료 확인 (lib/data.ts의 getAccessByToken)
 * 2. 비밀번호는 bcrypt 해시끼리 비교 (평문 저장 없음)
 * 3. 마스킹·페이로드 조립은 lib/reportPayload.ts에 공용으로 모아둠
 *    (홈페이지 "형제자매 포함 이름+비밀번호" 로그인과 동일한 로직 사용)
 * 4. 응답에 캐시 금지 헤더
 * 5. 모든 시도(성공/실패)를 access_logs 테이블에 기록
 * =====================================================================
 */
import { NextResponse } from "next/server";
import { getAccessByToken, logAccess } from "@/lib/data";
import { verifyParentPassword } from "@/lib/auth";
import { buildParentReportPayload } from "@/lib/reportPayload";

const NO_STORE = { "Cache-Control": "no-store, no-cache, must-revalidate" };

async function logAttempt(token: string, reportId: string | null, success: boolean, req: Request) {
  // [보안] 열람 기록은 참고용이므로, 기록 실패가 실제 로그인 흐름을 막으면 안 됨
  try {
    const ip = req.headers.get("x-forwarded-for");
    await logAccess({ token, reportId, success, ip });
  } catch {
    // 기록 실패는 무시
  }
}

export async function POST(req: Request) {
  const { token, password } = await req.json().catch(() => ({}));

  if (typeof token !== "string" || typeof password !== "string" || !password) {
    return NextResponse.json({ message: "비밀번호를 입력해 주세요." }, { status: 400 });
  }

  const access = await getAccessByToken(token);
  if (!access) {
    // 토큰이 없어도 "비밀번호 오류"와 같은 메시지를 사용해
    // 어떤 토큰이 유효한지 외부에서 알 수 없게 함
    await logAttempt(token, null, false, req);
    return NextResponse.json(
      { message: "링크가 유효하지 않거나 비밀번호가 맞지 않습니다." },
      { status: 401 }
    );
  }

  if (!(await verifyParentPassword(password, access.passwordHash))) {
    await logAttempt(token, access.reportId, false, req);
    return NextResponse.json(
      { message: "비밀번호가 맞지 않습니다. 다시 확인해 주세요." },
      { status: 401 }
    );
  }

  await logAttempt(token, access.reportId, true, req);

  const payload = await buildParentReportPayload(access);
  if (!payload) {
    return NextResponse.json(
      { message: "아직 준비 중인 결과지입니다. 센터로 문의해 주세요." },
      { status: 404 }
    );
  }

  return NextResponse.json(payload, { headers: NO_STORE });
}

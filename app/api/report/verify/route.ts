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
 * 3. 아동 실명은 서버에서 마스킹 후 전달
 * 4. MT-PRIS는 counselorAppendix(원자료·다짐·상담질문)를 서버에서 제거 후 전달
 * 5. 응답에 캐시 금지 헤더
 * 6. 모든 시도(성공/실패)를 access_logs 테이블에 기록
 * =====================================================================
 */
import { NextResponse } from "next/server";
import { getAccessByToken, getReport, getChild, getMtprisReport, logAccess, getPhotosByChild, createSignedPhotoUrl } from "@/lib/data";
import { verifyParentPassword, maskName } from "@/lib/auth";
import type { MaskedReport, ParentPhoto } from "@/lib/types";
import { generateMtprisContent } from "@/lib/mtpris/generate";
import { maskMtprisContentForParent } from "@/lib/mtpris/mask";

const NO_STORE = { "Cache-Control": "no-store, no-cache, must-revalidate" };
const PHOTO_SIGNED_URL_TTL = 600; // 10분 — 짧게 유지해 서명 URL 노출 기간을 제한

async function logAttempt(token: string, reportId: string | null, success: boolean, req: Request) {
  // [보안] 열람 기록은 참고용이므로, 기록 실패가 실제 로그인 흐름을 막으면 안 됨
  try {
    const ip = req.headers.get("x-forwarded-for");
    await logAccess({ token, reportId, success, ip });
  } catch {
    // 기록 실패는 무시
  }
}

/** 공개 사진만, 최신순, 서명 URL로 변환 — memo(관리자 전용)는 절대 포함하지 않음 */
async function getParentPhotos(childId: string): Promise<ParentPhoto[]> {
  const photos = await getPhotosByChild(childId, { onlyPublic: true });
  const withUrls = await Promise.all(
    photos.map(async (p) => {
      const url = await createSignedPhotoUrl(p.storagePath, PHOTO_SIGNED_URL_TTL);
      if (!url) return null;
      const photo: ParentPhoto = {
        id: p.id,
        url,
        activityDate: p.activityDate,
        activityName: p.activityName,
        activityType: p.activityType,
        description: p.description,
      };
      return photo;
    })
  );
  return withUrls.filter((p): p is ParentPhoto => p !== null);
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

  const kind = access.reportKind ?? "temperament";

  if (kind === "mtpris") {
    const raw = await getMtprisReport(access.reportId);
    if (!raw || raw.status !== "published") {
      return NextResponse.json(
        { message: "아직 준비 중인 결과지입니다. 센터로 문의해 주세요." },
        { status: 404 }
      );
    }
    const child = await getChild(raw.childId);
    const fullContent = generateMtprisContent(raw);
    // [보안] 상담사 전용 정보(원자료, 다짐, 상담 질문) 제거 후 전달
    const parentContent = maskMtprisContentForParent(fullContent);
    const photos = await getParentPhotos(raw.childId);

    return NextResponse.json(
      {
        kind: "mtpris",
        content: parentContent,
        childMaskedName: maskName(child?.name ?? ""),
        childGrade: child?.grade ?? "",
        testDate: raw.testDate,
        counselor: raw.counselor,
        photos,
      },
      { headers: NO_STORE }
    );
  }

  const report = await getReport(access.reportId);
  if (!report || report.status !== "published") {
    return NextResponse.json(
      { message: "아직 준비 중인 결과지입니다. 센터로 문의해 주세요." },
      { status: 404 }
    );
  }

  const child = await getChild(report.childId);
  const photos = await getParentPhotos(report.childId);

  // [보안] 실명 제거 + 마스킹된 이름만 포함하여 응답
  const { childId, ...rest } = report;
  const masked: MaskedReport = {
    ...rest,
    childMaskedName: maskName(child?.name ?? ""),
    childGrade: child?.grade ?? "",
  };

  return NextResponse.json({ kind: "temperament", report: masked, photos }, { headers: NO_STORE });
}

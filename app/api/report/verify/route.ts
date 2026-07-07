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
import {
  getAccessByToken, getReport, getChild, getMtprisReport, logAccess,
  getPhotosByChild, getBlogPhotos, createSignedPhotoUrl, getBrainTestsByChild,
} from "@/lib/data";
import { verifyParentPassword, maskName } from "@/lib/auth";
import type { ActivityPhoto, MaskedReport, ParentPhoto, ParentBrainTest } from "@/lib/types";
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

/** memo(관리자 전용) 제거 + storage_path를 단기 서명 URL로 변환 */
async function toParentPhotos(photos: ActivityPhoto[]): Promise<ParentPhoto[]> {
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

/** 우리 아이에게 태그된 공개 사진만 */
async function getParentPhotos(childId: string): Promise<ParentPhoto[]> {
  const photos = await getPhotosByChild(childId, { onlyPublic: true });
  return toParentPhotos(photos);
}

/**
 * [보안] 특정 아이 태그와 무관하게, 로그인(토큰+비밀번호 인증)에 성공한 모든 학부모에게
 * 노출되는 "센터 소식" 피드. 자기 아이 자료만 보게 하는 원칙의 의도적인 예외이며,
 * is_public_to_blog로 명시적으로 게시 설정된 사진만 대상입니다.
 */
async function getCenterNewsPhotos(): Promise<ParentPhoto[]> {
  const photos = await getBlogPhotos({ onlyPublic: true });
  return toParentPhotos(photos);
}

/**
 * 공개 설정된 뇌기능검사만, 원본 파일 없이 지표·의견만.
 * [주의] brain_tests 테이블이 아직 마이그레이션 전이어도(배포 순서상 코드가 먼저
 * 나갈 수 있음) 기존 리포트 열람 전체가 깨지지 않도록 실패 시 빈 배열로 대체.
 */
async function getParentBrainTests(childId: string): Promise<ParentBrainTest[]> {
  try {
    const tests = await getBrainTestsByChild(childId, { onlyPublic: true });
    return tests.map((t) => ({ testDate: t.testDate, indicators: t.indicators, opinion: t.opinion }));
  } catch {
    return [];
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
    const [photos, blogPhotos, brainTests] = await Promise.all([
      getParentPhotos(raw.childId),
      getCenterNewsPhotos(),
      getParentBrainTests(raw.childId),
    ]);

    return NextResponse.json(
      {
        kind: "mtpris",
        content: parentContent,
        childMaskedName: maskName(child?.name ?? ""),
        childGrade: child?.grade ?? "",
        testDate: raw.testDate,
        counselor: raw.counselor,
        photos,
        blogPhotos,
        brainTests,
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
  const [photos, blogPhotos, brainTests] = await Promise.all([
    getParentPhotos(report.childId),
    getCenterNewsPhotos(),
    getParentBrainTests(report.childId),
  ]);

  // [보안] 실명 제거 + 마스킹된 이름만 포함하여 응답
  const { childId, ...rest } = report;
  const masked: MaskedReport = {
    ...rest,
    childMaskedName: maskName(child?.name ?? ""),
    childGrade: child?.grade ?? "",
  };

  return NextResponse.json({ kind: "temperament", report: masked, photos, blogPhotos, brainTests }, { headers: NO_STORE });
}

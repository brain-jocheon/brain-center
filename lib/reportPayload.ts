/**
 * =====================================================================
 * 학부모 화면용 리포트 페이로드 조립 (verify, find-family 공용)
 * ---------------------------------------------------------------------
 * "토큰 하나 검증 통과 → 마스킹된 콘텐츠 조립"을 한 곳에 모아서, 홈페이지
 * 이름+비밀번호(형제자매 포함) 로그인과 기존 링크(/report/[token]) 로그인이
 * 완전히 같은 마스킹 로직을 쓰도록 합니다 — 따로 구현하면 한쪽만 고치고
 * 잊어버려서 마스킹이 어긋나는 사고가 나기 쉽습니다.
 * =====================================================================
 */
import {
  getReport, getChild, getMtprisReport,
  getPhotosByChild, getBlogPhotos, createSignedPhotoUrl, getBrainTestsByChild, getAttendanceByChild,
  getParentFeedback,
} from "@/lib/data";
import type { ActivityPhoto, MaskedReport, ParentPhoto, ParentBrainTest, ParentAttendanceRecord, ParentFeedback, AccessToken } from "@/lib/types";
import { generateMtprisContent } from "@/lib/mtpris/generate";
import { maskMtprisContentForParent, type ParentMtprisContent } from "@/lib/mtpris/mask";

const PHOTO_SIGNED_URL_TTL = 600; // 10분 — 짧게 유지해 서명 URL 노출 기간을 제한

/** 학부모 마이페이지 상단 요약용 — 개인정보(연락처 등)는 절대 포함하지 않음 */
interface ParentChildMeta {
  serviceType?: string;
  classDay?: string;
}

export type VerifyPayload = ParentChildMeta &
  (
    | {
        kind: "temperament";
        report: MaskedReport;
        photos: ParentPhoto[];
        blogPhotos: ParentPhoto[];
        brainTests: ParentBrainTest[];
        attendance: ParentAttendanceRecord[];
        feedback: ParentFeedback[];
      }
    | {
        kind: "mtpris";
        content: ParentMtprisContent;
        childMaskedName: string;
        childGrade: string;
        testDate: string;
        counselor: string;
        photos: ParentPhoto[];
        blogPhotos: ParentPhoto[];
        brainTests: ParentBrainTest[];
        attendance: ParentAttendanceRecord[];
        feedback: ParentFeedback[];
      }
  );

/** 학부모 마이페이지의 아이 전환용 — /family(이름+비밀번호)와 /report/[token]
 * (개별 링크, /api/report/siblings로 형제자매를 추가 조회) 양쪽에서 공용으로 씀.
 * childId는 클라이언트에 내려줄 필요가 없어 의도적으로 뺐고, token을 고유 키로 씀. */
export interface FamilyMember {
  maskedName: string;
  token: string;
  payload: VerifyPayload;
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
 * [주의] brain_tests 테이블이 아직 마이그레이션 전이어도 기존 리포트 열람 전체가
 * 깨지지 않도록 실패 시 빈 배열로 대체.
 */
async function getParentBrainTests(childId: string): Promise<ParentBrainTest[]> {
  try {
    const tests = await getBrainTestsByChild(childId, { onlyPublic: true });
    return tests.map((t) => ({ testDate: t.testDate, indicators: t.indicators, opinion: t.opinion }));
  } catch {
    return [];
  }
}

/**
 * 출결 기록(memo 제외). [주의] attendance_records 테이블 마이그레이션 전이어도
 * 리포트 열람 전체가 깨지지 않도록 실패 시 빈 배열로 대체.
 */
async function getParentAttendance(childId: string): Promise<ParentAttendanceRecord[]> {
  try {
    const records = await getAttendanceByChild(childId);
    return records.map((r) => ({
      classDate: r.classDate,
      status: r.status,
      isMakeup: r.isMakeup,
      makeupDate: r.makeupDate,
    }));
  } catch {
    return [];
  }
}

/** 학부모가 이전에 남긴 문의/건의사항 이력. [주의] parent_feedback 테이블 마이그레이션
 * 전이어도 리포트 열람 전체가 깨지지 않도록 실패 시 빈 배열로 대체. */
async function getParentFeedbackList(childId: string): Promise<ParentFeedback[]> {
  try {
    return await getParentFeedback({ childId });
  } catch {
    return [];
  }
}

/** 검증된 access 토큰 하나에 대해, 학부모에게 내려줄 마스킹된 페이로드를 조립합니다. */
export async function buildParentReportPayload(access: AccessToken): Promise<VerifyPayload | null> {
  const kind = access.reportKind ?? "temperament";

  if (kind === "mtpris") {
    const raw = await getMtprisReport(access.reportId);
    if (!raw || raw.status !== "published") return null;

    const child = await getChild(raw.childId);
    const fullContent = generateMtprisContent(raw);
    // [보안] 상담사 전용 정보(원자료, 다짐, 상담 질문) 제거 후 전달
    const parentContent = maskMtprisContentForParent(fullContent);
    const [photos, blogPhotos, brainTests, attendance, feedback] = await Promise.all([
      getParentPhotos(raw.childId),
      getCenterNewsPhotos(),
      getParentBrainTests(raw.childId),
      getParentAttendance(raw.childId),
      getParentFeedbackList(raw.childId),
    ]);

    return {
      kind: "mtpris",
      content: parentContent,
      // childMaskedName은 이제 마스킹 없이 실명을 그대로 담습니다 — 학부모 본인의
      // 화면이라 자기 아이 이름을 가릴 이유가 없다는 운영 판단(2026-07-11)에 따름.
      childMaskedName: child?.name ?? "",
      childGrade: child?.grade ?? "",
      testDate: raw.testDate,
      counselor: raw.counselor,
      serviceType: child?.serviceType,
      classDay: child?.classDay,
      photos,
      blogPhotos,
      brainTests,
      attendance,
      feedback,
    };
  }

  const report = await getReport(access.reportId);
  if (!report || report.status !== "published") return null;

  const child = await getChild(report.childId);
  const [photos, blogPhotos, brainTests, attendance, feedback] = await Promise.all([
    getParentPhotos(report.childId),
    getCenterNewsPhotos(),
    getParentBrainTests(report.childId),
    getParentAttendance(report.childId),
    getParentFeedbackList(report.childId),
  ]);

  // childId는 여전히 제거(클라이언트가 다른 아이 자료를 유추할 단서를 안 남김),
  // 이름은 마스킹하지 않고 그대로 전달 — 학부모 본인 화면이라 실명 표시가 자연스러움.
  const { childId, ...rest } = report;
  const masked: MaskedReport = {
    ...rest,
    childMaskedName: child?.name ?? "",
    childGrade: child?.grade ?? "",
  };

  return {
    kind: "temperament",
    report: masked,
    serviceType: child?.serviceType,
    classDay: child?.classDay,
    photos,
    blogPhotos,
    brainTests,
    attendance,
    feedback,
  };
}

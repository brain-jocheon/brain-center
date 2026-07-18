/**
 * =====================================================================
 * 데이터 타입 정의
 * ---------------------------------------------------------------------
 * 이 파일의 구조가 곧 데이터베이스 테이블 설계의 기초가 됩니다.
 * 추후 Supabase 적용 시: children / reports / access_tokens 테이블로 전환
 * =====================================================================
 */

/** 아동 기본 정보 */
export interface Child {
  id: string;
  /** [보안] 실명 — 관리자 화면에서만 사용. 학부모 화면에는 절대 그대로 내려보내지 않음 */
  name: string;
  grade: string;
  /** @deprecated 새 폼은 birthDate만 사용. 기존 데이터 호환을 위해 유지 */
  birthYear?: number;
  createdAt: string;
  /** active(이용중) | waiting(대기) | ended(종료) — 목록 분리·필터용, 삭제와는 별개 */
  status: "active" | "waiting" | "ended";
  birthDate?: string;
  gender?: "M" | "F";
  guardianName?: string;
  /** [보안] 학부모 화면·URL에 절대 노출 금지. 관리자 화면 전용 */
  guardianPhone?: string;
  serviceType?: string;
  classDay?: string;
  counselor?: string;
  memo?: string;
}

/** 척도별 점수 (그래프 표시용, 1~10) */
export interface ScaleScore {
  label: string; // 예: "정서 안정성"
  score: number; // 1 ~ 10
  note?: string; // 짧은 한 줄 설명
}

/** 세부 해석 항목 */
export interface DetailSection {
  key: string; // emotion | learning | relationship | expression | stress | motivation ...
  title: string; // 예: "정서 특성"
  content: string; // 서술형 해석 (따뜻한 상담 문장)
}

/** 검사 결과 리포트 */
export interface Report {
  id: string;
  childId: string;
  /** 검사 종류 — 추후 확장: "temperament" | "eeg" | "learning_style" | "counseling" */
  testType: string;
  testTypeName: string; // 화면 표시용 이름 (예: "기질검사")
  testDate: string;
  counselor: string;
  status: "draft" | "published";

  /** 핵심 요약 */
  summary: {
    headline: string; // 한눈에 보는 아이 특성 (2~3문장)
    mainTemperament: string; // 대표 기질
    strengths: string[]; // 현재 강점
    growthAreas: string[]; // 성장 과제
  };

  /** 척도 점수 (그래프) — 서술형 위주 검사이므로 보조 자료 성격 */
  scores: ScaleScore[];

  /** 세부 해석 (항목 배열 구조 → 다른 검사 종류에도 재사용 가능) */
  details: DetailSection[];

  /** 부모님 가이드 */
  parentGuide: {
    helpfulWords: string[]; // 가정에서 도움이 되는 말
    avoidReactions: string[]; // 피하면 좋은 반응
    learningTips: string[]; // 학습 지도 팁
    emotionTips: string[]; // 정서 지도 팁
  };

  /** 센터 지도 방향 */
  centerPlan: {
    focusAreas: string[]; // 센터에서 중점적으로 도와줄 부분
    activities: string[]; // 추천 활동
    nextCheckpoints: string[]; // 다음 상담 시 확인할 부분
  };
}

/**
 * 학부모 접근 토큰
 * [보안] passwordHash에는 반드시 해시값만 저장합니다. 평문 비밀번호 저장 금지!
 */
export interface AccessToken {
  token: string; // URL에 들어가는 무작위 문자열 (추측 불가능하게 32자 이상)
  reportId: string;
  /** 어떤 종류의 리포트인지 — 없으면 기존 서술형 기질검사("temperament")로 취급 */
  reportKind?: "temperament" | "mtpris";
  passwordHash: string; // sha256(비밀번호 + PASSWORD_SALT)
  expiresAt?: string; // 링크 만료일 (선택)
  active: boolean; // false로 바꾸면 즉시 접근 차단
}

/** 학부모 화면에 내려보내는 "마스킹된" 리포트 — 서버에서 가공 후 전달 */
export interface MaskedReport extends Omit<Report, "childId"> {
  childMaskedName: string; // 예: "김OO"
  childGrade: string;
}

/** 활동 사진 (관리자 전체 뷰) */
export interface ActivityPhoto {
  id: string;
  storagePath: string;
  activityDate: string;
  activityName: string;
  activityType: "class" | "craft" | "cooking" | "neurofeedback" | "event" | "other";
  description?: string;
  /** [보안] 이 값이 true이고 아이가 태그되어 있어야만 그 아이 학부모 화면에 노출됨 */
  isPublicToParent: boolean;
  /** [보안] 특정 아이 태그와 무관하게 로그인한 모든 학부모의 "센터 소식" 피드에 노출됨 */
  isPublicToBlog: boolean;
  /** [보안] 관리자 전용 — 학부모 화면에는 절대 내려가지 않음 */
  memo?: string;
  createdAt: string;
  updatedAt: string;
  studentIds: string[];
}

/** 학부모 화면에 내려가는 사진 — memo·storagePath 없음, 서명된 url만 포함 */
export interface ParentPhoto {
  id: string;
  url: string;
  activityDate: string;
  activityName: string;
  activityType: ActivityPhoto["activityType"];
  description?: string;
}

/** 공개 홈페이지 문구 (센터소개/위치/연락처) — 로그인 없이 누구나 보는 값이므로 개인정보 절대 금지 */
export interface SiteSettings {
  aboutText: string;
  address?: string;
  phone?: string;
  /** 카카오톡 채널 URL (예: https://pf.kakao.com/_xxxxxxx) — 미입력 시 문의 버튼은 전화 연결로 대체됨 */
  kakaoUrl?: string;
  updatedAt: string;
}

/** 공개 홈페이지 공지사항 — 작성 즉시 누구나 볼 수 있음 (아이 개인정보/사진 넣지 말 것) */
export interface Notice {
  id: string;
  title: string;
  body: string;
  createdAt: string;
  updatedAt: string;
}

/** 뇌기능검사 지표 한 줄 — 장비마다 항목이 달라 이름/값 모두 자유 입력 */
export interface BrainIndicator {
  label: string;
  value: string;
}

/** 뇌기능검사 (관리자 전체 뷰) — 원본 파일은 보관용, 실제 해석은 상담사가 직접 입력 */
export interface BrainTest {
  id: string;
  childId: string;
  testDate: string;
  counselor: string;
  /** [보안] 관리자 전용 — 학부모 화면에는 원본 파일을 내려주지 않음 */
  fileStoragePath?: string;
  fileName?: string;
  indicators: BrainIndicator[];
  opinion?: string;
  isPublicToParent: boolean;
  createdAt: string;
  updatedAt: string;
}

/** 학부모 화면에 내려가는 뇌기능검사 요약 — 원본 파일 없이 지표·의견만 */
export interface ParentBrainTest {
  testDate: string;
  indicators: BrainIndicator[];
  opinion?: string;
}

/** 출결 기록 (관리자 전체 뷰) — 하루(아이+날짜)당 한 행 */
export interface AttendanceRecord {
  id: string;
  childId: string;
  classDate: string;
  status: "present" | "absent";
  /** 이 날짜 자체가 보강 수업인지 */
  isMakeup: boolean;
  /** status가 absent일 때, 보강이 예정된 날짜(있다면) */
  makeupDate?: string;
  /** [보안] 관리자 전용(결석 사유 등) — 학부모 화면에는 절대 내려가지 않음 */
  memo?: string;
  createdAt: string;
  updatedAt: string;
}

/** 학부모 화면에 내려가는 출결 — memo 없음 */
export interface ParentAttendanceRecord {
  classDate: string;
  status: "present" | "absent";
  isMakeup: boolean;
  makeupDate?: string;
}

/** 학부모가 제출한 보강 희망일 요청 — 관리자가 승인해야 실제 출결에 반영됨 */
export interface MakeupRequest {
  id: string;
  childId: string;
  originalClassDate?: string;
  requestedDate: string;
  status: "pending" | "approved" | "rejected";
  parentMemo?: string;
  adminMemo?: string;
  createdAt: string;
  reviewedAt?: string;
}

/** 관리자 전용 — 학부모 링크 열람 기록 한 줄. childName은 성공한 시도이고
 * 토큰이 아직 살아있는 아이일 때만 채워짐(탈퇴/삭제된 아이는 비어있을 수 있음) */
export interface AccessLogEntry {
  id: number;
  token: string | null;
  success: boolean;
  ip: string | null;
  viewedAt: string;
  childId?: string;
  childName?: string;
  childGrade?: string;
}

/** 관리자 전용 — 아이별 접속 집계(최근 접속 순 정렬용) */
export interface ChildVisitSummary {
  childId: string;
  childName: string;
  childGrade: string;
  visitCount: number;
  lastVisitedAt: string;
}

/** 학부모 마이페이지 "문의/건의사항" — childId는 서버가 access 토큰으로 확인해서 채움 */
export interface ParentFeedback {
  id: string;
  childId: string;
  type: "class" | "makeup" | "share" | "suggestion" | "other";
  title: string;
  content: string;
  status: "pending" | "reviewed" | "answered";
  adminReply?: string;
  createdAt: string;
  reviewedAt?: string;
}

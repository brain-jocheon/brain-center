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

/** 뇌기능검사(=뇌파검사) 처리 상태 — 6단계에서 스키마만 준비, 실제 화면 반영은 8단계 이후 */
export type BrainTestStatus =
  | "draft" | "uploaded" | "extracting" | "needs_review" | "confirmed" | "ai_processing"
  | "ai_drafted" | "teacher_reviewed" | "pending_approval" | "approved" | "published" | "failed";

/** 뇌기능검사 (관리자 전체 뷰) — 원본 파일은 보관용, 실제 해석은 상담사가 직접 입력.
 * [주의] 6단계에서 추가된 필드(testType 이하)는 스키마·타입만 준비된 상태이며, 기존
 * lib/data.ts의 SELECT/CRUD 함수는 아직 이 필드들을 다루지 않음(8단계 이후 반영 예정) —
 * 전부 optional로 둬서 기존 코드와 완전히 호환됨. */
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
  /** 검사 종류 키(예: 'panaxtos_eeg') — 검사 템플릿(EegTestTemplate)과 매칭 */
  testType?: string;
  testName?: string;
  measuringOrg?: string;
  measuredBy?: string;
  /** 파일에서 추출한 원본 구조화 데이터(선생님 확인 전) */
  /** 11단계 — 파일에서 추출한 원본 데이터. 정확한 모양은 lib/extraction/types.ts의 RawExtracted 참고 */
  rawExtracted?: import("./extraction/types").RawExtracted;
  extractionConfidence?: string;
  teacherConfirmedAt?: string;
  aiInterpretation?: Record<string, unknown>;
  finalInterpretation?: string;
  /** 학부모 공개용 요약 — is_public_to_parent와 별개로, 공개 시 실제 보여줄 문구 */
  parentSummary?: string;
  approvedBy?: string;
  approvedAt?: string;
  sourceFileHash?: string;
  status?: BrainTestStatus;
}

/** 학부모 화면에 내려가는 뇌기능검사 요약 — 원본 파일 없이 지표·의견만 */
export interface ParentBrainTest {
  testDate: string;
  indicators: BrainIndicator[];
  /** parentSummary가 있으면 그 값, 없으면 기존 opinion(reportPayload.ts에서 조립) */
  opinion?: string;
  testName?: string;
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

/** 관리자 전용 — 로그인 여부와 무관한 일반 방문자 통계 */
export interface VisitorStats {
  pageViewsToday: number;
  uniqueVisitorsToday: number;
  pageViewsWeek: number;
  uniqueVisitorsWeek: number;
}

/** 관리자 홈 대시보드 요약 — 전부 기존 테이블 집계, 새 테이블 없음 */
export interface DashboardSummary {
  activeCount: number;
  waitingCount: number;
  endedCount: number;
  newThisWeek: number;
  /** 오늘 요일이 class_day에 포함되는 이용중 아이 수(수업 예정) */
  todayClassCount: number;
  /** 최근 7일 이내 등록된 활동사진 수 */
  recentPhotosCount: number;
}

/** 수업기록 1건(관리자 전체 뷰) — 여러 아이가 함께 참여한 수업 하나를 나타냄.
 * deletedAt이 있으면 관리자 실수 삭제로 소프트삭제된 것(목록 조회에서 제외). */
export interface ClassRecord {
  id: string;
  classDate: string;
  activityName: string;
  activityType: ActivityPhoto["activityType"];
  /** 전체 공용 코멘트 — 아이별 오버라이드가 없으면 이 문구가 그대로 쓰임 */
  comment?: string;
  counselor?: string;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string | null;
  childIds: string[];
  /** 6단계 추가 — 기존 lib/data.ts는 아직 안 다룸(10단계에서 반영) */
  lessonGoal?: string;
  participation?: string;
}

/** 아이별 코멘트 오버라이드(관리자 전체 뷰) — comment가 비어있으면 화면에서
 * 소속 class_records.comment를 그대로 보여줌
 * [주의] 6단계 추가 필드(strengthsNote 이하)는 스키마·타입만 준비된 상태 — 10단계(AI
 * 수업기록)에서 lib/data.ts CRUD와 화면에 실제로 연결 예정. */
export interface ChildComment {
  id: string;
  classRecordId: string;
  childId: string;
  comment?: string;
  /** [보안] 이 값이 true여야만 이 아이 학부모 화면에 노출됨 */
  isPublicToParent: boolean;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string | null;
  strengthsNote?: string;
  difficultiesNote?: string;
  teacherMemo?: string;
  /** AI 3분할 초안: 내부용 상세기록 */
  aiDraftDetail?: string;
  /** AI 3분할 초안: 학부모용 코멘트 */
  aiDraftParent?: string;
  /** AI 3분할 초안: 다음 수업 지도 방향 */
  aiDraftGuidance?: string;
  aiGeneratedAt?: string;
  aiModel?: string;
  finalSource?: "manual" | "ai_edited";
}

/** 학부모 화면에 내려가는 코멘트 — 공개로 설정된 것만, 관리자 전용 필드 없음 */
export interface ParentChildComment {
  classRecordId: string;
  classDate: string;
  activityName: string;
  activityType: ActivityPhoto["activityType"];
  comment: string;
}

/** 관리자가 직접 관리하는 코멘트 자주쓰는 문구 */
export interface CommentTemplate {
  id: string;
  text: string;
  createdAt: string;
}

/** 월간 성장 리포트(관리자 전체 뷰) — 아이 한 명당 한 달에 한 건(month: 'YYYY-MM').
 * deletedAt이 있으면 관리자 실수 삭제로 소프트삭제된 것(목록 조회에서 제외). */
export interface MonthlyReport {
  id: string;
  childId: string;
  month: string;
  participation?: string;
  strengths?: string;
  improvements?: string;
  homeGuidance?: string;
  nextMonthGoals?: string;
  counselor?: string;
  /** [보안] 이 값이 true여야만 이 아이 학부모 화면(성장기록 타임라인)에 노출됨 */
  isPublicToParent: boolean;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string | null;
}

/** 학부모 화면에 내려가는 월간 리포트 — 공개로 설정된 것만, 관리자 전용 필드 없음 */
export interface ParentMonthlyReport {
  month: string;
  participation?: string;
  strengths?: string;
  improvements?: string;
  homeGuidance?: string;
  nextMonthGoals?: string;
}

/** 학부모 전용 공지(관리자 뷰) — 로그인 없이 보이는 공개 홈페이지 notices와는 완전히 별개.
 * audienceValue는 audienceType에 따라 다르게 해석됨(스키마 주석 참고). */
export interface ParentNoticeAdmin {
  id: string;
  title: string;
  body: string;
  audienceType: "all" | "status" | "program" | "weekday" | "child";
  audienceValue?: string;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string | null;
}

/** 학부모 화면에 내려가는 공지 — 대상 매칭 필드 없이 이미 필터링된 것만, isRead 포함 */
export interface ParentFacingNotice {
  id: string;
  title: string;
  body: string;
  createdAt: string;
  isRead: boolean;
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

/** 공개 홈페이지에서 로그인 없이 제출되는 신규 상담 신청 — parent_feedback(재원 중
 * 학부모 전용 문의)과는 완전히 별개. ip는 관리자 화면에는 안 보여주고 스팸 방지
 * 레이트리밋에만 씀. */
export interface Consultation {
  id: string;
  guardianName: string;
  guardianPhone: string;
  childName: string;
  childAgeGrade?: string;
  concern?: string;
  isExistingMember: boolean;
  desiredProgram?: string;
  desiredDatetime?: string;
  referralSource?: string;
  additionalMessage?: string;
  consentAt: string;
  ip?: string;
  status: "new" | "contact_scheduled" | "consult_scheduled" | "consult_done" | "enrolled" | "on_hold" | "closed";
  adminMemo?: string;
  createdAt: string;
  updatedAt: string;
}

/* =====================================================================
 * 6단계: 뇌파검사·훈련기록·역할체계(RBAC)·AI 연동 — 신규 타입
 * ---------------------------------------------------------------------
 * 이 아래 타입들은 스키마만 준비된 상태입니다. 로그인·화면·API 연결은
 * 7단계(RBAC) 이후 순서대로 진행됩니다 — lib/data.ts에 아직 이 타입들을
 * 다루는 함수가 없습니다.
 * ===================================================================== */

/** 선생님/관리자 계정 — 기존 단일 관리자 로그인(ADMIN_PASSWORD)과 병행되며 대체하지 않음 */
export interface Staff {
  id: string;
  name: string;
  phone?: string;
  role: "admin" | "teacher";
  active: boolean;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string | null;
}

/** 아이 담당 선생님 배정 */
export interface ChildStaffAssignment {
  childId: string;
  staffId: string;
  assignedAt: string;
}

/** 아동 특성 — AI 수업기록/검사해석에 참고할 정보. aiIncludeFields에 넣은 항목만
 * 실제로 AI에 전송됨(화이트리스트 방식, 기본값 빈 배열 = 아무것도 안 보냄). */
export interface ChildTraits {
  childId: string;
  temperament?: string;
  strengths?: string;
  weaknesses?: string;
  cautions?: string;
  learningStyle?: string;
  emotionalBehavior?: string;
  counselingGoal?: string;
  teacherMemo?: string;
  aiGuidanceNote?: string;
  /** ChildTraits의 키 이름 중 AI에 전송을 허용한 필드 목록 (예: ["strengths", "learningStyle"]) */
  aiIncludeFields: string[];
  updatedAt: string;
  updatedBy?: string;
}

/** 뇌파훈련 기록(검사와 별도, 매회 진행) — 숫자 없는 항목은 null(0으로 채우지 않음) */
export interface EegTrainingSession {
  id: string;
  childId: string;
  sessionDate: string;
  durationMinutes?: number;
  trainingMode?: string;
  trainingStage?: string;
  equipment?: string;
  keyMetrics?: Record<string, number | string | null>;
  conditionNote?: string;
  engagementNote?: string;
  observation?: string;
  specialNote?: string;
  staffId?: string;
  parentComment?: string;
  isPublicToParent: boolean;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string | null;
}

/** AI 호출 이력 — 이름/생년월일 등은 저장하지 않고 해시만(개인정보 최소화) */
export interface AiGenerationLog {
  id: string;
  feature: "class_record" | "eeg_interpretation";
  targetId: string;
  staffId?: string;
  model?: string;
  promptVersion?: string;
  inputSummaryHash?: string;
  status: "pending" | "success" | "failed";
  errorMessage?: string;
  tokensUsed?: number;
  createdAt: string;
}

/** 관리자/선생님 작업 감사로그 */
export interface AuditLog {
  id: string;
  actorStaffId?: string;
  action: string;
  targetTable: string;
  targetId?: string;
  before?: Record<string, unknown>;
  after?: Record<string, unknown>;
  createdAt: string;
}

/** 검사종류별 항목매핑/기준범위/AI지침 — 관리자가 설정·확장.
 * direction이 'none'이면 기준이 없다는 뜻 — 화면에서 증감만 표시하고 좋다/나쁘다 판정 금지. */
export interface EegTestTemplate {
  id: string;
  testType: string;
  indicatorKey: string;
  indicatorLabel: string;
  direction: "higher_better" | "lower_better" | "none";
  normalRangeMin?: number;
  normalRangeMax?: number;
  aiInstruction?: string;
  createdAt: string;
  updatedAt: string;
}

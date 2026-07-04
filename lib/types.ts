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

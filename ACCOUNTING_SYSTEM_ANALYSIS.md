# 회계관리 시스템 도입 분석 보고서

> **이 문서는 분석 전용입니다.** 실제 코드 수정·기능 구현은 전혀 진행하지 않았으며, 기존 파일도 전혀 변경하지 않았습니다. 아래 내용은 전부 현재 저장소(`supabase/schema.sql`, `lib/`, `app/`, `package.json`)를 직접 읽어 확인한 사실을 근거로 작성했으며, 실제 고객 개인정보·계좌번호·비밀번호·API 키 등 민감정보는 이 문서에 전혀 포함하지 않았습니다.

작성일: 2026-09-09

---

## 1. 현재 사용 중인 기술 스택

| 영역 | 사용 기술 | 비고 |
|---|---|---|
| 프레임워크 | Next.js 14.2.35 (App Router) | `package.json` 확인 |
| 언어 | TypeScript | 프로젝트 전체가 `.ts`/`.tsx` |
| 프런트엔드 | React 18.3.1 + Tailwind CSS | 별도 UI 컴포넌트 라이브러리 없이 직접 구현(자체 `.card`/`.btn-primary` 등 유틸리티 클래스) |
| 데이터베이스 | Supabase(Postgres) | REST API(`@supabase/supabase-js`)로만 접근, **직접 Postgres 연결(DATABASE_URL) 없음** — 스키마 변경은 Supabase SQL Editor에서 수동 실행 필요 |
| 파일 저장 | Supabase Storage | 비공개 버킷 2개(`activity-photos`, `brain-test-files`), 브라우저가 서명 URL로 직접 업로드 |
| 인증 | 자체 구현(라이브러리 없음) | bcrypt(`bcryptjs`) 해시 + HMAC 서명 쿠키 |
| 엑셀/CSV 파싱 | `xlsx`(SheetJS, CDN 직접 배포판) | 이미 설치되어 있음 — 뇌기능검사 엑셀 업로드에 사용 중, **회계 거래내역 업로드에 그대로 재사용 가능** |
| PDF 파싱 | `pdf-parse` | 검사 결과지 PDF 텍스트 추출용, 영수증 OCR에 참고 가능 |
| AI 연동 | Anthropic API 직접 호출(SDK 없이 `fetch`) | `lib/ai/anthropicProvider.ts` — 이번 회계 기능과는 직접 관련 없음 |
| 배포 | Vercel + GitHub 자동배포 | 서버리스 함수 환경(실행시간·메모리 제한 있음) |
| 자동화 테스트 | 없음 | 지금까지 전 기능을 `npm run build` 타입체크 + 실제 운영 DB에 임시 데이터를 넣고 수동으로 검증하는 방식으로 진행됨 |

---

## 2. 프로젝트 폴더와 주요 파일 구조

```
brain-center/
├── supabase/
│   └── schema.sql            ★ DB 스키마 전체(테이블 30개) — Supabase SQL Editor에서 수동 실행
├── lib/
│   ├── data.ts                ★ 데이터 접근 계층(2,294줄) — Supabase 쿼리는 전부 여기에만 있음
│   ├── auth.ts                 인증/세션/권한 판단(146줄)
│   ├── types.ts                 전체 데이터 타입 정의(551줄)
│   ├── classSchedule.ts          수업요일 파싱 유틸(작은 파일)
│   ├── reportPayload.ts          학부모 화면용 데이터 조립
│   ├── ai/                       AI 어댑터(Claude 연동)
│   ├── extraction/                파일(PDF/엑셀/이미지) 텍스트·표 추출 파이프라인
│   ├── mtpris/, content/mtpris/    다원재능검사 전용 로직/문구
│   └── supabaseBrowserClient.ts    브라우저용 Supabase 클라이언트(anon 키)
├── app/
│   ├── page.tsx                  공개 홈페이지
│   ├── report/[token]/            학부모 결과지 열람(토큰+비밀번호)
│   ├── family/                    형제자매 통합 열람
│   ├── admin/                    ★ 관리자 영역(로그인 필요)
│   │   ├── login/                 관리자/선생님 로그인
│   │   ├── page.tsx                아동 목록(대시보드 겸용)
│   │   ├── children/[id]/          아동 상세(탭 10개: 기본정보/결과지/출결/뇌기능검사/검사비교/아동특성/뇌파훈련/사진/코멘트/월간리포트)
│   │   ├── staff/                  선생님 계정 관리(RBAC)
│   │   ├── audit-logs/             감사로그 화면
│   │   ├── consultations/, feedback/, makeup-requests/, parent-notices/, site/, blog/, visits/, test-templates/, class-records/
│   │   └── (회계 관련 화면 없음)
│   └── api/
│       ├── admin/                ★ 관리자 전용 API(각 라우트가 자체적으로 권한 확인)
│       ├── report/, staff/, consultations/, track/
├── components/
│   ├── admin/                    관리자 화면 조각(각 기능별 폼/목록 컴포넌트)
│   ├── home/, mtpris/, parent/    공개 홈페이지/다원재능/학부모 화면 조각
├── middleware.ts                  /admin 접근 보호(세션 쿠키 검증, 이중 방어)
├── .env.example                    필요한 환경변수 목록(값 없음)
└── package.json
```

이 프로젝트는 **"화면(app/api) — 데이터 접근(lib/data.ts) — 타입(lib/types.ts)"** 3단 구조를 처음부터 끝까지 일관되게 지켜왔습니다. 회계 기능도 이 구조를 그대로 따르는 것이 기존 코드와 가장 잘 맞습니다.

---

## 3. 현재 데이터베이스 종류와 전체 테이블 구조

**Supabase(Postgres, 관리형)**. 직접 접속 문자열은 없고 REST API(service_role 키)로만 접근합니다. 모든 테이블에 RLS(Row Level Security)가 켜져 있고 정책은 하나도 없어 `anon`/`authenticated` 롤은 기본적으로 아무 것도 못 보며, 실제 접근 제어는 애플리케이션 코드(로그인 세션 확인)가 전담합니다.

`supabase/schema.sql`(684줄) 기준 현재 **테이블 30개**:

| 분류 | 테이블 | 핵심 컬럼(요약) |
|---|---|---|
| 아동 원본 | `children` | id, name, grade, birth_year/date, status(active/waiting/ended), gender, guardian_name, **guardian_phone**, service_type, class_day, counselor, memo |
| 검사결과 | `reports`(서술형 기질검사), `mtpris_reports`(다원재능검사) | child_id, test_date, counselor, status, 결과 jsonb |
| 뇌기능검사 | `brain_tests` | child_id, test_date, indicators jsonb, ai_interpretation, approved_by/at, status(12단계 상태값) |
| 뇌파훈련 | `eeg_training_sessions`, `eeg_test_templates` | 세션별 기록, 검사종류별 기준값 |
| 학부모 링크 | `access_tokens`, `access_logs` | 토큰+비밀번호 해시, 열람 성공/실패 로그 |
| 사진 | `activity_photos`, `photo_students` | Storage 경로, 아이 다대다 태그 |
| 홈페이지 | `site_settings`, `notices` | 로그인 없이 보이는 공개 정보 |
| 출결 | `attendance_records` | child_id+class_date 유니크, present/absent, 보강일 |
| 보강신청 | `makeup_requests` | 학부모 제안 → 관리자 승인/거절 |
| 학부모 문의 | `parent_feedback` | 재원 학부모 전용 문의 |
| 방문통계 | `page_views` | 익명 방문자 카운트 |
| 수업기록 | `class_records`, `class_record_children`, `child_comments`, `comment_templates` | 날짜+활동명+참여 아동 목록+아이별 코멘트, 소프트삭제(`deleted_at`) 적용 |
| 월간리포트 | `monthly_reports` | 아이×월 유니크, 소프트삭제 적용 |
| 학부모 공지 | `parent_notices`, `parent_notice_reads` | 대상 조건별 발송, 소프트삭제 적용 |
| 상담신청 | `consultations` | 공개 홈페이지 신청 폼, IP 기록(레이트리밋용) |
| **RBAC(권한)** | `staff`, `child_staff_assignments` | 계정(admin/teacher role), 아동↔선생님 배정 |
| 아동 특성 | `child_traits` | AI 참고용, 화이트리스트 방식 |
| AI 이력 | `ai_generation_logs` | 호출 이력(개인정보는 해시만) |
| **감사로그** | `audit_logs` | actor_staff_id, actor_label, action, target_table/id, before/after jsonb — **범용 감사로그 인프라, 회계에도 그대로 재사용 가능** |

**회계·재무 관련 테이블은 현재 전혀 없습니다.**

id는 전 테이블 공통으로 `text` 기본키에 `"접두사_" + randomBytes(6).toString("hex")` 형식(예: `staff_6b37bd98e4d9`)을 씁니다. 금액 관련 컬럼이 하나도 없어 `numeric`/정수 처리 관례는 아직 이 프로젝트에 없습니다(4번 항목의 "결정 필요 사항"에서 다시 다룸).

---

## 4. 로그인 및 사용자 권한 처리 방식

두 개의 독립된 로그인이 **병행**됩니다(`lib/auth.ts`):

1. **관리자(공용계정)**: `ADMIN_PASSWORD` 환경변수 하나를 공유하는 단일 로그인. 성공 시 HMAC 서명된 쿠키(`bc_admin_session`) 발급. IP당 10분 8회 실패 시 차단(레이트리밋).
2. **선생님/스태프 계정**(`staff` 테이블): 전화번호+비밀번호(bcrypt 해시) 로그인. `role`이 `'admin'`(전체 관리자와 동급) 또는 `'teacher'`(담당 아동만) 중 하나. 별도 쿠키(`bc_staff_session`)로 관리자 로그인과 완전히 분리.

권한 판단은 아래 두 함수로 통일되어 있고, 이 세션의 감사(보안점검)에서 확인한 결과 대부분의 관리자 API/화면이 이 두 함수를 정확히 쓰고 있습니다.

```ts
// lib/auth.ts
export type CurrentActor = { kind: "legacy_admin" } | { kind: "staff"; staffId: string; role: "admin" | "teacher" };
export function getCurrentActor(): CurrentActor | null { ... }
export function isFullAdmin(actor: CurrentActor | null): boolean {
  return actor?.kind === "legacy_admin" || actor?.role === "admin";
}

// lib/data.ts
export async function actorCanAccessChild(actor: CurrentActor, childId: string): Promise<boolean> {
  if (actor.kind === "legacy_admin" || actor.role === "admin") return true;
  return isChildAssignedToStaff(actor.staffId, childId); // teacher는 배정된 아동만
}
```

`middleware.ts`가 `/admin/*` 전체를 1차로 보호하고(로그인 안 되어 있으면 로그인 화면으로 리다이렉트, teacher 역할은 관리자 전용 경로도 여기서 차단), 각 화면·API가 위 함수로 2차 확인하는 **이중 방어** 구조입니다. `/api/admin/*`는 middleware가 보호하지 않으므로(페이지만 보호) 모든 API 라우트가 자체적으로 `isFullAdmin`/`actorCanAccessChild`를 호출해야 하며, 실제로 그렇게 구현되어 있습니다.

**회계 기능에 바로 적용 가능한 지점**: `staff.role`은 지금 `'admin' | 'teacher'` 두 값만 허용하는 CHECK 제약이 걸려 있습니다(`role text not null check (role in ('admin', 'teacher'))`). "회계담당자"를 새 역할로 추가하려면 이 제약을 넓히는 작은 마이그레이션이 필요하고(과거 `ai_generation_logs.feature` 제약을 넓힌 전례와 동일한 패턴), 권한 판단 함수도 `isFullAdmin`과 나란히 `canAccessAccounting(actor)` 같은 함수를 하나 추가하면 됩니다.

---

## 5. 기존 아동·보호자·서비스·출결 데이터 구조

- **아동**(`children`): 이름, 학년, 생년월일, 상태(이용중/대기/종료), 성별, **보호자 이름·연락처**(관리자 화면 전용, 학부모 화면·URL에는 절대 노출 안 함), `service_type`(자유텍스트, 예: "뉴로피드백" — 고정 목록/코드가 아님), `class_day`(자유텍스트, 예: "월,수,금" — 요일만, 시간 정보 없음), 담당자, 메모. **아동 1명당 "본인부담금 얼마"류의 금액 필드는 전혀 없습니다.**
- **보호자**: 별도 테이블 없이 `children.guardian_name`/`guardian_phone`으로만 존재(형제자매는 같은 `guardian_phone` 문자열이 같은지로 추론하는 방식 — 정식 FK 관계 아님).
- **서비스 종류**(`service_type`): 고정된 코드 테이블이 아니라 각 아동에 직접 입력한 자유텍스트이고, 필터 목록도 "지금까지 입력된 값들의 집합"을 그때그때 계산해서 보여주는 방식입니다(`ChildListSection.tsx`). 즉 **"아동청소년심리지원"/"아동청소년비전형성" 같은 사업 구분이 지금은 이 필드에 사람이 손으로 적어넣는 것 이상의 의미를 갖지 않습니다.**
- **출결**(`attendance_records`): 아동×날짜 1행(유니크 제약), 출석/결석과 보강 여부·보강일만 있고 **시간이나 금액 정보는 없음**.
- **수업기록**(`class_records`/`class_record_children`): 날짜+활동명+참여 아동 목록. 여기에도 금액·비용 개념 없음.

**결론**: 회계와 직접 연결 지을 만한 기존 데이터는 사실상 "아동이 존재한다"는 사실과 "그 아동의 상태(이용중/대기/종료)" 정도이고, 사업 구분·본인부담금·정부지원금 같은 개념은 전부 새로 만들어야 합니다.

---

## 6. 회계 기능에서 재사용할 수 있는 기존 데이터/인프라

새로 만드는 것보다 **아래는 그대로 재사용**하는 것이 이 프로젝트의 일관된 방식(작은 단위 확장, 기존 코드 재사용 우선)과 맞습니다.

| 재사용 대상 | 위치 | 회계 기능에서의 쓰임 |
|---|---|---|
| `children` 테이블(id, status) | `lib/data.ts` | 본인부담금을 "어느 아동" 건인지 FK로 연결 |
| RBAC 구조(`staff`, `getCurrentActor`, `isFullAdmin`) | `lib/auth.ts`, `lib/data.ts` | "관리자·회계담당자만 접근" 요건을 새 역할/권한만 추가해서 바로 구현 가능 |
| **감사로그 인프라**(`audit_logs`, `writeAuditLog()`) | `lib/data.ts` | 회계자료 수정 이력 요건(13번)을 **새 테이블 없이** action 값만 추가해서 그대로 재사용 가능 — 이 프로젝트에서 가장 큰 재사용 포인트 |
| 소프트삭제 패턴(`deleted_at`) | `class_records`, `child_comments`, `monthly_reports`, `eeg_training_sessions` | 회계 원장 데이터도 실수 삭제 시 복구 가능해야 하므로 동일 패턴 적용 |
| 엑셀 파싱(`xlsx` 라이브러리 + `lib/extraction/parseSpreadsheet.ts`) | 이미 설치·구현됨 | 은행 거래내역 엑셀/CSV 업로드(9번)에 그대로 재사용 — **새 의존성 설치 불필요** |
| Storage 비공개 버킷 + 서명URL 업로드 패턴 | `activity_photos`, `brain_tests` | 영수증·증빙자료 첨부(9번)를 동일한 방식(새 버킷 1개 + 서명URL)으로 구현 가능 |
| 파일 중복 감지(`source_file_hash`, sha256) | `brain_tests` | 같은 거래내역 파일을 두 번 업로드하는 실수 방지에 재사용 가능 |
| id 생성 규칙(`접두사_hex(6)`), snake_case↔camelCase 매핑 규칙 | `lib/data.ts` 전역 | 새 테이블도 동일 규칙을 따르면 코드 일관성 유지 |

---

## 7. 새로 만들어야 할 데이터베이스 테이블(제안 초안)

아래는 **설계 초안**이며, 12번 항목의 "구현 전 결정 사항"이 확정된 뒤 실제 컬럼이 조정될 수 있습니다. 금액은 전부 소수점 없는 **정수(원 단위, `bigint`)**로 제안합니다(부동소수점 오차 방지).

### 7-1. `bank_accounts` — 센터가 관리하는 통장 목록
| 컬럼 | 타입 | 설명 |
|---|---|---|
| id | text PK | |
| name | text | 통장 별칭(예: "일반회계통장") — 실제 계좌번호는 마스킹해서 별도 컬럼에 |
| bank_name | text | 은행명 |
| account_no_masked | text | 마스킹된 계좌번호(끝 4자리만) — 원본 전체 번호는 저장하지 않거나 별도 보안 처리 |
| purpose | text | 용도 구분(일반회계/심리지원사업/비전형성사업/대응투자금 등) |
| opening_balance | bigint | 시스템 도입 시점의 이월 잔액(원) |
| opening_balance_date | date | 이월 잔액 기준일 |
| active | boolean | |
| created_at/updated_at | timestamptz | |

### 7-2. `accounting_programs` — 사업 구분(확장 가능한 코드 테이블)
| 컬럼 | 타입 | 설명 |
|---|---|---|
| id | text PK | |
| name | text | 예: "아동청소년심리지원사업", "아동청소년비전형성사업", "센터 일반회계" |
| code | text | 내부 코드 |
| active | boolean | |

`service_type`(자유텍스트)에 의존하지 않고 별도 코드 테이블로 두는 이유: 회계 사업 구분은 정부 보고 서식과 직결되어 오탈자가 나오면 안 되므로, 자유텍스트가 아니라 고정 목록에서 선택하게 하는 편이 안전합니다.

### 7-3. `bank_transactions` — 입출금 내역(핵심 원장)
| 컬럼 | 타입 | 설명 |
|---|---|---|
| id | text PK | |
| bank_account_id | text FK → bank_accounts | |
| transaction_date | date | |
| amount | bigint | 입금은 양수, 출금은 음수 (또는 별도 type 컬럼 + 절대값, 12번에서 결정) |
| transaction_type | text | 'income'(수입) / 'expense'(지출) / 'transfer'(계좌간 이체 — 중복집계 방지용으로 반드시 구분) |
| fund_source | text | 'government_subsidy'(정부지원금) / 'self_pay'(본인부담금) / 'matching_investment'(대응투자금) / 'other'(기타) — 5·6번 요건의 핵심 |
| program_id | text FK → accounting_programs | 어느 사업 소속인지 |
| category_id | text FK → accounting_categories | 지출 항목 분류(2번 요건) |
| child_id | text FK → children, null 허용 | 본인부담금 입금 등 특정 아동과 연결될 때만 |
| counterparty | text | 거래 상대방(적요) |
| memo | text | |
| import_batch_id | text, null 허용 | 엑셀 업로드로 들어온 경우 배치 식별자(9번, 되돌리기·추적용) |
| source_row_hash | text | 같은 행 중복 업로드 감지용(브레인테스트의 `source_file_hash`와 동일한 발상을 행 단위로) |
| created_by / updated_by | text | staff_id |
| created_at/updated_at | timestamptz | |
| deleted_at | timestamptz, null 허용 | 소프트삭제 |

### 7-4. `accounting_categories` — 지출/수입 항목 분류
| 컬럼 | 타입 | 설명 |
|---|---|---|
| id | text PK | |
| name | text | 예: "인건비", "임대료", "교재비", "간식비" 등 |
| kind | text | 'income' / 'expense' |
| program_id | text FK, null 허용 | 특정 사업 전용 항목이면 연결, 공통 항목이면 null |

### 7-5. `child_copay_records` — 아동별 본인부담금 청구·납부 관리
| 컬럼 | 타입 | 설명 |
|---|---|---|
| id | text PK | |
| child_id | text FK → children | |
| program_id | text FK → accounting_programs | |
| period | text | 'YYYY-MM' (월별 청구 기준) |
| billed_amount | bigint | 청구 금액 |
| paid_amount | bigint | 실제 납부액(분할 납부 가능성 고려해 청구액과 분리) |
| status | text | 'unpaid'(미납) / 'partial'(일부납부) / 'paid'(완납) / 'waived'(면제) |
| paid_at | date, null 허용 | |
| linked_transaction_id | text FK → bank_transactions, null 허용 | 실제 입금 거래와 매칭(선택) |
| memo | text | |
| created_at/updated_at | timestamptz | |

### 7-6. `accounting_attachments` — 영수증·증빙자료
| 컬럼 | 타입 | 설명 |
|---|---|---|
| id | text PK | |
| target_table | text | 'bank_transactions' 또는 'child_copay_records' 등(범용) |
| target_id | text | |
| storage_path | text | 새 비공개 Storage 버킷(예: `accounting-receipts`) 경로 |
| file_name | text | |
| uploaded_by | text | staff_id |
| uploaded_at | timestamptz | |

### 7-7. `bank_balance_checks` — 통장 실제잔액 vs 장부잔액 대사 기록
| 컬럼 | 타입 | 설명 |
|---|---|---|
| id | text PK | |
| bank_account_id | text FK | |
| check_date | date | |
| actual_balance | bigint | 통장 실제 잔액(사람이 확인해서 입력) |
| ledger_balance | bigint | 그 시점까지의 장부 합계(자동 계산 결과를 스냅샷으로 저장) |
| difference | bigint | actual - ledger |
| memo | text | 차이 발생 사유 등 |
| checked_by | text | staff_id |
| created_at | timestamptz | |

### 7-8. `monthly_ledger_closings` — 월별 마감(선택, 11번 요건과 연결)
| 컬럼 | 타입 | 설명 |
|---|---|---|
| id | text PK | |
| period | text | 'YYYY-MM' |
| program_id | text FK, null 허용 | |
| closed_at | timestamptz | |
| closed_by | text | staff_id |
| snapshot jsonb | 마감 시점의 수입/지출/잔액 요약을 그대로 얼려서 저장(이후 원장이 바뀌어도 마감 자료는 불변) | |

### 감사로그·권한은 새 테이블 불필요
- 13번(수정 이력·감사로그): **기존 `audit_logs` + `writeAuditLog()`를 그대로 재사용**, `action` 값만 `bank_transaction_created`/`bank_transaction_edited`/`bank_transaction_deleted`/`copay_status_changed` 등으로 추가.
- 14번(권한): `staff.role` 체크 제약을 넓히거나(`'admin'|'teacher'|'accountant'`), 혹은 `staff`에 `can_access_accounting boolean` 같은 별도 플래그를 추가하는 두 방식 중 하나 — 12번에서 결정 필요.

---

## 8. 기존 시스템에 영향을 최소화하는 구현 방법

이 프로젝트가 지금까지 15단계 넘게 확장해온 방식과 동일하게 진행하면 안전합니다.

1. **새 테이블만 추가, 기존 테이블은 손대지 않음**(단, `staff.role` 제약 확장과 `children`에 대한 FK 참조는 예외 — 둘 다 `add column if not exists`/`check` 재정의로 기존 행에 영향 없이 가능).
2. **기존 화면·API 코드는 전혀 수정하지 않고, 새 화면(`app/admin/accounting/**`)과 새 API(`app/api/admin/accounting/**`)만 추가** — 아동 목록, 검사, 출결 등 기존 화면은 그대로 유지.
3. `lib/data.ts`에 회계 전용 함수만 추가(기존 함수는 건드리지 않음), 필요하면 파일이 너무 커지므로(현재 2,294줄) `lib/accounting.ts`처럼 별도 파일로 분리하는 것을 검토(이 프로젝트에 이미 `lib/mtpris/`, `lib/extraction/`처럼 기능별 하위 디렉터리로 분리한 전례가 있음).
4. **middleware.ts의 `ADMIN_ONLY_PREFIXES`에 `/admin/accounting`을 추가**해서 회계 화면을 관리자·회계담당자 외에는 아예 접근 못 하게 이중 방어(기존 패턴 그대로).
5. Storage는 새 비공개 버킷(`accounting-receipts`)을 하나 더 만들고, 기존 두 버킷(`activity-photos`, `brain-test-files`)은 그대로 둠.
6. 마이그레이션은 항상 `create table if not exists`/`alter table add column if not exists` 형태로 작성해서, 실행을 몇 번 다시 하거나 순서가 꼬여도 안전하게(멱등하게) 만듦 — 지금 `schema.sql` 전체가 이 원칙을 지키고 있음.

---

## 9. 개인정보 및 회계자료 보안상 주의할 점

- **계좌번호·거래 상대방 정보는 아동 개인정보보다도 더 민감할 수 있음** — 화면에 표시할 때도 뒤 4자리만 노출하는 마스킹을 기본값으로 하고, 전체 계좌번호가 필요한 경우는 극히 제한.
- 지금 프로젝트는 서비스 키(`SUPABASE_SERVICE_ROLE_KEY`)로만 DB에 접속하고 RLS는 방어적 백업 장치로만 씀 — 회계 테이블도 동일하게 RLS를 켜고 `service_role`에만 권한을 부여해야 함(기존 패턴 그대로 따르면 자동으로 지켜짐).
- **최소 권한 원칙**: 회계담당자가 아동의 심리검사·상담메모 등 회계와 무관한 민감정보까지 볼 수 있게 설계하면 안 됨. `child_copay_records`가 `children`을 참조하더라도, 회계 화면에서는 아동의 "이름+본인부담금 현황"만 보여주고 검사결과·상담기록 화면 자체에는 접근 권한을 주지 않아야 함(현재 `isFullAdmin`/`actorCanAccessChild`와는 별도의, 더 좁은 권한 함수가 필요).
- **거래내역 엑셀 업로드 파일 자체**에도 계좌번호·거래상대방 이름이 그대로 들어있을 수 있으므로, 업로드 원본 파일을 증빙 목적으로 보관하더라도 비공개 버킷+서명URL 패턴(기존과 동일)을 반드시 적용.
- 감사로그(`audit_logs.before`/`after`)에 거래내역 전체를 스냅샷으로 남기면 계좌번호 등이 로그에도 누적되므로, **로그에는 요약(금액·날짜·카테고리 정도)만 남기고 계좌번호 원문은 제외**하는 편이 안전(이번 세션 보안점검에서 확인한 "감사로그도 결국 개인정보가 쌓이는 곳"이라는 원칙과 동일).
- 회계 화면은 반드시 `/admin/accounting`처럼 별도 경로로 묶어서 `middleware.ts`의 관리자 전용 목록에 넣고, 화면 자체에도 이중으로 권한 확인 코드를 넣어야 함(지난 보안점검에서 "미들웨어만 믿고 화면에 확인이 없던" 문제를 여러 곳에서 발견해 고친 전례가 있음 — 회계처럼 민감한 신규 기능은 처음부터 이 원칙을 지키고 시작해야 함).
- 보조금(정부지원금) 정산 자료는 관련 법령상 일정 기간(통상 5년 이상) 보관 의무가 있는 경우가 많음 — 삭제 기능은 반드시 소프트삭제로 하고, 완전 삭제(하드 삭제) 기능 자체를 만들지 않는 것을 권장.

---

## 10. 데이터 백업과 복구 방법

- 현재 이 프로젝트는 Supabase가 제공하는 자동 백업/PITR(Point-in-Time Recovery) 기능에 의존하고 있고, 애플리케이션 차원의 별도 백업 로직은 없음 — Supabase 요금제에 따라 백업 보관기간이 다르므로, **회계 데이터를 다루기 전에 현재 Supabase 플랜의 백업 정책을 먼저 확인**하는 것을 권장(코드로 확인 불가, 대시보드에서 확인 필요).
- 회계자료는 일반 서비스 데이터보다 복구 요구사항이 엄격할 수 있으므로 아래 2가지를 추가로 권장:
  1. **월별 마감 시 스냅샷을 별도 저장**(7-8번 `monthly_ledger_closings`) — 원장이 나중에 실수로 잘못 수정되어도 이미 마감된 월의 자료는 불변 스냅샷으로 남아 복구 기준점이 됨.
  2. **엑셀/CSV 업로드 원본 파일도 증빙으로 Storage에 그대로 보관** — 시스템에 문제가 생겨도 원본 거래내역을 다시 불러올 수 있는 재현 수단이 됨.
- 소프트삭제(`deleted_at`) 패턴을 회계 테이블에도 적용하면, 관리자/회계담당자의 실수 삭제는 화면에서 "삭제 항목 보기" 기능만 추가해도 즉시 복구 가능.

---

## 11. 단계별 개발 순서(제안)

이 프로젝트가 지금까지 지켜온 "작은 단위로 나누고, 각 단계마다 실제 동작 확인 후 다음 단계" 원칙을 그대로 적용하는 안입니다.

1. **스키마 확정**: 12번 "결정 사항"을 먼저 확정한 뒤 7번의 테이블 설계를 최종 확정(화면 없이 스키마+타입만).
2. **RBAC 확장**: `staff`에 회계담당자 권한 추가 + `canAccessAccounting()` 함수 + middleware 보호 경로 추가.
3. **통장 관리 화면**: `bank_accounts` CRUD(수기 등록만, 업로드 없이).
4. **수기 거래 입력**: `bank_transactions` 수동 등록/수정/삭제(엑셀 업로드 없이) — 사업/재원구분/카테고리 태깅 UI 포함.
5. **엑셀/CSV 업로드**: 기존 `xlsx` 파싱 인프라 재사용, 중복 감지, 업로드 후 사람이 확인·태깅하는 화면(자동 확정 금지 — 이 프로젝트 전체의 "AI/자동추출 결과는 사람이 확인해야만 반영" 원칙과 동일하게 적용).
6. **아동별 본인부담금 관리**: `child_copay_records` CRUD + 아동 상세 화면에 탭 추가(기존 10개 탭과 동일한 패턴).
7. **집계·리포트**: 사업별·통장별·월별 수입/지출/잔액 화면(2·7번 요건), 연간 결산 출력(인쇄 화면은 기존 `MtprisPrintSheet`류 패턴 재사용).
8. **증빙 첨부**: 새 Storage 버킷 + 서명URL 업로드(기존 사진 업로드 패턴 재사용).
9. **잔액 대사**: `bank_balance_checks` 입력 화면 + 자동 차이 계산.
10. **월별 마감**: `monthly_ledger_closings` — 마감 후 원장 수정 시 경고 또는 재승인 절차.
11. **감사로그 연동**: 각 API에 `writeAuditLog()` 호출 추가(새 테이블 불필요, 마지막에 일괄 적용 가능).

---

## 12. 구현 전에 반드시 결정해야 하는 사항

- **회계연도 기준**: 1~12월인지, 보조금 사업의 회계연도(예: 3월~다음해 2월 등 사업 지침 기준)인지.
- **"대응투자금"의 정확한 정의**: 센터가 보조금 사업에 자체적으로 매칭해서 부담하는 금액인지, 아니면 다른 의미인지 — 회계 처리 방식이 달라짐.
- **본인부담금 산정 규칙**: 아동마다 정액인지, 소득기준 등에 따라 차등인지, 월 단위인지 회차(세션) 단위인지.
- **회계담당자 권한 모델**: `staff.role`에 `'accountant'`를 새 역할로 추가할지(관리자보다 좁고 선생님과는 다른 제3의 역할), 아니면 기존 `role`과 별도로 `can_access_accounting` 같은 권한 플래그를 둘지 — 특히 "관리자이면서 회계담당자"인 경우와 "회계담당자이지만 아동 심리검사 자료는 못 보는" 경우를 어떻게 구분할지.
- **은행 엑셀/CSV 포맷**: 어느 은행(들)의 거래내역 양식을 지원할지 — 은행마다 컬럼 구성이 달라 업로드 파서를 은행별로 따로 만들어야 할 수 있음.
- **금액 단위/반올림 규칙**: 전부 원 단위 정수로 통일할지(권장), 소수점이 필요한 경우가 있는지.
- **계좌번호 저장 여부**: 전체 계좌번호를 시스템에 저장할지, 마스킹된 뒤 4자리만 저장하고 전체 번호는 시스템 밖(별도 보안 문서)에 둘지.
- **삭제 정책**: 회계 데이터의 완전 삭제(하드 삭제)를 아예 금지할지, 관리자에 한해 예외적으로 허용할지.
- **기존 `service_type`과의 관계**: 사업 구분(`accounting_programs`)을 아동의 `service_type`과 완전히 동기화할지, 서로 독립적으로 둘지(현재는 `service_type`이 자유텍스트라 그대로 사업 코드로 쓰기엔 오탈자 위험이 있음).

---

## 13. 예상되는 오류와 데이터 불일치 위험

- **거래내역 중복 입력**: 같은 엑셀 파일을 실수로 두 번 업로드하거나, 수기 입력 후 같은 내역을 엑셀로 또 올리는 경우 — 행 단위 해시(날짜+금액+적요 조합)로 중복 감지 로직이 반드시 필요.
- **계좌간 이체를 수입/지출로 이중 집계**: 통장 A에서 통장 B로 이체한 금액을 각각 "지출"과 "수입"으로 잘못 집계하면 전체 수입·지출 합계가 부풀려짐 — `transaction_type='transfer'`로 명확히 구분해서 집계에서 제외해야 함.
- **재원 구분(정부지원금/본인부담금/대응투자금) 태깅 누락·오분류**: 사람이 매 건 수동으로 태깅해야 하므로 누락되면 사업별 정산 금액이 틀어짐 — 미분류 건을 걸러내는 화면(예: "재원구분 없음" 목록)이 필요.
- **월 마감 후 소급 수정**: 이미 제출한 월별 장부를 나중에 고치면 정부 보고 자료와 시스템 자료가 달라짐 — 마감 잠금 또는 마감 후 수정 시 별도 승인·기록 절차 필요.
- **부동소수점 오차**: 금액을 실수(float)로 다루면 미세한 반올림 오차가 누적될 수 있음 — 반드시 정수(원 단위) 또는 `numeric` 타입 사용.
- **동시 입력 충돌**: 여러 관리자가 같은 통장 거래내역을 동시에 수정하면 마지막 저장만 남는 문제(현재 이 프로젝트 전체에 낙관적 잠금/버전 관리가 없음 — 회계 데이터는 특히 이 위험에 민감).
- **아동 삭제 시 본인부담금 기록 처리**: 현재 `children` 삭제는 하드 삭제(완전 삭제)이고, 이번 세션 보안점검에서도 이미 지적된 기존 gap임 — 아동이 삭제되면 그 아동과 연결된 본인부담금 기록도 고아 데이터가 되거나(FK가 `on delete cascade`면) 회계 기록 자체가 통째로 사라질 위험이 있음. **회계 기록은 아동이 삭제되어도 남아있어야 하므로, `child_copay_records.child_id`는 `on delete cascade`가 아니라 `on delete set null` 또는 아예 삭제를 막는 제약으로 설계해야 함**(반드시 결정 필요).
- **권한 설계 실수로 인한 과다 노출**: 회계담당자 권한을 `isFullAdmin`과 동일하게 두면, 원래 의도(회계만 보게)와 달리 아동 심리검사 자료까지 다 열리는 사고가 날 수 있음.

---

## 14. 현재 프로젝트에 이미 회계 또는 결제 관련 기능이 있는지

**없습니다.** `payment`, `invoice`, `ledger`, `bank_account`, `expense`, `income`, "회계", "결제", "장부", "통장" 등 키워드로 전체 저장소를 검색한 결과, 회계·결제·정산과 직접 관련된 코드나 테이블은 전혀 발견되지 않았습니다(다원재능검사 콘텐츠 파일 1곳에서 무관한 우연 매치만 있었음). 상담 신청(`consultations`)이나 학부모 문의(`parent_feedback`) 등 신청/문의 관련 기능은 있지만 금전 거래와는 무관합니다. 즉 이번 회계 시스템은 **완전히 새로운 도메인**이며, 3~9번 항목에서 정리한 재사용 가능한 인프라(RBAC, 감사로그, 파일 업로드, 엑셀 파싱, 소프트삭제 패턴) 위에 새로 지어야 합니다.

---

## 요약

- 기존 시스템은 아동 상담·검사·수업 기록 중심이며, 금전/회계 데이터나 테이블은 전무합니다.
- 다행히 RBAC, 감사로그, 파일 업로드(서명URL), 엑셀 파싱(`xlsx`), 소프트삭제 같은 **재사용 가능한 인프라가 이미 잘 갖춰져 있어**, 회계 기능은 이 위에 새 테이블(7~8개 제안)과 새 화면(`/admin/accounting/**`)만 추가하는 방식으로 기존 시스템에 영향 없이 확장 가능합니다.
- 다만 **12번의 결정 사항(회계연도, 대응투자금 정의, 본인부담금 산정 규칙, 권한 모델, 은행 포맷, 금액 단위, 삭제 정책)을 먼저 확정**해야 정확한 스키마를 설계할 수 있고, **13번의 위험(중복 입력, 이체 이중집계, 재원 태깅 누락, 마감 후 소급수정, 아동 삭제 시 회계기록 보존)**은 설계 단계에서부터 고려해야 나중에 데이터 정합성 문제가 생기지 않습니다.
- 구현은 12개 항목을 한 번에 만들지 않고, 11번 순서대로 작은 단위로 나눠 단계마다 검증하며 진행하는 것을 권장합니다.

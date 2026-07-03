# 학습심리브레인센터 결과 리포트 웹앱 (MVP)

아동·청소년 기질검사 결과를 센터에서 입력·관리하고,
학부모님이 문자/카카오톡 링크로 안전하게 확인할 수 있는 반응형 웹앱입니다.

- **관리자**: 로그인 → 아동 목록 → 결과 입력·수정 → A4 인쇄/PDF 저장 → 학부모 링크 복사
- **학부모**: 개별 링크 접속 → 비밀번호 입력 → 모바일 카드형 결과지 열람 (이름은 김OO로 표시, 인쇄 기능 없음)

---

## 1. 처음 실행하는 방법

컴퓨터에 [Node.js](https://nodejs.org) (LTS 버전)가 설치되어 있어야 합니다.

데이터는 Supabase에 저장됩니다 (JSON 파일 방식에서 전환됨, 6번 참고). 처음 실행 전에:

1. Supabase 프로젝트를 만들고 `supabase/schema.sql`을 SQL Editor에서 실행합니다.
2. `.env.local`에 `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `ADMIN_PASSWORD`, `SESSION_SECRET`을 채웁니다.

```bash
# 1) 프로젝트 폴더에서 필요한 프로그램 설치 (처음 한 번만)
npm install

# 2) 개발 서버 실행
npm run dev
```

브라우저에서 아래 주소로 접속하세요.

| 화면 | 주소 |
|---|---|
| 첫 화면 | http://localhost:3000 |
| 관리자 로그인 | http://localhost:3000/admin (`.env.local`의 `ADMIN_PASSWORD`) |
| 학부모 결과지 | 관리자 화면에서 아동 등록 → 검사 리포트 추가(3번) → 링크 발급 후 발급된 주소로 접속 |

DB가 빈 상태로 시작하므로 샘플 데이터/샘플 비밀번호는 없습니다. 관리자 화면에서 직접 아동을 등록하고 리포트·링크를 발급하세요.

---

## 2. 파일 구조 한눈에 보기

```
brain-center/
├── supabase/
│   └── schema.sql               ★ DB 스키마 (children/reports/mtpris_reports/access_tokens/access_logs)
│                                  Supabase SQL Editor에서 실행. 모든 테이블 RLS 켜짐 + 정책 없음
│                                  (앱은 service_role 키로만 접근, RLS는 방어적 백업)
│
├── lib/
│   ├── data.ts                  ★ 데이터 접근 계층 — Supabase 쿼리는 전부 여기에만 있음
│   ├── auth.ts                  비밀번호 해시(bcrypt), 세션, 이름 마스킹
│   ├── types.ts                 서술형 리포트 데이터 구조 정의
│   ├── content/mtpris/          MT-PRIS 기질별 문장 템플릿 (5번 참고)
│   └── mtpris/                  MT-PRIS 리포트 생성 엔진 + 학부모용 마스킹
│
├── app/
│   ├── page.tsx                 첫 화면 (안내)
│   ├── report/[token]/          학부모 결과지 (비밀번호 → 서술형/MT-PRIS 자동 분기)
│   ├── admin/                   관리자 영역 (로그인 필요)
│   │   ├── login/               관리자 로그인
│   │   ├── page.tsx             아동 목록 + 새 아동 등록
│   │   └── children/[id]/
│   │       ├── page.tsx         아동 상세 (검사 이력 + 학부모 링크 발급/회수)
│   │       ├── reports/[id]/    서술형 리포트 수정(edit) / A4 인쇄(print)
│   │       └── mtpris/[id]/     MT-PRIS 입력(edit) / A4 인쇄(print)
│   └── api/                     서버 기능 (로그인, 아동 등록, 링크 발급/회수, 비밀번호 검증, 저장)
│
├── components/                  화면 조각들 (결과지 뷰어, 입력 폼, 그래프 등)
│   ├── admin/                   아동 등록 폼, 학부모 링크 발급/회수 패널
│   └── mtpris/                  MT-PRIS 전용 화면 조각 (그래프, 모바일 뷰, 입력 폼, 인쇄)
├── middleware.ts                /admin 접근 보호 (로그인 확인)
├── app/globals.css              디자인 + A4 인쇄용 CSS
└── .env.local                   ★ 비밀번호·Supabase 설정 파일 (절대 공유 금지!)
```

---

## 3. 일상 운영 방법 (MVP 기준)

### 새 아동 추가하기
관리자 화면 → 아동 목록 하단의 **"+ 새 아동 등록"** 버튼으로 이름·학년·출생연도(선택)를
입력하면 바로 추가됩니다. (내부적으로 Supabase `children` 테이블에 저장되며, id는 자동 생성됩니다.)

### 새 검사 리포트 추가하기 (서술형 기질검사)
관리자 화면에는 아직 "새 리포트 만들기" 버튼이 없습니다 (다음 작업 후보, 7번 참고).
지금은 Supabase 대시보드 → Table Editor → `reports` 테이블에서 **Insert row**로
최소 항목(`id`, `child_id`, `test_type`="temperament", `test_type_name`, `test_date`,
`counselor`, `status`="draft", `summary`/`scores`/`details`/`parent_guide`/`center_plan`은
빈 값 `{}`·`[]`)만 채운 뒤 저장하세요. 이후 관리자 화면의 **수정** 버튼으로 내용을
편하게 입력하면 됩니다. (`id`는 겹치지 않는 임의 문자열이면 됩니다, 예: `report_` + 임의 문자열.)

> MT-PRIS(다원재능) 검사를 추가하는 방법은 5번 섹션을 참고하세요. 문장을 직접 쓰지 않고
> 대표기능·바탕기능·점수 4가지만 입력하면 리포트 전체가 자동으로 만들어집니다.

### 학부모 링크 발급하기
1. 관리자 화면 → 아동 상세 → 해당 리포트 카드의 **"링크 발급"** 버튼을 누릅니다.
2. 학부모 비밀번호(4자 이상)를 입력하고, 필요하면 만료일을 지정한 뒤 **발급**을 누릅니다.
3. 발급 직후 화면에 평문 비밀번호가 **한 번만** 표시됩니다 — 이 순간 복사해서
   **링크는 링크대로, 비밀번호는 별도 메시지로** 문자/카카오톡을 통해 전달하세요.
   (비밀번호는 해시로만 저장되므로 이 화면을 벗어나면 다시 확인할 수 없습니다.)

> 링크를 차단하고 싶으면 같은 카드의 **"비활성화"** 버튼을 누르면 즉시 접근이 막힙니다.
> 이미 활성 링크가 있는 리포트는 먼저 비활성화해야 새 링크를 발급할 수 있습니다.

### 결과지 인쇄 / PDF 저장
관리자 → 아동 상세 → **인쇄 / PDF** → [인쇄하기] 버튼 → 인쇄 창에서
프린터를 고르거나 **"PDF로 저장"**을 선택하면 A4 결과지가 만들어집니다.

---

## 4. 보안 안내 (반드시 읽어 주세요)

이 서비스는 **아동의 개인정보와 심리검사 결과**를 다룹니다.

1. **`.env.local` 파일을 절대 공유하거나 GitHub에 올리지 마세요.**
   실제 운영 전 `ADMIN_PASSWORD`와 `SESSION_SECRET`을 강력한 값으로 바꾸세요.
   `SUPABASE_SERVICE_ROLE_KEY`는 특히 강력한 키이므로 절대 브라우저 코드나 공개 저장소에 노출하지 마세요.
2. 학부모 비밀번호는 **bcrypt 해시로만** 저장됩니다. 원문 비밀번호를 파일·코드 어디에도 적어두지 마세요.
3. 학부모 화면의 이름은 서버에서 마스킹(김OO)되어 전달되며, 학부모 화면에는 인쇄 기능이 없습니다.
4. 결과지 하단의 "외부 공유를 삼가 주세요" 고지 문구는 삭제하지 마세요.
5. **개인정보 수집·이용 동의서에 다음 항목을 포함하세요.**
   > "검사 결과를 온라인(문자·카카오톡 링크 및 웹페이지)으로 보호자에게 제공하는 것에 동의합니다."
   아동 정보이므로 법정대리인(보호자) 동의가 기본 전제입니다.
6. **실제 운영 배포 시 필수**
   - HTTPS 도메인에서만 운영 (Vercel은 기본 제공)
   - ~~JSON 파일 → 데이터베이스 전환~~ / ~~bcrypt 업그레이드~~ — 완료됨 (6번 참고)
   - 아직 없음: 로그인 연속 실패 시 잠금 (관리자/학부모 모두). 필요해지면 추가 검토

## 5. MT-PRIS(다원재능) 리포트 — 자동 생성형 검사

기존 서술형 기질검사와 별도로, **입력값 5가지만으로 리포트 전체가 자동 생성**되는
MT-PRIS 검사가 추가되어 있습니다. 문장을 직접 입력하지 않고, 아래 값만 입력하면
학부모 모바일 화면과 인쇄용 A4 결과지가 같은 데이터로 동시에 만들어집니다.

- 대표기능 (P1 개척형 ~ S3 상상형, 활동할 때의 나)
- 바탕기능 (p1~s3, 회복할 때의 나)
- PRIS 현재성 점수 P/R/I/S (0~100)
- 검사일 · 담당자
- 상담 메모 (선택, 기본 비공개)

### 파일 구조

```
lib/content/mtpris/       ★ 기질별 문장 템플릿 (도메인별로 분리, 여기만 고치면 모든 리포트에 반영)
├── types.ts               기질 코드·기준 명칭·금지 명칭 정의
├── index.ts                통합 진입점 + 기질명 자동 검증 (틀린 이름이면 빌드 시 에러)
├── pris.ts                 PRIS 4에너지 + 점수 구간별 해석
├── traits.ts                대표기질 12유형 특성 (학부모 공개용 순화 문장)
├── main-raw.ts             ⚠️ 원자료 (세계관·두려움 등) — 상담사용 부록 전용, 학부모 화면 사용 금지
├── rest.ts                  바탕기능 12유형 + 쉼 에너지 충전/방전
├── learning.ts               학습스타일 4유형
├── talents.ts                수행능력 12개 + 덕성능력 32개 + 매칭표
├── career.ts                 직무적합성 12유형
├── comparison.ts              "타고난 모습 vs 지금의 모습" 비교 해석
└── closing.ts                기질별 마무리 글귀

lib/mtpris/
├── types.ts        저장값(MtprisRawInput)과 생성 콘텐츠(MtprisContent) 타입
├── generate.ts      원본 입력값 → 전체 리포트 콘텐츠 조합 (모바일·인쇄 공용)
└── mask.ts           학부모용: counselorAppendix(상담사 전용 정보) 제거

components/mtpris/
├── QuadrantChart.tsx    PRIS 사분면 그래프 (모바일·인쇄 공용)
├── MtprisReportView.tsx  학부모 모바일 화면 (핵심 요약 + 가정 지도법 중심)
├── MtprisEditForm.tsx    관리자 입력 폼
└── MtprisPrintSheet.tsx  A4 인쇄 화면 (상세 해석 + 상담사용 부록)

mtpris_reports 테이블(Supabase)   ★ 저장되는 유일한 데이터 (문장은 저장 안 함, 입력값만 저장)
```

### 문장을 수정하고 싶을 때

예를 들어 P1(개척형)의 "힘이 되는 방법" 문장을 고치고 싶다면 `lib/content/mtpris/traits.ts`에서
`TRAIT_BRIEF.P1.good` 배열만 수정하면 됩니다. 이미 만들어진 모든 아이의 리포트에 즉시 반영됩니다
(문장을 DB에 저장하지 않고 조회 시점에 조합하기 때문입니다).

### ⚠️ 기질명 기준 (절대 변경 금지)

`lib/content/mtpris/types.ts`의 `CANONICAL_NAMES`가 유일한 기준입니다.

> P1 개척형 · P2 지휘형 · P3 진취형 · R1 성취형 · R2 유지형 · R3 봉사형 ·
> I1 절충형 · I2 혁신형 · I3 재치형 · S1 양육형 · S2 충실형 · S3 상상형

과거 오기(P3 구도형, I3 전달형, S2 통찰형, S3 초월형)가 콘텐츠에 섞이면
`lib/content/mtpris/index.ts`의 `assertCanonicalNames()`가 **개발 서버 기동 시점에 즉시 에러**를 발생시킵니다.

### ⚠️ 원자료(MAIN_RAW)와 상담 메모 처리

- 세계관·두려움·욕망/분노 등 유형론 원문(`main-raw.ts`)은 **상담사용 부록에만** 사용됩니다.
  학부모 모바일 화면과, 인쇄 시 "상담사용 부록 포함" 체크를 해제한 결과물에는 절대 나오지 않습니다.
- 인쇄 화면 상단의 **"상담사용 부록 포함"** 체크박스(화면 전용, 인쇄되지 않음)로 부록 페이지를
  켜고 끌 수 있습니다. **학부모에게 전달하는 인쇄물은 반드시 체크를 해제하고 인쇄하세요.**
- 상담 메모는 **기본적으로 학부모에게 비공개**입니다. 입력 화면에서 "이 메모를 학부모 화면에도
  공개합니다" 토글을 켰을 때만 모바일·인쇄본에 노출됩니다.

### 새 MT-PRIS 검사 추가하기

서술형 리포트와 마찬가지로, 관리자 화면에 아직 "새 리포트 만들기" 버튼이 없으므로
Supabase Table Editor → `mtpris_reports` 테이블에서 최소 항목(`id`, `child_id`,
`main_type`, `sub_type`, `scores`, `test_date`, `counselor`, `status`="draft")을
직접 추가한 뒤, 관리자 화면의 **수정** 버튼으로 나머지를 입력하세요. 학부모 링크는
데이터를 직접 만질 필요 없이 아동 상세 화면의 **"링크 발급"** 버튼으로 발급하면 됩니다
(3번 "학부모 링크 발급하기" 참고, `reportKind`는 화면이 자동으로 채워줍니다).

---

## 6. 데이터베이스 (Supabase)

JSON 파일 저장 방식에서 Supabase(Postgres)로 전환 완료. 화면·API 코드는 전혀 건드리지
않고 **`lib/data.ts` 안의 함수 내용만** 교체하는 방식으로 진행했습니다 (함수 시그니처는
이전과 동일).

### 처음 연결하는 방법
1. [supabase.com](https://supabase.com)에서 새 프로젝트 생성
2. 프로젝트의 SQL Editor에 `supabase/schema.sql` 전체를 붙여넣고 실행
   (5개 테이블: `children`, `reports`, `mtpris_reports`, `access_tokens`, `access_logs`)
3. Project Settings → API에서 **Project URL**과 **service_role** 키(anon 키 아님)를 복사
4. `.env.local`에 `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`로 채워넣기

### 보안 구조
- 5개 테이블 모두 RLS(Row Level Security)가 켜져 있고 정책은 하나도 없습니다 →
  anon/authenticated 롤은 기본적으로 아무 것도 조회·수정할 수 없습니다.
- 앱은 **service_role 키**로만 Supabase에 접속합니다 (`lib/data.ts`). 이 키는 RLS를
  우회하므로, 실제 접근 제어는 지금처럼 애플리케이션 코드(관리자 세션 확인, 학부모
  비밀번호 bcrypt 비교)가 담당합니다. RLS는 anon 키가 실수로 유출되더라도 데이터가
  노출되지 않게 막는 방어적 백업 장치입니다.
- `SUPABASE_SERVICE_ROLE_KEY`는 절대 `NEXT_PUBLIC_` 접두사를 붙이거나 클라이언트
  코드에서 사용하지 마세요 — 서버 코드(`lib/data.ts`)에서만 사용됩니다.
- 학부모 비밀번호는 bcrypt로 해시되어 `access_tokens.password_hash`에 저장됩니다.
- 학부모 링크 열람 시도(성공/실패)는 `access_logs` 테이블에 자동 기록됩니다.

### 컬럼 매핑
DB 컬럼은 snake_case(`child_id`, `test_date` 등), 앱 코드는 camelCase(`childId`,
`testDate` 등)를 씁니다. `lib/data.ts`의 각 `SELECT`문에서 별칭(`childId:child_id`)으로
자동 변환하므로 다른 파일은 이 차이를 신경 쓸 필요가 없습니다.

---

## 7. 앞으로 확장할 수 있는 기능

- 뇌파검사 / 학습스타일검사 리포트 (데이터의 `testType`으로 이미 구분 가능)
- 상담기록, 월별 수업기록
- 결과 등록 시 카카오 알림톡/문자 자동 발송
- 같은 아이의 검사 결과 시계열 비교
- 관리자 화면에서 새 검사 리포트 생성 (현재는 Supabase Table Editor에서 항목을 직접 추가한 후 수정 화면에서 편집)

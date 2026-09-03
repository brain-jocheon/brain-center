-- =====================================================================
-- 학습심리브레인센터 결과 리포트 웹앱 — Supabase 스키마
-- ---------------------------------------------------------------------
-- Supabase 대시보드 → SQL Editor에 이 파일 전체를 붙여넣고 실행하세요.
--
-- [보안] 모든 테이블은 RLS(Row Level Security)를 켜두고 정책은 하나도
-- 만들지 않습니다 → anon/authenticated 롤은 기본적으로 아무 것도 못 봅니다.
-- 앱(lib/data.ts)은 SUPABASE_SERVICE_ROLE_KEY(서버 전용 비밀 키)로만
-- 접속하며, service_role은 RLS를 우회합니다. 즉 실제 접근 제어는
-- 지금처럼 애플리케이션 코드(관리자 세션 확인, 학부모 비밀번호 해시
-- 비교)가 담당하고, 이 RLS는 만에 하나 anon 키가 유출되더라도
-- 아무 데이터도 노출되지 않게 막는 방어적 백업 장치입니다.
-- =====================================================================

create table if not exists children (
  id text primary key,
  name text not null,
  grade text not null,
  birth_year int,
  created_at date not null default current_date,
  status text not null default 'active' check (status in ('active', 'waiting', 'ended')),
  birth_date date,
  gender text,
  guardian_name text,
  -- [보안] 보호자 연락처는 학부모 화면·URL에 절대 노출하지 않습니다. 관리자 화면 전용.
  guardian_phone text,
  service_type text,
  class_day text,
  counselor text,
  memo text
);
-- 이미 만들어진 프로젝트에서 실행 시 컬럼만 추가 (새 설치에서는 위 CREATE TABLE에 이미 포함되어 no-op)
alter table children add column if not exists status text not null default 'active';
alter table children add column if not exists birth_date date;
alter table children add column if not exists gender text;
alter table children add column if not exists guardian_name text;
alter table children add column if not exists guardian_phone text;
alter table children add column if not exists service_type text;
alter table children add column if not exists class_day text;
alter table children add column if not exists counselor text;
alter table children add column if not exists memo text;
-- status를 2단계(active/archived)에서 3단계(active/waiting/ended)로 확장.
-- 기존 데이터는 전부 'active'뿐이라 안전하게 확장 가능 (active=이용중, waiting=대기, ended=종료)
alter table children drop constraint if exists children_status_check;
alter table children add constraint children_status_check check (status in ('active', 'waiting', 'ended'));

create table if not exists reports (
  id text primary key,
  child_id text not null references children(id) on delete cascade,
  test_type text not null,
  test_type_name text not null,
  test_date date not null,
  counselor text not null,
  status text not null check (status in ('draft', 'published')),
  summary jsonb not null,
  scores jsonb not null default '[]',
  details jsonb not null default '[]',
  parent_guide jsonb not null,
  center_plan jsonb not null
);
create index if not exists reports_child_id_idx on reports(child_id);

create table if not exists mtpris_reports (
  id text primary key,
  child_id text not null references children(id) on delete cascade,
  test_type text not null default 'mtpris',
  test_date date not null,
  counselor text not null,
  status text not null check (status in ('draft', 'published')),
  main_type text not null,
  sub_type text not null,
  scores jsonb not null,
  memo text,
  memo_public boolean not null default false
);
create index if not exists mtpris_reports_child_id_idx on mtpris_reports(child_id);

create table if not exists access_tokens (
  token text primary key,
  report_id text not null,
  report_kind text not null check (report_kind in ('temperament', 'mtpris')),
  password_hash text not null,
  expires_at date,
  active boolean not null default true,
  created_at timestamptz not null default now()
);
create index if not exists access_tokens_report_id_idx on access_tokens(report_id);

-- 열람 기록 — 학부모 링크 접속 시도(성공/실패)를 남깁니다 (README 4번 운영 필수 항목)
create table if not exists access_logs (
  id bigserial primary key,
  token text not null,
  report_id text,
  success boolean not null,
  ip text,
  viewed_at timestamptz not null default now()
);
create index if not exists access_logs_token_idx on access_logs(token);

alter table children enable row level security;
alter table reports enable row level security;
alter table mtpris_reports enable row level security;
alter table access_tokens enable row level security;
alter table access_logs enable row level security;

-- [중요] RLS 우회 권한과 테이블 권한(GRANT)은 Postgres에서 별개입니다.
-- service_role이 RLS는 우회하더라도, 테이블 자체에 대한 SELECT/INSERT/UPDATE/DELETE
-- 권한이 없으면 "permission denied for table ..." 에러가 납니다. 앱은 service_role
-- 키로만 접속하므로 이 롤에 명시적으로 권한을 부여합니다. anon/authenticated에는
-- 아무 것도 주지 않아 RLS와 이중으로 접근을 막습니다.
grant usage on schema public to service_role;
grant select, insert, update, delete on
  children, reports, mtpris_reports, access_tokens, access_logs
  to service_role;
grant usage, select on all sequences in schema public to service_role;

-- =====================================================================
-- 2단계: 활동 사진/앨범
-- ---------------------------------------------------------------------
-- 비공개 Storage 버킷 + activity_photos(사진) + photo_students(사진↔아이 다대다).
-- 모든 읽기는 서버가 그때그때 만드는 단기 서명 URL로만 이루어지므로
-- storage_path 자체는 어디에도 그대로 노출되지 않습니다.
-- =====================================================================

insert into storage.buckets (id, name, public, file_size_limit)
values ('activity-photos', 'activity-photos', false, 8388608)
on conflict (id) do nothing;

create table if not exists activity_photos (
  id text primary key,
  storage_path text not null,
  activity_date date not null,
  activity_name text not null,
  activity_type text not null check (activity_type in ('class', 'craft', 'cooking', 'neurofeedback', 'event', 'other')),
  description text,
  is_public_to_parent boolean not null default false,
  -- 특정 아이 태그와 무관하게, 로그인(토큰+비밀번호 인증)한 모든 학부모에게 보이는
  -- "센터 소식" 피드용 플래그. is_public_to_parent(특정 아이 태그 기반 공개)와는 별개.
  is_public_to_blog boolean not null default false,
  memo text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists activity_photos_date_idx on activity_photos(activity_date desc);
-- 이미 만들어진 프로젝트에서 실행 시 컬럼만 추가 (새 설치에서는 위 CREATE TABLE에 이미 포함되어 no-op)
alter table activity_photos add column if not exists is_public_to_blog boolean not null default false;

create table if not exists photo_students (
  photo_id text not null references activity_photos(id) on delete cascade,
  student_id text not null references children(id) on delete cascade,
  primary key (photo_id, student_id)
);
create index if not exists photo_students_student_idx on photo_students(student_id);

alter table activity_photos enable row level security;
alter table photo_students enable row level security;
grant select, insert, update, delete on activity_photos, photo_students to service_role;

-- =====================================================================
-- 홈페이지 관리: 센터소개/위치 편집 + 공지사항
-- ---------------------------------------------------------------------
-- 공지사항은 로그인 없이 볼 수 있는 공개 홈페이지에 그대로 노출되므로,
-- 활동 사진(activity_photos)과 달리 별도 공개 플래그 없이 작성 즉시 공개됩니다.
-- 아이 관련 개인정보/사진은 여기 절대 넣지 않도록 관리자 화면 안내문으로 주의를 줍니다.
-- =====================================================================

create table if not exists site_settings (
  id text primary key default 'default',
  about_text text,
  address text,
  phone text,
  updated_at timestamptz not null default now()
);
insert into site_settings (id) values ('default') on conflict (id) do nothing;

create table if not exists notices (
  id text primary key,
  title text not null,
  body text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists notices_created_at_idx on notices(created_at desc);

alter table site_settings enable row level security;
alter table notices enable row level security;
grant select, insert, update, delete on site_settings, notices to service_role;

-- =====================================================================
-- 홈페이지 "아이 이름 + 비밀번호"로 바로 로그인
-- ---------------------------------------------------------------------
-- 고유 링크(토큰) 없이도 홈페이지에서 이름+비밀번호로 결과지를 찾을 수 있게
-- 합니다. 이 시도는 access_logs에 token=null로 기록해 IP별 시도 횟수를
-- 세어 무차별 대입을 늦추는 용도로 씁니다 (token 컬럼을 nullable로 변경).
-- =====================================================================
alter table access_logs alter column token drop not null;

-- =====================================================================
-- 뇌기능검사: 보고서 파일 업로드(보관용) + 관리자가 직접 입력하는 지표·의견
-- ---------------------------------------------------------------------
-- 장비마다 보고서 양식이 달라 자동으로 숫자를 읽어내는 건 정확도가 낮으므로,
-- 원본 파일은 비공개로 보관만 하고 지표(label/value 자유 입력)와 의견은
-- 상담사가 직접 입력합니다. is_public_to_parent가 true일 때만 학부모 화면에
-- (원본 파일 없이) 지표·의견 요약만 노출됩니다.
-- =====================================================================

insert into storage.buckets (id, name, public, file_size_limit)
values ('brain-test-files', 'brain-test-files', false, 15728640)
on conflict (id) do nothing;

create table if not exists brain_tests (
  id text primary key,
  child_id text not null references children(id) on delete cascade,
  test_date date not null,
  counselor text not null,
  file_storage_path text,
  file_name text,
  indicators jsonb not null default '[]',
  opinion text,
  is_public_to_parent boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists brain_tests_child_id_idx on brain_tests(child_id);

alter table brain_tests enable row level security;
grant select, insert, update, delete on brain_tests to service_role;

-- =====================================================================
-- 출결/보강 기록
-- ---------------------------------------------------------------------
-- 하루(child_id, class_date)당 한 행. is_makeup=true면 그 날짜 자체가
-- 보강 수업일이라는 뜻이고, status='absent'일 때 makeup_date를 채우면
-- "그 결석에 대해 보강이 예정된 날짜"를 의미합니다(아직 실제 보강 수업
-- 당일 출결은 별도 행으로 기록). memo는 관리자 전용(결석 사유 등) —
-- 학부모 화면에는 절대 내려가지 않습니다.
-- =====================================================================

create table if not exists attendance_records (
  id text primary key,
  child_id text not null references children(id) on delete cascade,
  class_date date not null,
  status text not null check (status in ('present', 'absent')),
  is_makeup boolean not null default false,
  makeup_date date,
  memo text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (child_id, class_date)
);
create index if not exists attendance_records_child_date_idx on attendance_records(child_id, class_date desc);

alter table attendance_records enable row level security;
grant select, insert, update, delete on attendance_records to service_role;

-- =====================================================================
-- 보강 희망일 요청 (학부모가 제출, 관리자가 승인/거절)
-- ---------------------------------------------------------------------
-- 학부모는 결석일을 눌러 원하는 보강 날짜를 제안만 할 수 있고, 실제
-- attendance_records.makeup_date 반영은 관리자가 승인해야 이루어집니다.
-- =====================================================================

create table if not exists makeup_requests (
  id text primary key,
  child_id text not null references children(id) on delete cascade,
  original_class_date date,
  requested_date date not null,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  parent_memo text,
  admin_memo text,
  created_at timestamptz not null default now(),
  reviewed_at timestamptz
);
create index if not exists makeup_requests_child_idx on makeup_requests(child_id);
create index if not exists makeup_requests_status_idx on makeup_requests(status);

alter table makeup_requests enable row level security;
grant select, insert, update, delete on makeup_requests to service_role;

-- =====================================================================
-- 홈페이지 "카카오톡 문의하기" 버튼 — 실제 카카오톡 채널 URL
-- ---------------------------------------------------------------------
-- 예: https://pf.kakao.com/_xxxxxxx  (미입력 시 버튼은 전화 연결로 대체됨)
-- =====================================================================
alter table site_settings add column if not exists kakao_url text;

-- =====================================================================
-- 학부모 마이페이지: 문의/건의사항
-- ---------------------------------------------------------------------
-- 학부모가 "문의/건의사항" 카드에서 남기는 글. child_id는 학부모가 직접
-- 보내는 게 아니라 서버가 이미 검증된 access 토큰으로부터 확인합니다
-- (다른 아이 이름으로 문의를 남길 수 없음 — makeup_requests와 동일한 패턴).
-- =====================================================================
create table if not exists parent_feedback (
  id text primary key,
  child_id text not null references children(id) on delete cascade,
  type text not null default 'other' check (type in ('class','makeup','share','suggestion','other')),
  title text not null,
  content text not null,
  status text not null default 'pending' check (status in ('pending','reviewed','answered')),
  admin_reply text,
  created_at timestamptz not null default now(),
  reviewed_at timestamptz
);
create index if not exists parent_feedback_child_idx on parent_feedback(child_id);
create index if not exists parent_feedback_status_idx on parent_feedback(status);

alter table parent_feedback enable row level security;
grant select, insert, update, delete on parent_feedback to service_role;

-- =====================================================================
-- 일반 방문자 통계 (비밀번호 없이 그냥 홈페이지 등을 구경한 방문)
-- ---------------------------------------------------------------------
-- access_logs는 학부모가 비밀번호를 입력해서 "확인"한 시도만 기록합니다.
-- 이 테이블은 그와 별개로, 로그인 여부와 무관하게 페이지를 열람한 것
-- 자체를 기록합니다. visitor_id는 개인정보가 아닌 브라우저 로컬 저장소의
-- 무작위 값(로그인 계정과 무관)이라 실명과 연결되지 않습니다.
-- =====================================================================
create table if not exists page_views (
  id bigserial primary key,
  path text not null,
  visitor_id text not null,
  viewed_at timestamptz not null default now()
);
create index if not exists page_views_viewed_at_idx on page_views(viewed_at desc);
create index if not exists page_views_visitor_idx on page_views(visitor_id);

alter table page_views enable row level security;
grant select, insert, update, delete on page_views to service_role;
-- [주의] bigserial(id)은 내부적으로 시퀀스를 따로 만드는데, 테이블 GRANT만으로는
-- 그 시퀀스에 대한 권한이 자동으로 안 붙어서 insert 시 "permission denied for
-- sequence" 에러가 납니다. 시퀀스 권한을 명시적으로 줘야 합니다.
grant usage, select on sequence page_views_id_seq to service_role;

-- =====================================================================
-- 1.5단계: 수업기록 빠른등록 + 아이별 코멘트 + 코멘트 템플릿
-- ---------------------------------------------------------------------
-- 사진(activity_photos)은 사진 1장당 공용 설명 하나뿐이라, 같은 사진에
-- 여러 아이가 태그되면 모든 아이 부모에게 같은 문구가 보이는 한계가 있었습니다.
-- class_records(수업기록 1건) + child_comments(아이별 코멘트 오버라이드)로
-- "사진은 다같이, 코멘트는 아이마다 다르게"와 "사진 없이 코멘트만" 둘 다 지원합니다.
-- class_records/child_comments는 관리자 실수 삭제 대비로 소프트삭제(deleted_at)를 씁니다.
-- =====================================================================

create table if not exists class_records (
  id text primary key,
  class_date date not null,
  activity_name text not null,
  activity_type text not null check (activity_type in ('class', 'craft', 'cooking', 'neurofeedback', 'event', 'other')),
  comment text,
  counselor text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
create index if not exists class_records_date_idx on class_records(class_date desc);

create table if not exists class_record_children (
  class_record_id text not null references class_records(id) on delete cascade,
  child_id text not null references children(id) on delete cascade,
  primary key (class_record_id, child_id)
);
create index if not exists class_record_children_child_idx on class_record_children(child_id);

create table if not exists child_comments (
  id text primary key,
  class_record_id text not null references class_records(id) on delete cascade,
  child_id text not null references children(id) on delete cascade,
  -- 비어있으면 화면에서 class_records.comment(전체 공용 코멘트)를 그대로 보여줍니다.
  comment text,
  is_public_to_parent boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (class_record_id, child_id)
);
create index if not exists child_comments_child_idx on child_comments(child_id);

-- 이 수업기록에서 함께 올린 사진을 admin 화면에서 묶어보기 위한 연결(선택값).
-- 기존 사진(값 없음)은 전혀 영향 없음.
alter table activity_photos add column if not exists class_record_id text references class_records(id) on delete set null;

create table if not exists comment_templates (
  id text primary key,
  text text not null,
  created_at timestamptz not null default now()
);

alter table class_records enable row level security;
alter table class_record_children enable row level security;
alter table child_comments enable row level security;
alter table comment_templates enable row level security;
grant select, insert, update, delete on class_records, class_record_children, child_comments, comment_templates to service_role;

-- =====================================================================
-- 2단계: 월간 성장 리포트
-- ---------------------------------------------------------------------
-- 아이 한 명당 한 달에 한 건(unique child_id+month). 학부모 성장기록
-- 타임라인에 공개된 것만 노출됩니다. class_records/child_comments와
-- 동일하게 관리자 실수 삭제 대비 소프트삭제(deleted_at)를 씁니다.
-- =====================================================================

create table if not exists monthly_reports (
  id text primary key,
  child_id text not null references children(id) on delete cascade,
  month text not null, -- 'YYYY-MM'
  participation text,
  strengths text,
  improvements text,
  home_guidance text,
  next_month_goals text,
  counselor text,
  is_public_to_parent boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (child_id, month)
);
create index if not exists monthly_reports_child_idx on monthly_reports(child_id);

alter table monthly_reports enable row level security;
grant select, insert, update, delete on monthly_reports to service_role;

-- =====================================================================
-- 2.5단계: 공지 대상분리 + 읽음여부
-- ---------------------------------------------------------------------
-- notices(공개 홈페이지 공지, 로그인 불필요)와 완전히 별개입니다.
-- parent_notices는 학부모 로그인(토큰+비밀번호) 후에만 보이고, 특정
-- 대상에게만 노출되도록 audience_type/value로 필터링됩니다.
-- =====================================================================

create table if not exists parent_notices (
  id text primary key,
  title text not null,
  body text not null,
  -- 'all' | 'status' | 'program' | 'weekday' | 'child'
  audience_type text not null check (audience_type in ('all', 'status', 'program', 'weekday', 'child')),
  -- 타입별 해석: status→active/waiting/ended, program→children.service_type 값,
  -- weekday→'0'~'6'(Date.getDay() 규칙), child→아이 id. all이면 null.
  audience_value text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
create index if not exists parent_notices_created_idx on parent_notices(created_at desc);

create table if not exists parent_notice_reads (
  notice_id text not null references parent_notices(id) on delete cascade,
  child_id text not null references children(id) on delete cascade,
  read_at timestamptz not null default now(),
  primary key (notice_id, child_id)
);

alter table parent_notices enable row level security;
alter table parent_notice_reads enable row level security;
grant select, insert, update, delete on parent_notices, parent_notice_reads to service_role;

-- =====================================================================
-- 4단계: 상담 신청 사전설문 + 관리자 처리 파이프라인
-- ---------------------------------------------------------------------
-- 공개 홈페이지에서 로그인 없이 제출되는 신규 상담 신청입니다. 재원 중인
-- 학부모 전용 문의(parent_feedback)와는 목적이 다른 별개 테이블입니다.
-- 이 앱에서 처음으로 완전 공개된 쓰기 API라 ip를 함께 저장해 레이트리밋에
-- 씁니다(access_logs의 실패 카운트 레이트리밋과 같은 원리).
-- =====================================================================

create table if not exists consultations (
  id text primary key,
  guardian_name text not null,
  guardian_phone text not null,
  child_name text not null,
  child_age_grade text,
  concern text,
  is_existing_member boolean not null default false,
  desired_program text,
  desired_datetime text,
  referral_source text,
  additional_message text,
  consent_at timestamptz not null default now(),
  ip text,
  status text not null default 'new' check (status in (
    'new', 'contact_scheduled', 'consult_scheduled', 'consult_done', 'enrolled', 'on_hold', 'closed'
  )),
  admin_memo text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists consultations_created_idx on consultations(created_at desc);
create index if not exists consultations_status_idx on consultations(status);

alter table consultations enable row level security;
grant select, insert, update, delete on consultations to service_role;

-- =====================================================================
-- 6단계: 뇌파검사·훈련기록·역할체계(RBAC)·AI 연동 — 스키마 기반 작업
-- ---------------------------------------------------------------------
-- 이 블록은 화면/API 없이 스키마와 타입만 먼저 준비하는 단계입니다.
-- 기존 brain_tests/class_records/child_comments를 대체하지 않고
-- 컬럼만 추가(add column if not exists)하므로 기존 데이터는 전혀
-- 영향받지 않습니다. staff 로그인은 7단계에서 기존 관리자 로그인과
-- "병행"으로 붙일 예정 — 지금은 테이블만 존재하고 아무도 로그인하지 않음.
-- =====================================================================

-- ---- brain_tests 확장: 검사종류/측정기관/AI해석/승인/공개용요약 ----
alter table brain_tests add column if not exists test_type text;
alter table brain_tests add column if not exists test_name text;
alter table brain_tests add column if not exists measuring_org text;
alter table brain_tests add column if not exists measured_by text;
-- 원본에서 추출한 구조화 데이터(선생님 확인 전). 확인된 핵심 수치는 기존 indicators에 반영.
alter table brain_tests add column if not exists raw_extracted jsonb;
alter table brain_tests add column if not exists extraction_confidence text;
alter table brain_tests add column if not exists teacher_confirmed_at timestamptz;
alter table brain_tests add column if not exists ai_interpretation jsonb;
alter table brain_tests add column if not exists final_interpretation text;
alter table brain_tests add column if not exists parent_summary text;
alter table brain_tests add column if not exists approved_by text;
alter table brain_tests add column if not exists approved_at timestamptz;
-- 동일 파일 중복 업로드 감지용
alter table brain_tests add column if not exists source_file_hash text;
alter table brain_tests add column if not exists status text not null default 'draft' check (status in (
  'draft', 'uploaded', 'extracting', 'needs_review', 'confirmed', 'ai_processing',
  'ai_drafted', 'teacher_reviewed', 'pending_approval', 'approved', 'published', 'failed'
));
create index if not exists brain_tests_status_idx on brain_tests(status);
create index if not exists brain_tests_source_hash_idx on brain_tests(source_file_hash);

-- ---- class_records 확장: 수업목표/참여도 ----
alter table class_records add column if not exists lesson_goal text;
alter table class_records add column if not exists participation text;

-- ---- child_comments 확장: 잘한점/어려운점/관찰메모/AI 3분할 초안 ----
alter table child_comments add column if not exists strengths_note text;
alter table child_comments add column if not exists difficulties_note text;
alter table child_comments add column if not exists teacher_memo text;
-- AI 3분할 초안: 내부용 상세기록 / 학부모용 코멘트 / 다음 수업 지도방향
alter table child_comments add column if not exists ai_draft_detail text;
alter table child_comments add column if not exists ai_draft_parent text;
alter table child_comments add column if not exists ai_draft_guidance text;
alter table child_comments add column if not exists ai_generated_at timestamptz;
alter table child_comments add column if not exists ai_model text;
alter table child_comments add column if not exists final_source text check (final_source is null or final_source in ('manual', 'ai_edited'));

-- ---- staff: 선생님/관리자 계정 (기존 단일 관리자 로그인과 "병행", 대체 아님) ----
create table if not exists staff (
  id text primary key,
  name text not null,
  phone text,
  password_hash text not null,
  role text not null check (role in ('admin', 'teacher')),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
create index if not exists staff_role_idx on staff(role);

-- ---- child_staff_assignments: 담당 아동 배정 ----
create table if not exists child_staff_assignments (
  child_id text not null references children(id) on delete cascade,
  staff_id text not null references staff(id) on delete cascade,
  assigned_at timestamptz not null default now(),
  primary key (child_id, staff_id)
);
create index if not exists child_staff_assignments_staff_idx on child_staff_assignments(staff_id);

-- ---- child_traits: 아동 특성 (AI 참고용) ----
-- ai_include_fields: 이 중 실제로 AI에 전송할 항목만 관리자가 선택(화이트리스트).
-- 기본값 빈 배열 = "AI에 아무것도 안 보냄"이 가장 안전한 기본값.
create table if not exists child_traits (
  child_id text primary key references children(id) on delete cascade,
  temperament text,
  strengths text,
  weaknesses text,
  cautions text,
  learning_style text,
  emotional_behavior text,
  counseling_goal text,
  teacher_memo text,
  ai_guidance_note text,
  ai_include_fields text[] not null default '{}',
  updated_at timestamptz not null default now(),
  updated_by text
);

-- ---- eeg_training_sessions: 뇌파훈련 기록(검사와 별도, 매회 훈련) ----
-- 숫자 없는 항목은 0으로 채우지 않고 null 유지(화면에서 "값 없음"으로 표시).
create table if not exists eeg_training_sessions (
  id text primary key,
  child_id text not null references children(id) on delete cascade,
  session_date date not null,
  duration_minutes integer,
  training_mode text,
  training_stage text,
  equipment text,
  key_metrics jsonb,
  condition_note text,
  engagement_note text,
  observation text,
  special_note text,
  staff_id text references staff(id) on delete set null,
  parent_comment text,
  is_public_to_parent boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
create index if not exists eeg_training_sessions_child_date_idx on eeg_training_sessions(child_id, session_date desc);

-- ---- ai_generation_logs: AI 호출 이력(비용·모델·성공여부, 개인정보는 해시만) ----
create table if not exists ai_generation_logs (
  id text primary key,
  feature text not null check (feature in ('class_record', 'eeg_interpretation')),
  target_id text not null,
  staff_id text references staff(id) on delete set null,
  model text,
  prompt_version text,
  input_summary_hash text,
  status text not null check (status in ('pending', 'success', 'failed')),
  error_message text,
  tokens_used integer,
  created_at timestamptz not null default now()
);
create index if not exists ai_generation_logs_target_idx on ai_generation_logs(target_id);

-- ---- audit_logs: 관리자/선생님 작업 이력 ----
create table if not exists audit_logs (
  id text primary key,
  actor_staff_id text references staff(id) on delete set null,
  action text not null,
  target_table text not null,
  target_id text,
  before jsonb,
  after jsonb,
  created_at timestamptz not null default now()
);
create index if not exists audit_logs_target_idx on audit_logs(target_table, target_id);
create index if not exists audit_logs_created_idx on audit_logs(created_at desc);

-- ---- eeg_test_templates: 검사종류별 항목매핑/기준범위/AI지침(관리자 확장 가능) ----
-- direction이 'none'이면 기준이 없다는 뜻 — 화면에서 증감만 표시하고 좋다/나쁘다 판정 금지.
create table if not exists eeg_test_templates (
  id text primary key,
  test_type text not null,
  indicator_key text not null,
  indicator_label text not null,
  direction text not null default 'none' check (direction in ('higher_better', 'lower_better', 'none')),
  normal_range_min numeric,
  normal_range_max numeric,
  ai_instruction text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (test_type, indicator_key)
);
create index if not exists eeg_test_templates_type_idx on eeg_test_templates(test_type);

alter table staff enable row level security;
alter table child_staff_assignments enable row level security;
alter table child_traits enable row level security;
alter table eeg_training_sessions enable row level security;
alter table ai_generation_logs enable row level security;
alter table audit_logs enable row level security;
alter table eeg_test_templates enable row level security;
grant select, insert, update, delete on
  staff, child_staff_assignments, child_traits, eeg_training_sessions,
  ai_generation_logs, audit_logs, eeg_test_templates
to service_role;

-- =====================================================================
-- 7단계: RBAC(선생님 계정) — staff.phone을 로그인 식별자로 사용
-- =====================================================================
create unique index if not exists staff_phone_idx on staff(phone) where phone is not null;

-- =====================================================================
-- 12단계: 이미지/스캔PDF 인식(Claude Vision) — ai_generation_logs에 새 feature 값 추가
-- =====================================================================
alter table ai_generation_logs drop constraint if exists ai_generation_logs_feature_check;
alter table ai_generation_logs add constraint ai_generation_logs_feature_check
  check (feature in ('class_record', 'eeg_interpretation', 'vision_extraction'));

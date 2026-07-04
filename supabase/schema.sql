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

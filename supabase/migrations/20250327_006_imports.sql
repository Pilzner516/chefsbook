-- ============================================================
-- IMPORT JOBS — batch import tracking
-- ============================================================
create table import_jobs (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid references auth.users(id) on delete cascade,
  status          text check (status in (
                    'pending','processing','complete','failed'
                  )) default 'pending',
  source_type     text check (source_type in (
                    'bookmarks_html','url_list','single_url'
                  )) not null,
  total_urls      integer default 0,
  processed_urls  integer default 0,
  failed_urls     integer default 0,
  created_at      timestamptz default now(),
  completed_at    timestamptz
);

create index import_jobs_user on import_jobs (user_id, created_at desc);

-- ============================================================
-- IMPORT JOB URLS — individual URLs within a batch
-- ============================================================
create table import_job_urls (
  id              uuid primary key default gen_random_uuid(),
  job_id          uuid references import_jobs(id) on delete cascade,
  user_id         uuid references auth.users(id) on delete cascade,
  url             text not null,
  folder_name     text,
  status          text check (status in (
                    'queued','processing','success','failed','duplicate','not_recipe'
                  )) default 'queued',
  recipe_id       uuid references recipes(id) on delete set null,
  error_message   text,
  created_at      timestamptz default now()
);

create index import_job_urls_job    on import_job_urls (job_id, status);
create index import_job_urls_user   on import_job_urls (user_id);

-- ============================================================
-- Add bookmark columns to recipes
-- ============================================================
alter table recipes add column bookmark_folder text;
alter table recipes add column import_job_id uuid references import_jobs(id);

-- ============================================================
-- RLS
-- ============================================================
alter table import_jobs     enable row level security;
alter table import_job_urls enable row level security;

create policy "own" on import_jobs     for all using (auth.uid() = user_id);
create policy "own" on import_job_urls for all using (auth.uid() = user_id);

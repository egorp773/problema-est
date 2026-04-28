create extension if not exists "pgcrypto";

create table if not exists problems (
  id uuid primary key default gen_random_uuid(),
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  city text not null,
  address text not null,
  category text not null,
  raw_description text not null,
  title text not null,
  clean_description text not null,
  desired_result text not null,
  photo_url text,
  photo_urls jsonb not null default '[]'::jsonb,
  status text not null default 'pending',
  risk_flags jsonb not null default '[]'::jsonb,
  moderation_reason text,
  confirmations_count integer not null default 0,
  created_by_telegram_id text
);

create table if not exists confirmations (
  id uuid primary key default gen_random_uuid(),
  created_at timestamp with time zone not null default now(),
  problem_id uuid not null references problems(id) on delete cascade,
  telegram_user_id text,
  anonymous_key text
);

create table if not exists admin_actions (
  id uuid primary key default gen_random_uuid(),
  created_at timestamp with time zone not null default now(),
  problem_id uuid references problems(id) on delete set null,
  action text not null,
  details jsonb not null default '{}'::jsonb
);

create index if not exists problems_city_idx on problems(city);
create index if not exists problems_category_idx on problems(category);
create index if not exists problems_status_idx on problems(status);
create index if not exists problems_created_at_idx on problems(created_at desc);
create index if not exists confirmations_problem_id_idx on confirmations(problem_id);

create unique index if not exists confirmations_problem_telegram_uidx
  on confirmations(problem_id, telegram_user_id)
  where telegram_user_id is not null;

create unique index if not exists confirmations_problem_anonymous_uidx
  on confirmations(problem_id, anonymous_key)
  where anonymous_key is not null;

create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists problems_set_updated_at on problems;
create trigger problems_set_updated_at
before update on problems
for each row execute function set_updated_at();

create or replace function sync_confirmations_count()
returns trigger as $$
begin
  if tg_op = 'INSERT' then
    update problems
      set confirmations_count = confirmations_count + 1
      where id = new.problem_id;
    return new;
  elsif tg_op = 'DELETE' then
    update problems
      set confirmations_count = greatest(confirmations_count - 1, 0)
      where id = old.problem_id;
    return old;
  end if;
  return null;
end;
$$ language plpgsql;

drop trigger if exists confirmations_sync_count_insert on confirmations;
create trigger confirmations_sync_count_insert
after insert on confirmations
for each row execute function sync_confirmations_count();

drop trigger if exists confirmations_sync_count_delete on confirmations;
create trigger confirmations_sync_count_delete
after delete on confirmations
for each row execute function sync_confirmations_count();

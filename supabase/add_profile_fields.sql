alter table problems
  add column if not exists created_by_anonymous_key text;

create index if not exists problems_created_by_telegram_id_idx on problems(created_by_telegram_id);
create index if not exists problems_created_by_anonymous_key_idx on problems(created_by_anonymous_key);

create table if not exists subscriptions (
  id uuid primary key default gen_random_uuid(),
  created_at timestamp with time zone not null default now(),
  problem_id uuid not null references problems(id) on delete cascade,
  telegram_user_id text,
  anonymous_key text
);

create index if not exists subscriptions_problem_id_idx on subscriptions(problem_id);

create unique index if not exists subscriptions_problem_telegram_uidx
  on subscriptions(problem_id, telegram_user_id)
  where telegram_user_id is not null;

create unique index if not exists subscriptions_problem_anonymous_uidx
  on subscriptions(problem_id, anonymous_key)
  where anonymous_key is not null;

create table if not exists comments (
  id uuid primary key default gen_random_uuid(),
  created_at timestamp with time zone not null default now(),
  problem_id uuid not null references problems(id) on delete cascade,
  body text not null,
  display_name text not null default 'Пользователь',
  avatar_url text,
  telegram_user_id text,
  anonymous_key text
);

create index if not exists comments_problem_id_created_at_idx on comments(problem_id, created_at desc);

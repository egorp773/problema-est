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

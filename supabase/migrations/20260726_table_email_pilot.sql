begin;

create table if not exists public.app_table_email_profiles (
  telegram_id bigint primary key,
  email text not null check (char_length(email) between 5 and 254),
  first_name text,
  last_name text,
  username text,
  email_updated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.app_table_email_profiles is
  'Пилот: email пользователя Telegram для отправки учебных Google-таблиц.';

create table if not exists public.app_table_email_sends (
  id uuid primary key default gen_random_uuid(),
  telegram_id bigint not null,
  email text not null,
  material_title text not null,
  material_kind text not null default 'table'
    check (material_kind in ('table', 'example', 'instruction')),
  material_url text not null,
  status text not null default 'pending'
    check (status in ('pending', 'sent', 'failed')),
  provider_message_id text,
  error_message text,
  sent_at timestamptz,
  created_at timestamptz not null default now()
);

comment on table public.app_table_email_sends is
  'Пилот: журнал попыток отправки учебных таблиц через почтовый провайдер.';

create index if not exists app_table_email_sends_user_created_idx
  on public.app_table_email_sends (telegram_id, created_at desc);

create index if not exists app_table_email_sends_status_created_idx
  on public.app_table_email_sends (status, created_at desc);

alter table public.app_table_email_profiles enable row level security;
alter table public.app_table_email_sends enable row level security;

revoke all on table public.app_table_email_profiles from anon, authenticated;
revoke all on table public.app_table_email_sends from anon, authenticated;

commit;

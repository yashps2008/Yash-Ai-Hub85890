create extension if not exists pgcrypto;

create table ig_accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  ig_user_id text not null unique,
  username text,
  token_enc text not null,
  token_expires_at timestamptz,
  status text not null default 'connected' check (status in ('connected','expired','disconnected')),
  created_at timestamptz not null default now()
);

create table automations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  ig_account_id uuid not null references ig_accounts(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 100),
  keyword text not null check (char_length(keyword) between 1 and 200),
  match_type text not null default 'contains' check (match_type in ('contains','exact','starts_with')),
  case_sensitive boolean not null default false,
  message text not null check (char_length(message) between 1 and 1000),
  enabled boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on automations(ig_account_id, enabled);

create table webhook_events (
  id uuid primary key default gen_random_uuid(),
  event_key text not null unique,          -- idempotency: "comment:<comment_id>"
  ig_user_id text not null,
  payload jsonb not null,
  status text not null default 'pending' check (status in ('pending','processing','done','failed')),
  attempts int not null default 0,
  locked_at timestamptz,
  error text,
  created_at timestamptz not null default now()
);
create index on webhook_events(status, created_at);

create table executions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  automation_id uuid not null references automations(id) on delete cascade,
  event_id uuid references webhook_events(id) on delete set null,
  comment_id text not null,
  status text not null check (status in ('sending','sent','failed','unknown')),
  api_response jsonb,
  error text,
  created_at timestamptz not null default now(),
  unique (automation_id, comment_id)       -- never DM twice for the same comment
);

create table activity_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  type text not null,
  automation_id uuid references automations(id) on delete set null,
  status text not null default 'info',
  detail text,
  created_at timestamptz not null default now()
);
create index on activity_logs(user_id, created_at desc);

create table conversations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null default 'New chat',
  created_at timestamptz not null default now()
);
create table messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references conversations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('user','assistant')),
  content text not null,
  created_at timestamptz not null default now()
);
create index on messages(conversation_id, created_at);

-- RLS
alter table ig_accounts enable row level security;
alter table automations enable row level security;
alter table webhook_events enable row level security;  -- no policies: service role only
alter table executions enable row level security;
alter table activity_logs enable row level security;
alter table conversations enable row level security;
alter table messages enable row level security;

create policy own_ig on ig_accounts for select using (user_id = auth.uid());
create policy own_auto on automations for all using (user_id = auth.uid())
  with check (user_id = auth.uid() and exists (select 1 from ig_accounts a where a.id = ig_account_id and a.user_id = auth.uid()));
create policy own_exec on executions for select using (user_id = auth.uid());
create policy own_logs on activity_logs for select using (user_id = auth.uid());
create policy own_conv on conversations for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy own_msg on messages for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Browser clients must never read the encrypted token column
revoke select on ig_accounts from anon, authenticated;
grant select (id, user_id, ig_user_id, username, status, token_expires_at, created_at) on ig_accounts to authenticated;

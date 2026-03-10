create table if not exists public.admin_users (
  user_id uuid primary key,
  email text null,
  created_at timestamptz not null default now()
);

create table if not exists public.business_permissions (
  user_id uuid primary key,
  status text not null default 'pending',
  reason text null,
  reviewed_by uuid null,
  reviewed_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists business_permissions_status_idx on public.business_permissions(status, created_at desc);

create table if not exists public.deal_moderation_actions (
  id bigserial primary key,
  deal_id bigint not null references public.deals(id) on delete cascade,
  moderator_user_id uuid not null,
  action text not null,
  reason text null,
  created_at timestamptz not null default now()
);

create index if not exists deal_moderation_actions_deal_idx on public.deal_moderation_actions(deal_id, created_at desc);

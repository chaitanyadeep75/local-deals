-- Core deal growth fields
alter table public.deals
  add column if not exists quality_score int not null default 0,
  add column if not exists quality_flags text[] not null default '{}',
  add column if not exists verification_tier text not null default 'none',
  add column if not exists is_boosted boolean not null default false,
  add column if not exists boost_until timestamptz null;

create index if not exists deals_quality_score_idx on public.deals(quality_score desc);
create index if not exists deals_boost_until_idx on public.deals(boost_until desc);

-- Business claiming and verification
create table if not exists public.business_claims (
  id bigserial primary key,
  deal_id bigint not null references public.deals(id) on delete cascade,
  claimant_user_id uuid not null,
  business_name text null,
  phone text null,
  proof_url text null,
  note text null,
  status text not null default 'pending',
  reviewed_by uuid null,
  reviewed_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists business_claims_deal_idx on public.business_claims(deal_id);
create index if not exists business_claims_claimant_idx on public.business_claims(claimant_user_id);
create index if not exists business_claims_status_idx on public.business_claims(status);

-- Lightweight boosting and spend tracking
create table if not exists public.deal_boosts (
  id bigserial primary key,
  deal_id bigint not null references public.deals(id) on delete cascade,
  user_id uuid not null,
  days int not null default 3,
  amount numeric(10,2) not null default 0,
  status text not null default 'active',
  starts_at timestamptz not null default now(),
  ends_at timestamptz not null,
  created_at timestamptz not null default now()
);

create index if not exists deal_boosts_deal_idx on public.deal_boosts(deal_id);
create index if not exists deal_boosts_user_idx on public.deal_boosts(user_id);
create index if not exists deal_boosts_status_idx on public.deal_boosts(status);

-- Notification preferences and queue
create table if not exists public.notification_preferences (
  user_id uuid primary key,
  push_enabled boolean not null default true,
  whatsapp_enabled boolean not null default false,
  ending_soon_enabled boolean not null default true,
  price_drop_enabled boolean not null default true,
  new_nearby_enabled boolean not null default true,
  quiet_hours_start smallint null,
  quiet_hours_end smallint null,
  updated_at timestamptz not null default now()
);

create table if not exists public.notification_queue (
  id bigserial primary key,
  user_id uuid not null,
  deal_id bigint null references public.deals(id) on delete set null,
  channel text not null default 'push',
  type text not null,
  title text not null,
  body text not null,
  payload jsonb not null default '{}'::jsonb,
  status text not null default 'pending',
  scheduled_for timestamptz not null default now(),
  sent_at timestamptz null,
  created_at timestamptz not null default now()
);

create index if not exists notification_queue_user_idx on public.notification_queue(user_id, status);
create index if not exists notification_queue_scheduled_idx on public.notification_queue(scheduled_for);

-- Trust and moderation
create table if not exists public.abuse_reports (
  id bigserial primary key,
  reporter_user_id uuid not null,
  deal_id bigint null references public.deals(id) on delete set null,
  review_id bigint null references public.reviews(id) on delete set null,
  reason text not null,
  note text null,
  status text not null default 'open',
  created_at timestamptz not null default now()
);

create index if not exists abuse_reports_deal_idx on public.abuse_reports(deal_id);
create index if not exists abuse_reports_review_idx on public.abuse_reports(review_id);
create index if not exists abuse_reports_status_idx on public.abuse_reports(status);

-- Personalization and recommendation signals
create table if not exists public.user_behavior_signals (
  id bigserial primary key,
  user_id uuid not null,
  signal_type text not null,
  deal_id bigint null references public.deals(id) on delete cascade,
  category text null,
  city text null,
  area text null,
  score numeric(10,3) not null default 1,
  created_at timestamptz not null default now()
);

create index if not exists behavior_signals_user_idx on public.user_behavior_signals(user_id, created_at desc);
create index if not exists behavior_signals_category_idx on public.user_behavior_signals(category);

-- Referral and invite loop
create table if not exists public.user_referrals (
  id bigserial primary key,
  inviter_user_id uuid not null,
  invitee_user_id uuid null,
  referral_code text not null,
  source text not null default 'share',
  reward_points int not null default 0,
  status text not null default 'pending',
  created_at timestamptz not null default now(),
  converted_at timestamptz null
);

create unique index if not exists user_referrals_code_unique on public.user_referrals(referral_code, inviter_user_id);
create index if not exists user_referrals_inviter_idx on public.user_referrals(inviter_user_id, created_at desc);

-- Analytics event tables (required by tracking + owner analytics)
create table if not exists public.analytics_events (
  id bigserial primary key,
  event_name text not null,
  event_payload jsonb not null default '{}'::jsonb,
  page_path text null,
  created_at timestamptz not null default now()
);

create index if not exists analytics_events_name_idx on public.analytics_events(event_name);
create index if not exists analytics_events_created_at_idx on public.analytics_events(created_at desc);

create table if not exists public.event_logs (
  id bigserial primary key,
  event_name text not null,
  payload jsonb not null default '{}'::jsonb,
  page_path text null,
  created_at timestamptz not null default now()
);

create index if not exists event_logs_name_idx on public.event_logs(event_name);
create index if not exists event_logs_created_at_idx on public.event_logs(created_at desc);

-- Helpful RPC-safe view for business analytics panels
create or replace view public.business_funnel_30d as
select
  d.user_id as owner_user_id,
  e.event_name,
  coalesce((e.event_payload ->> 'deal_id')::bigint, 0) as deal_id,
  count(*)::bigint as total_events
from public.analytics_events e
join public.deals d on d.id = coalesce((e.event_payload ->> 'deal_id')::bigint, -1)
where e.created_at >= now() - interval '30 day'
group by d.user_id, e.event_name, coalesce((e.event_payload ->> 'deal_id')::bigint, 0);

-- Web Push subscriptions
create table if not exists public.push_subscriptions (
  id bigserial primary key,
  user_id uuid not null,
  endpoint text not null,
  p256dh text not null,
  auth text not null,
  user_agent text null,
  created_at timestamptz not null default now()
);

create unique index if not exists push_subscriptions_endpoint_unique on public.push_subscriptions(endpoint);
create index if not exists push_subscriptions_user_idx on public.push_subscriptions(user_id);

alter table public.push_subscriptions enable row level security;

drop policy if exists "push_subscriptions_own_rows" on public.push_subscriptions;
create policy "push_subscriptions_own_rows" on public.push_subscriptions
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Track the last price we already notified savers about, so the cron scan
-- only fires once per genuine drop instead of every run.
alter table public.deals
  add column if not exists last_notified_price numeric null;

-- Prevent duplicate pending notifications for the same user/deal/type
-- (a new one can still be enqueued later once the prior one is sent).
create unique index if not exists notification_queue_dedup_idx
  on public.notification_queue(user_id, deal_id, type)
  where status = 'pending';

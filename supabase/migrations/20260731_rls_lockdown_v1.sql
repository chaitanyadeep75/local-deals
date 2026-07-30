-- Closes a privilege-escalation hole: these tables were created without RLS,
-- and the anon key is public (shipped in every client bundle), so anyone
-- could currently INSERT their own user_id into admin_users and grant
-- themselves admin access, or self-approve business_permissions, etc.

create or replace function public.is_admin()
returns boolean
language sql
security definer
stable
as $$
  select exists (select 1 from public.admin_users au where au.user_id = auth.uid());
$$;

-- admin_users: only readable by the row's own user (so the client-side
-- isAdmin check still works); no insert/update/delete for anon/authenticated
-- at all — promoting someone to admin must go through the SQL editor or
-- service-role key, never the client.
alter table public.admin_users enable row level security;
drop policy if exists "admin_users_self_select" on public.admin_users;
create policy "admin_users_self_select" on public.admin_users
  for select using (auth.uid() = user_id);

-- admin_config: any signed-in user can read (business dashboard shows boost
-- pricing); only admins can change it.
alter table public.admin_config enable row level security;
drop policy if exists "admin_config_read" on public.admin_config;
create policy "admin_config_read" on public.admin_config
  for select using (auth.role() = 'authenticated');
drop policy if exists "admin_config_admin_write" on public.admin_config;
create policy "admin_config_admin_write" on public.admin_config
  for all using (public.is_admin()) with check (public.is_admin());

-- business_permissions: a user can create/see their own request; admins can
-- see and update any (approve/reject).
alter table public.business_permissions enable row level security;
drop policy if exists "business_permissions_own" on public.business_permissions;
create policy "business_permissions_own" on public.business_permissions
  for select using (auth.uid() = user_id);
drop policy if exists "business_permissions_own_insert" on public.business_permissions;
create policy "business_permissions_own_insert" on public.business_permissions
  for insert with check (auth.uid() = user_id);
drop policy if exists "business_permissions_admin_all" on public.business_permissions;
create policy "business_permissions_admin_all" on public.business_permissions
  for all using (public.is_admin()) with check (public.is_admin());

-- deal_moderation_actions: admin-only, both ways.
alter table public.deal_moderation_actions enable row level security;
drop policy if exists "deal_moderation_admin_all" on public.deal_moderation_actions;
create policy "deal_moderation_admin_all" on public.deal_moderation_actions
  for all using (public.is_admin()) with check (public.is_admin());

-- business_claims: a user can file/see their own claim; admins can see and
-- update any (approve/reject).
alter table public.business_claims enable row level security;
drop policy if exists "business_claims_own_select" on public.business_claims;
create policy "business_claims_own_select" on public.business_claims
  for select using (auth.uid() = claimant_user_id);
drop policy if exists "business_claims_own_insert" on public.business_claims;
create policy "business_claims_own_insert" on public.business_claims
  for insert with check (auth.uid() = claimant_user_id);
drop policy if exists "business_claims_admin_all" on public.business_claims;
create policy "business_claims_admin_all" on public.business_claims
  for all using (public.is_admin()) with check (public.is_admin());

-- deal_boosts: a user can buy/see their own boosts; admins can see all.
alter table public.deal_boosts enable row level security;
drop policy if exists "deal_boosts_own_select" on public.deal_boosts;
create policy "deal_boosts_own_select" on public.deal_boosts
  for select using (auth.uid() = user_id);
drop policy if exists "deal_boosts_own_insert" on public.deal_boosts;
create policy "deal_boosts_own_insert" on public.deal_boosts
  for insert with check (auth.uid() = user_id);
drop policy if exists "deal_boosts_admin_all" on public.deal_boosts;
create policy "deal_boosts_admin_all" on public.deal_boosts
  for all using (public.is_admin()) with check (public.is_admin());

-- notification_preferences: a user manages only their own row.
alter table public.notification_preferences enable row level security;
drop policy if exists "notification_prefs_own" on public.notification_preferences;
create policy "notification_prefs_own" on public.notification_preferences
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- notification_queue: no client access at all, either direction — only the
-- service-role key (used by the /api/cron/notifications route) can touch it.
alter table public.notification_queue enable row level security;

-- abuse_reports: a user can file/see their own report; admins see/manage all.
alter table public.abuse_reports enable row level security;
drop policy if exists "abuse_reports_own_select" on public.abuse_reports;
create policy "abuse_reports_own_select" on public.abuse_reports
  for select using (auth.uid() = reporter_user_id);
drop policy if exists "abuse_reports_own_insert" on public.abuse_reports;
create policy "abuse_reports_own_insert" on public.abuse_reports
  for insert with check (auth.uid() = reporter_user_id);
drop policy if exists "abuse_reports_admin_all" on public.abuse_reports;
create policy "abuse_reports_admin_all" on public.abuse_reports
  for all using (public.is_admin()) with check (public.is_admin());

-- user_behavior_signals: a user can write/read only their own signals.
alter table public.user_behavior_signals enable row level security;
drop policy if exists "behavior_signals_own" on public.user_behavior_signals;
create policy "behavior_signals_own" on public.user_behavior_signals
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- user_referrals: an inviter manages their own codes/rows. A brand-new
-- signup is allowed to claim ("convert") an unclaimed pending row by setting
-- themselves as the invitee — that's the one deliberate cross-user write,
-- matching how referral attribution actually works.
alter table public.user_referrals enable row level security;
drop policy if exists "user_referrals_inviter_select" on public.user_referrals;
create policy "user_referrals_inviter_select" on public.user_referrals
  for select using (auth.uid() = inviter_user_id);
-- A brand-new signup needs to look up a pending code by value to attribute
-- itself as the invitee (it isn't the inviter, so the policy above won't
-- match) — safe to expose since codes are meant to be shared, and only
-- still-unclaimed rows are visible this way.
drop policy if exists "user_referrals_pending_lookup" on public.user_referrals;
create policy "user_referrals_pending_lookup" on public.user_referrals
  for select using (invitee_user_id is null and status = 'pending');
drop policy if exists "user_referrals_inviter_insert" on public.user_referrals;
create policy "user_referrals_inviter_insert" on public.user_referrals
  for insert with check (auth.uid() = inviter_user_id);
drop policy if exists "user_referrals_invitee_convert" on public.user_referrals;
create policy "user_referrals_invitee_convert" on public.user_referrals
  for update
  using (invitee_user_id is null and status = 'pending')
  with check (auth.uid() = invitee_user_id);

-- analytics_events / event_logs: anyone can write tracking events (no
-- user_id column to scope by); nobody can read them back via the client.
alter table public.analytics_events enable row level security;
drop policy if exists "analytics_events_insert" on public.analytics_events;
create policy "analytics_events_insert" on public.analytics_events
  for insert with check (true);

alter table public.event_logs enable row level security;
drop policy if exists "event_logs_insert" on public.event_logs;
create policy "event_logs_insert" on public.event_logs
  for insert with check (true);

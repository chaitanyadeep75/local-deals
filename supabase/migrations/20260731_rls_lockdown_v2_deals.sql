-- Closes the core-data privilege gap: `deals` and `saved_deals` had no RLS,
-- so any signed-in (or, for deals, even anonymous) client could edit or
-- delete any business's listing, or read/delete another user's saved deals.

-- saved_deals: a user can only see/create/remove their own bookmarks.
alter table public.saved_deals enable row level security;
drop policy if exists "saved_deals_own" on public.saved_deals;
create policy "saved_deals_own" on public.saved_deals
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- deals: readable by everyone (logged-out browsing/map/deal pages all
-- depend on this). Insert/delete restricted to the owner or an admin.
alter table public.deals enable row level security;

drop policy if exists "deals_public_read" on public.deals;
create policy "deals_public_read" on public.deals
  for select using (true);

drop policy if exists "deals_owner_insert" on public.deals;
create policy "deals_owner_insert" on public.deals
  for insert with check (auth.uid() = user_id or public.is_admin());

drop policy if exists "deals_owner_or_admin_delete" on public.deals;
create policy "deals_owner_or_admin_delete" on public.deals
  for delete using (auth.uid() = user_id or public.is_admin());

-- Updates stay open at the RLS layer (anonymous visitors legitimately bump
-- views/clicks, any signed-in reviewer legitimately updates the rating
-- aggregate) — the trigger below is the actual enforcement, restricting
-- non-owner/non-admin callers to those four counter columns only.
drop policy if exists "deals_update_gated_by_trigger" on public.deals;
create policy "deals_update_gated_by_trigger" on public.deals
  for update using (true) with check (true);

create or replace function public.deals_enforce_write_scope()
returns trigger
language plpgsql
as $$
declare
  new_views public.deals.views%type := NEW.views;
  new_clicks public.deals.clicks%type := NEW.clicks;
  new_rating public.deals.rating%type := NEW.rating;
  new_rating_count public.deals.rating_count%type := NEW.rating_count;
begin
  -- Owner and admins may change anything on the row.
  if auth.uid() = OLD.user_id or public.is_admin() then
    return NEW;
  end if;

  -- Everyone else (including anonymous visitors) may only move these four
  -- counters — silently discard any other column change they attempted.
  NEW := OLD;
  NEW.views := new_views;
  NEW.clicks := new_clicks;
  NEW.rating := new_rating;
  NEW.rating_count := new_rating_count;
  return NEW;
end;
$$;

drop trigger if exists deals_enforce_write_scope on public.deals;
create trigger deals_enforce_write_scope
before update on public.deals
for each row execute function public.deals_enforce_write_scope();

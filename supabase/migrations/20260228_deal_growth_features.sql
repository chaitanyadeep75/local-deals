alter table public.deals
  add column if not exists offer_price text,
  add column if not exists original_price text,
  add column if not exists discount_label text,
  add column if not exists coupon_code text,
  add column if not exists terms text,
  add column if not exists redemption_mode text,
  add column if not exists contact_phone text,
  add column if not exists contact_whatsapp text,
  add column if not exists status text not null default 'active',
  add column if not exists is_verified boolean not null default false,
  add column if not exists updated_at timestamptz not null default now();

create index if not exists deals_status_idx on public.deals(status);
create index if not exists deals_updated_at_idx on public.deals(updated_at desc);

do $$
begin
  if exists (
    select 1 from pg_proc where proname = 'set_updated_at'
  ) then
    execute 'drop trigger if exists deals_set_updated_at on public.deals';
    execute 'create trigger deals_set_updated_at
      before update on public.deals
      for each row execute function public.set_updated_at()';
  end if;
end$$;

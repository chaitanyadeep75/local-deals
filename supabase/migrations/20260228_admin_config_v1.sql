create table if not exists public.admin_config (
  key text primary key,
  value jsonb not null default '{}'::jsonb,
  updated_by uuid null,
  updated_at timestamptz not null default now()
);

insert into public.admin_config (key, value)
values (
  'boost_plans',
  '[{"days":3,"price":149,"label":"Boost 3 days"},{"days":7,"price":299,"label":"Boost 7 days"}]'::jsonb
)
on conflict (key) do nothing;

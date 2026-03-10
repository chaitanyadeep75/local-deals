-- Extra fields for deals: max redemptions, min purchase, valid hours, tags, age restriction
alter table deals
  add column if not exists max_redemptions integer,
  add column if not exists min_purchase     text,
  add column if not exists valid_hours      text,
  add column if not exists deal_tags        text[],
  add column if not exists age_restricted   boolean default false;

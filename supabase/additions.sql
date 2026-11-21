-- Malaragam: database additions needed by the new website.
-- READ FIRST: I could not see your existing tables, so the column names below are ASSUMPTIONS:
--   bookings(id, check_in date, check_out date, status text, hold_expires_at timestamptz)
-- If yours differ (for example check_in_date), change them here before running.
-- Run in the Supabase SQL editor. Everything is safe to re-run.

-- 1. Dates the calendar should treat as taken. Public, but returns dates only (no guest data).
create or replace function public.get_unavailable_dates()
returns table (check_in date, check_out date)
language sql security definer set search_path = public as $$
  select b.check_in, b.check_out
  from bookings b
  where b.check_out >= current_date
    and ( b.status = 'confirmed'
          or (b.status = 'pending_payment' and b.hold_expires_at > now()) );
$$;
revoke all on function public.get_unavailable_dates() from public;
grant execute on function public.get_unavailable_dates() to anon, authenticated;

-- 2. Release unpaid holds. Schedule it every minute (Database > Extensions > pg_cron), then:
--    select cron.schedule('expire-unpaid-bookings','* * * * *','select public.expire_unpaid_bookings()');
create or replace function public.expire_unpaid_bookings()
returns integer language plpgsql security definer set search_path = public as $$
declare n integer;
begin
  update bookings set status = 'expired'
  where status = 'pending_payment' and hold_expires_at <= now();
  get diagnostics n = row_count;
  return n;
end $$;
revoke all on function public.expire_unpaid_bookings() from public, anon, authenticated;

-- 3. Last line of defence against double bookings (optional; run expire_unpaid_bookings()
--    at the start of create-booking so stale holds do not block real guests):
-- create extension if not exists btree_gist;
-- alter table bookings add constraint no_overlapping_bookings
--   exclude using gist (daterange(check_in, check_out) with &&)
--   where (status in ('confirmed','pending_payment'));

-- 4. Reviews: guests can only submit pending reviews; only approved ones are public.
create table if not exists public.reviews (
  id uuid primary key default gen_random_uuid(),
  guest_name text not null check (char_length(guest_name) between 1 and 60),
  rating int not null check (rating between 1 and 5),
  body text not null check (char_length(body) between 1 and 1200),
  stay_month text check (char_length(stay_month) <= 30),
  booking_reference text,
  verified boolean not null default false,       -- you set this after checking the booking reference
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  created_at timestamptz not null default now()
);
alter table public.reviews enable row level security;

drop policy if exists "public reads approved reviews" on public.reviews;
create policy "public reads approved reviews" on public.reviews
  for select to anon, authenticated using (status = 'approved');

drop policy if exists "guests submit pending reviews" on public.reviews;
create policy "guests submit pending reviews" on public.reviews
  for insert to anon, authenticated with check (status = 'pending' and verified = false);

-- Moderate in the Table Editor: set status to 'approved' (and verified to true if the
-- booking reference matches a confirmed booking). The dashboard bypasses these policies.

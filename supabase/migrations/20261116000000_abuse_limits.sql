-- Tracker: limits against abuse of the open parts of the API.
--
--  * Transfers: anyone can store a transfer without an account, so one sender could fill the inbox
--    and block everybody. Each client address may store 20 transfers per hour.
--  * Plan reports: three reports hide a plan. Only reporters whose account is over a day old count,
--    so three new accounts cannot hide someone else's plan.
--  * Plan library: a total ceiling of 200 MB, under the 500 MB free-tier database limit.
--  * Plan publishing: the per-person limits are checked under a lock, so two inserts at once
--    cannot both slip past them.
--  * Trigger functions are not callable through the API.

-- ---------------------------------------------------------------------------------------
-- Transfers: a limit per client address
-- ---------------------------------------------------------------------------------------
create table transfer_puts (
  client     text not null,
  created_at timestamptz not null default now()
);
create index transfer_puts_recent on transfer_puts (client, created_at);

alter table transfer_puts enable row level security;   -- no policies: only put_transfer writes it
revoke all on transfer_puts from anon, authenticated;

-- The address comes from the proxy's x-forwarded-for header. Without it, every request without an
-- address shares one limit ('unknown').
create or replace function put_transfer(p_id text, p_payload text, p_ttl_minutes int default 60)
returns timestamptz
language plpgsql security definer set search_path = public as $$
declare
  max_rows constant int := 1000;               -- 1000 x 175 KB = 175 MB worst case, under the 500 MB limit
  max_puts_per_hour constant int := 20;
  sender_address text := coalesce(nullif(split_part(current_setting('request.headers', true)::json->>'x-forwarded-for', ',', 1), ''), 'unknown');
  expiry timestamptz := now() + make_interval(mins => greatest(5, least(coalesce(p_ttl_minutes, 60), 1440)));
begin
  delete from transfers where expires_at <= now();
  delete from transfer_puts where created_at <= now() - interval '1 hour';
  if (select count(*) from transfer_puts where client = sender_address) >= max_puts_per_hour then
    raise exception 'too many transfers from this connection, try again later' using errcode = 'check_violation';
  end if;
  if (select count(*) from transfers) >= max_rows then
    raise exception 'transfer inbox is full, try again later' using errcode = 'check_violation';
  end if;
  insert into transfer_puts (client) values (sender_address);
  insert into transfers (id, payload, expires_at) values (p_id, p_payload, expiry);
  return expiry;
end $$;

-- ---------------------------------------------------------------------------------------
-- Plan reports: only older accounts count
-- ---------------------------------------------------------------------------------------
create or replace function plan_reports_after_insert() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if (
    select count(*) from plan_reports r
    join auth.users u on u.id = r.reporter_id
    where r.plan_id = new.plan_id and u.created_at <= now() - interval '1 day'
  ) >= 3 then
    update public_plans set hidden = true where id = new.plan_id;
  end if;
  return null;
end $$;

-- ---------------------------------------------------------------------------------------
-- Plan library: publishing checks, under a lock per person
-- ---------------------------------------------------------------------------------------
create or replace function public_plans_guard() returns trigger
language plpgsql as $$
begin
  if tg_op = 'INSERT' then
    perform pg_advisory_xact_lock(hashtextextended(new.owner_id::text, 0));
    if (select count(*) from public_plans where owner_id = new.owner_id) >= 30 then
      raise exception 'You can publish at most 30 plans. Remove one first.' using errcode = 'check_violation';
    end if;
    if (select count(*) from public_plans where owner_id = new.owner_id and created_at > now() - interval '1 hour') >= 5 then
      raise exception 'You are publishing too fast. Try again in a while.' using errcode = 'check_violation';
    end if;
    if (select coalesce(sum(pg_column_size(payload)), 0) from public_plans) + pg_column_size(new.payload) > 200000000 then
      raise exception 'The plan library is full. Try again later.' using errcode = 'check_violation';
    end if;
    new.hidden := false;
  else
    new.updated_at := now();
    new.owner_id := old.owner_id;
    new.created_at := old.created_at;
    -- Only moderation (the dashboard, or the report trigger) may hide or unhide.
    if new.hidden is distinct from old.hidden and current_user in ('anon', 'authenticated') then
      new.hidden := old.hidden;
    end if;
  end if;
  return new;
end $$;

-- ---------------------------------------------------------------------------------------
-- Trigger functions: only the table triggers call them
-- ---------------------------------------------------------------------------------------
revoke execute on function handle_new_user() from public, anon, authenticated;
revoke execute on function plan_reports_after_insert() from public, anon, authenticated;
revoke execute on function public_plans_guard() from public, anon, authenticated;

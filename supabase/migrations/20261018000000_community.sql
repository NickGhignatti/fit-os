-- Tracker: accounts and the public plan library.
--
-- Everything the user owns stays on their device. An account exists only to publish plans for
-- others to browse and copy. Privacy by design:
--  * The public profile is a handle the user chooses. Google's name, email and photo are NEVER
--    copied into it; the email stays in auth.users, which the API cannot read.
--  * Browsing is open to everyone (no account needed); publishing, reporting and deleting
--    require sign-in and are limited by row-level security.
--  * delete_my_account() erases the user and, by cascade, their profile, plans and reports.

-- ---------------------------------------------------------------------------------------
-- Profiles: the only thing other people can see about an account
-- ---------------------------------------------------------------------------------------
create table profiles (
  id           uuid primary key references auth.users on delete cascade,
  handle       text not null unique check (handle ~ '^[a-z0-9_]{3,24}$'),
  display_name text not null default '' check (char_length(display_name) <= 40),
  created_at   timestamptz not null default now()
);

-- A random handle at sign-up, so a new account is never identified by its real name.
create function handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  candidate text;
begin
  loop
    candidate := 'user_' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 8);
    exit when not exists (select 1 from profiles where handle = candidate);
  end loop;
  insert into profiles (id, handle) values (new.id, candidate);
  return new;
end $$;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function handle_new_user();

-- ---------------------------------------------------------------------------------------
-- Public plans
--   payload: a TrainingPlan or DietPlan as the app exports it; the app validates it again
--   before importing, because it is user-supplied.
-- ---------------------------------------------------------------------------------------
create table public_plans (
  id          uuid primary key default gen_random_uuid(),
  owner_id    uuid not null references profiles on delete cascade,
  kind        text not null check (kind in ('training', 'diet')),
  title       text not null check (char_length(title) between 1 and 80),
  description text not null default '' check (char_length(description) <= 500),
  payload     jsonb not null check (pg_column_size(payload) <= 262144),
  hidden      boolean not null default false,       -- set by moderation, never by the owner
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index public_plans_recent on public_plans (created_at desc) where not hidden;
create index public_plans_owner on public_plans (owner_id);

create function public_plans_guard() returns trigger
language plpgsql as $$
begin
  if tg_op = 'INSERT' then
    -- Anti-spam and a ceiling on storage per person (free-tier friendly).
    if (select count(*) from public_plans where owner_id = new.owner_id) >= 30 then
      raise exception 'You can publish at most 30 plans. Remove one first.' using errcode = 'check_violation';
    end if;
    if (select count(*) from public_plans where owner_id = new.owner_id and created_at > now() - interval '1 hour') >= 5 then
      raise exception 'You are publishing too fast. Try again in a while.' using errcode = 'check_violation';
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

create trigger public_plans_guard_trigger before insert or update on public_plans
  for each row execute function public_plans_guard();

-- ---------------------------------------------------------------------------------------
-- Reports: a plan reported by three different people is hidden until someone reviews it
-- ---------------------------------------------------------------------------------------
create table plan_reports (
  plan_id     uuid not null references public_plans on delete cascade,
  reporter_id uuid not null references auth.users on delete cascade,
  reason      text not null check (char_length(reason) between 3 and 500),
  created_at  timestamptz not null default now(),
  primary key (plan_id, reporter_id)              -- one report per person per plan
);

create function plan_reports_after_insert() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if (select count(*) from plan_reports where plan_id = new.plan_id) >= 3 then
    update public_plans set hidden = true where id = new.plan_id;
  end if;
  return null;
end $$;

create trigger plan_reports_trigger after insert on plan_reports
  for each row execute function plan_reports_after_insert();

-- ---------------------------------------------------------------------------------------
-- Row level security
-- ---------------------------------------------------------------------------------------
alter table profiles     enable row level security;
alter table public_plans enable row level security;
alter table plan_reports enable row level security;

-- Handles and display names are public so plans can show their author.
create policy "profiles are public" on profiles for select using (true);
create policy "edit own profile" on profiles for update
  using (id = (select auth.uid())) with check (id = (select auth.uid()));

create policy "browse visible plans, and your own" on public_plans for select
  using (not hidden or owner_id = (select auth.uid()));
create policy "publish as yourself" on public_plans for insert
  with check (owner_id = (select auth.uid()));
create policy "edit your own plans" on public_plans for update
  using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));
create policy "remove your own plans" on public_plans for delete
  using (owner_id = (select auth.uid()));

-- Reports can be sent but not read back through the API: reporters stay private.
create policy "report as yourself" on plan_reports for insert
  with check (reporter_id = (select auth.uid()));

-- ---------------------------------------------------------------------------------------
-- Account deletion (required by Google's and GDPR's rules: users must be able to leave)
-- ---------------------------------------------------------------------------------------
create function delete_my_account() returns void
language plpgsql security definer set search_path = public, auth as $$
begin
  if (select auth.uid()) is null then
    raise exception 'not signed in' using errcode = '28000';
  end if;
  delete from auth.users where id = (select auth.uid());   -- cascades to profile, plans, reports
end $$;

revoke execute on function delete_my_account() from public, anon;
grant execute on function delete_my_account() to authenticated;

-- Tracker: a public profile for every account that signed in before the community tables existed.
--
-- New accounts get one from the on_auth_user_created trigger; accounts created earlier have none,
-- so the app shows "@…" and cannot save a handle. Safe to run more than once.

insert into profiles (id, handle)
select u.id, 'user_' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 8)
from auth.users u
where not exists (select 1 from profiles p where p.id = u.id);

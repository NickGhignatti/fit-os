-- Tracker: "Add a device". Moves everything on one device to another device of the same account.
--
-- Flow: device A (signed in) exports its data, encrypts it with a key derived from a one-time code,
-- and uploads it in parts with put_device_link(). It shows the code as a QR. Device B, signed in to
-- the same account, derives the same id from the code, reads every part with take_device_link(),
-- decrypts, imports, then calls finish_device_link() to delete the rows.
--
--  * Two keys are needed to read the data: the account (rows are visible to their owner only) and
--    the code (the server never sees it, so it can never decrypt what it stores).
--  * Nothing stays: rows live for at most 30 minutes, and starting a new link deletes the old one.
--  * Free tier: a link is at most 40 parts of 500 KB (20 MB), and the whole table is capped at
--    200 MB, under the 500 MB database limit. A year of use is typically well under 1 MB.

create table device_links (
  id         text not null check (id ~ '^[0-9a-f]{64}$'),
  part       int  not null check (part between 0 and 39),
  parts      int  not null check (parts between 1 and 40),
  owner_id   uuid not null references auth.users on delete cascade,
  payload    text not null check (char_length(payload) between 1 and 500000),   -- base64 ciphertext
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  primary key (id, part),
  check (part < parts)
);
create index device_links_expires on device_links (expires_at);
create index device_links_owner on device_links (owner_id);

alter table device_links enable row level security;   -- no policies: only the functions below reach it
revoke all on device_links from anon, authenticated;

-- Stores one part of a link; returns when the link expires. Part 0 starts a link and replaces any
-- earlier link of the same account; later parts must follow part 0 of the same link.
create function put_device_link(p_id text, p_part int, p_parts int, p_payload text)
returns timestamptz
language plpgsql security definer set search_path = public as $$
declare
  me uuid := auth.uid();
  max_bytes constant bigint := 200000000;      -- 200 MB for the whole table
  expiry timestamptz;
begin
  if me is null then
    raise exception 'not signed in' using errcode = '28000';
  end if;
  delete from device_links where expires_at <= now();
  if p_part = 0 then
    delete from device_links where owner_id = me;
    expiry := now() + interval '30 minutes';
  else
    select expires_at into expiry from device_links where id = p_id and part = 0 and owner_id = me and parts = p_parts;
    if expiry is null then
      raise exception 'link not started' using errcode = 'check_violation';
    end if;
  end if;
  if (select coalesce(sum(char_length(payload)), 0) from device_links) + char_length(p_payload) > max_bytes then
    raise exception 'device link storage is full, try again later' using errcode = 'check_violation';
  end if;
  insert into device_links (id, part, parts, owner_id, payload, expires_at)
  values (p_id, p_part, p_parts, me, p_payload, expiry);
  return expiry;
end $$;

-- One part of a live link of the signed-in account, or no row.
create function take_device_link(p_id text, p_part int)
returns table (parts int, payload text)
language sql security definer set search_path = public stable as $$
  select l.parts, l.payload from device_links l
  where l.id = p_id and l.part = p_part and l.owner_id = auth.uid() and l.expires_at > now();
$$;

-- Deletes a link once the new device has it.
create function finish_device_link(p_id text)
returns void
language sql security definer set search_path = public as $$
  delete from device_links where id = p_id and owner_id = auth.uid();
$$;

revoke execute on function put_device_link(text, int, int, text) from public, anon;
revoke execute on function take_device_link(text, int) from public, anon;
revoke execute on function finish_device_link(text) from public, anon;
grant execute on function put_device_link(text, int, int, text) to authenticated;
grant execute on function take_device_link(text, int) to authenticated;
grant execute on function finish_device_link(text) to authenticated;

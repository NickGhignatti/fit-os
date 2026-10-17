-- Tracker: temporary, end-to-end encrypted hand-off of one item between two devices.
--
-- Flow: device A encrypts an item with a key derived from a one-time code and calls
-- put_transfer(id, ciphertext). Device B derives the same id from the code, calls
-- take_transfer(id) and decrypts. The row is deleted when taken, or when it expires.
--
--  * No accounts: the code is the only secret, and the server never sees it nor the plaintext.
--    `id` is a slow-KDF derivation of the code (see web/src/transfer/crypto.ts), so a copy of
--    this table cannot be brute-forced offline.
--  * The table is not reachable through the API; only the two functions below are.
--  * Free tier: rows live for at most 24 h, so the table stays near-empty. A row cap bounds the
--    worst case (see max_rows in put_transfer).

create table transfers (
  id         text primary key check (id ~ '^[0-9a-f]{64}$'),
  payload    text not null check (char_length(payload) between 1 and 175000),   -- base64 ciphertext
  created_at timestamptz not null default now(),
  expires_at timestamptz not null
);
create index transfers_expires on transfers (expires_at);

alter table transfers enable row level security;   -- no policies: direct access is denied
revoke all on transfers from anon, authenticated;

-- Stores a transfer; returns when it expires. Expired rows are purged on every call, so no cron is needed.
create function put_transfer(p_id text, p_payload text, p_ttl_minutes int default 60)
returns timestamptz
language plpgsql security definer set search_path = public as $$
declare
  max_rows constant int := 1000;               -- 1000 x 175 KB = 175 MB worst case, under the 500 MB limit
  expiry timestamptz := now() + make_interval(mins => greatest(5, least(coalesce(p_ttl_minutes, 60), 1440)));
begin
  delete from transfers where expires_at <= now();
  if (select count(*) from transfers) >= max_rows then
    raise exception 'transfer inbox is full, try again later' using errcode = 'check_violation';
  end if;
  insert into transfers (id, payload, expires_at) values (p_id, p_payload, expiry);
  return expiry;
end $$;

-- Returns the payload of a live transfer, or null. With p_consume (default) the row is deleted,
-- making the code single-use.
create function take_transfer(p_id text, p_consume boolean default true)
returns text
language plpgsql security definer set search_path = public as $$
declare
  found text;
begin
  if p_consume then
    delete from transfers where id = p_id and expires_at > now() returning payload into found;
  else
    select payload into found from transfers where id = p_id and expires_at > now();
  end if;
  return found;
end $$;

revoke execute on function put_transfer(text, text, int) from public;
revoke execute on function take_transfer(text, boolean) from public;
grant execute on function put_transfer(text, text, int) to anon, authenticated;
grant execute on function take_transfer(text, boolean) to anon, authenticated;

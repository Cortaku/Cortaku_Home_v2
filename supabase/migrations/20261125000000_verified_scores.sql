-- Verified scores. The Worker replays each run before posting it (worker/index.ts), then calls
-- cortaku_post_score with a shared key that only it holds. This migration is additive: the old
-- direct insert keeps working until 20261125000100 closes it.
--
-- After applying, store the key (the same value as the Worker's RUN_SECRET) by hand; it is never committed:
--   insert into private.cortaku_settings (name, value) values ('score_key', '<RUN_SECRET>')
--   on conflict (name) do update set value = excluded.value;

-- Each run ticket can post one score.
alter table public.cortaku_high_scores add column run_id text unique;

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create table private.cortaku_settings (
  name text primary key,
  value text not null
);
revoke all on table private.cortaku_settings from public, anon, authenticated;

-- The rate limit keys on the visitor's address. Called through the Worker, the request comes from
-- Cloudflare, so cortaku_post_score passes the visitor's address along in a setting.
create or replace function public.cortaku_high_scores_guard()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  headers json := nullif(current_setting('request.headers', true), '')::json;
  client_ip text := coalesce(
    nullif(current_setting('cortaku.client_ip', true), ''),
    nullif(btrim(split_part(coalesce(headers ->> 'cf-connecting-ip', headers ->> 'x-forwarded-for', ''), ',', 1)), ''),
    'unknown'
  );
begin
  new.player_name := btrim(new.player_name);
  new.ip_address := client_ip;
  new.created_at := now();

  if client_ip <> 'unknown' and (
    select count(*) from public.cortaku_high_scores
    where ip_address = client_ip and created_at > now() - interval '1 minute'
  ) >= 5 then
    raise exception 'Rate limit exceeded. Try again in a minute.' using errcode = 'P0001';
  end if;

  return new;
end;
$$;

create function public.cortaku_post_score(
  p_key text,
  p_name text,
  p_score integer,
  p_date date,
  p_run_id text,
  p_ip text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_key is null or p_key is distinct from (select value from private.cortaku_settings where name = 'score_key') then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  -- The same rule the insert policy applies: today's course, or yesterday's for a run that crossed midnight (UTC).
  if p_date is not null and p_date not between (now() at time zone 'utc')::date - 1 and (now() at time zone 'utc')::date then
    raise exception 'Daily run is closed' using errcode = 'P0001';
  end if;
  perform set_config('cortaku.client_ip', coalesce(p_ip, ''), true);
  insert into public.cortaku_high_scores (player_name, score, challenge_date, run_id)
  values (p_name, p_score, p_date, p_run_id);
end;
$$;

revoke all on function public.cortaku_post_score(text, text, integer, date, text, text) from public;
grant execute on function public.cortaku_post_score(text, text, integer, date, text, text) to anon, authenticated;

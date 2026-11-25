-- Leaderboard for the jump game on cortaku.com. The browser talks to this table
-- directly with the publishable key, so every rule lives here in the database.

create table public.cortaku_high_scores (
  id bigint generated always as identity primary key,
  player_name text not null check (char_length(player_name) between 1 and 15),
  score integer not null check (score between 0 and 1000000),
  -- NULL for an endless run; the UTC date of the course for a daily run.
  challenge_date date,
  ip_address text,
  created_at timestamptz not null default now()
);

comment on table public.cortaku_high_scores is 'High scores for the cortaku.com jump game (all-time endless board and one board per daily run).';

create index cortaku_high_scores_board_idx on public.cortaku_high_scores (challenge_date, score desc, id);
create index cortaku_high_scores_rate_idx on public.cortaku_high_scores (ip_address, created_at);

alter table public.cortaku_high_scores enable row level security;

-- Visitors may read the public columns and post a name, a score and (for a daily run) its date. Nothing else.
revoke all on table public.cortaku_high_scores from anon, authenticated;
grant select (id, player_name, score, challenge_date) on table public.cortaku_high_scores to anon, authenticated;
grant insert (player_name, score, challenge_date) on table public.cortaku_high_scores to anon, authenticated;

create policy "Anyone can read scores"
  on public.cortaku_high_scores for select
  to anon, authenticated
  using (true);

-- A daily score can only be posted for today or, for a run that crosses midnight, yesterday (UTC).
create policy "Anyone can post a current score"
  on public.cortaku_high_scores for insert
  to anon, authenticated
  with check (
    challenge_date is null
    or challenge_date between (now() at time zone 'utc')::date - 1 and (now() at time zone 'utc')::date
  );

-- Stamps each new score with the caller's address and allows five posts a minute per address.
create function public.cortaku_high_scores_guard()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  headers json := nullif(current_setting('request.headers', true), '')::json;
  client_ip text := coalesce(
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

revoke all on function public.cortaku_high_scores_guard() from public, anon, authenticated;

create trigger cortaku_high_scores_guard
  before insert on public.cortaku_high_scores
  for each row execute function public.cortaku_high_scores_guard();

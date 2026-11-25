-- The Mealie tables that share this project had no row-level security, so the project's public
-- API key could read and change them. Enabling it with no policies closes them to that key.
-- Mealie itself connects as the table owner, which is not subject to these rules.
do $$
declare
  t record;
begin
  for t in
    select c.relname
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity
  loop
    execute format('alter table public.%I enable row level security', t.relname);
  end loop;
end $$;

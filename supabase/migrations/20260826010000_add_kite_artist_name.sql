-- Adds required public attribution to projects created with the first migration.
alter table public.kites
  add column if not exists artist_name text;

-- Preserve any submissions made before creator names were required.
update public.kites
set artist_name = 'Anonymous'
where artist_name is null;

alter table public.kites
  alter column artist_name set not null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'kites_artist_name_check'
      and conrelid = 'public.kites'::regclass
  ) then
    alter table public.kites
      add constraint kites_artist_name_check check (
        char_length(btrim(artist_name)) between 1 and 32
        and artist_name = btrim(artist_name)
      );
  end if;
end
$$;

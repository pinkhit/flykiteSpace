-- Adds optional public country attribution to existing kite libraries.
alter table public.kites
  add column if not exists country text;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'kites_country_check'
      and conrelid = 'public.kites'::regclass
  ) then
    alter table public.kites
      add constraint kites_country_check check (
        country is null
        or (
          char_length(btrim(country)) between 1 and 56
          and country = btrim(country)
        )
      );
  end if;
end
$$;

-- Community kite metadata. Artwork is stored in the kite-art Storage bucket.
create table if not exists public.kites (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  artist_name text not null constraint kites_artist_name_check check (
    char_length(btrim(artist_name)) between 1 and 32
    and artist_name = btrim(artist_name)
  ),
  country text constraint kites_country_check check (
    country is null
    or (
      char_length(btrim(country)) between 1 and 56
      and country = btrim(country)
    )
  ),
  title text not null check (
    char_length(btrim(title)) between 1 and 40
    and title = btrim(title)
  ),
  image_path text not null unique check (
    image_path = owner_id::text || '/' || split_part(image_path, '/', 2)
    and image_path ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}\.png$'
  ),
  moderation_status text not null default 'pending' check (
    moderation_status in ('pending', 'approved', 'rejected')
  ),
  created_at timestamptz not null default now()
);

create index if not exists kites_public_library_index
  on public.kites (created_at desc)
  where moderation_status = 'approved';

alter table public.kites enable row level security;

revoke all on table public.kites from anon, authenticated;
grant select on table public.kites to anon, authenticated;
grant insert, delete on table public.kites to authenticated;

drop policy if exists "approved kites are publicly readable" on public.kites;
create policy "approved kites are publicly readable"
  on public.kites
  for select
  to anon, authenticated
  using (moderation_status = 'approved');

drop policy if exists "owners can read their submissions" on public.kites;
create policy "owners can read their submissions"
  on public.kites
  for select
  to authenticated
  using ((select auth.uid()) = owner_id);

drop policy if exists "users can submit pending kites" on public.kites;
create policy "users can submit pending kites"
  on public.kites
  for insert
  to authenticated
  with check (
    (select auth.uid()) = owner_id
    and moderation_status = 'pending'
  );

drop policy if exists "owners can delete pending kites" on public.kites;
create policy "owners can delete pending kites"
  on public.kites
  for delete
  to authenticated
  using (
    (select auth.uid()) = owner_id
    and moderation_status = 'pending'
  );

-- A public bucket makes approved art cacheable without generating signed URLs.
-- Object listing remains unavailable; pending paths are only returned to owners.
insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'kite-art',
  'kite-art',
  true,
  262144,
  array['image/png']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "users can upload kite pngs to their folder"
  on storage.objects;
create policy "users can upload kite pngs to their folder"
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'kite-art'
    and (storage.foldername(name))[1] = (select auth.uid()::text)
    and storage.extension(name) = 'png'
  );

drop policy if exists "users can delete kite pngs from their folder"
  on storage.objects;
create policy "users can delete kite pngs from their folder"
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'kite-art'
    and (storage.foldername(name))[1] = (select auth.uid()::text)
    and not exists (
      select 1
      from public.kites
      where image_path = name
        and moderation_status <> 'pending'
    )
  );

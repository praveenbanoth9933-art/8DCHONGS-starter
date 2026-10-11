-- 8DCHONGS starter schema
-- Run this in Supabase Dashboard > SQL Editor.
-- Important: this starter keeps audio publicly streamable. Only upload tracks you own or are licensed to distribute.

create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  role text not null default 'user' check (role in ('user','admin')),
  created_at timestamptz not null default now()
);

create table if not exists public.songs (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  artist text not null,
  genre text not null default 'Independent',
  cover_url text,
  audio_path text not null,
  published boolean not null default false,
  uploaded_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.favorites (
  user_id uuid not null references auth.users(id) on delete cascade,
  song_id uuid not null references public.songs(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, song_id)
);

create table if not exists public.playlists (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 80),
  created_at timestamptz not null default now()
);

create table if not exists public.playlist_songs (
  playlist_id uuid not null references public.playlists(id) on delete cascade,
  song_id uuid not null references public.songs(id) on delete cascade,
  position integer not null default 0,
  primary key (playlist_id, song_id)
);

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles
    where id = (select auth.uid()) and role = 'admin'
  );
$$;

revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to anon, authenticated;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name, role)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'display_name', ''), 'user')
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure public.handle_new_user();

alter table public.profiles enable row level security;
alter table public.songs enable row level security;
alter table public.favorites enable row level security;
alter table public.playlists enable row level security;
alter table public.playlist_songs enable row level security;

-- Profiles: signed-in users can read/update their own display name only.
grant select, insert, update on public.profiles to authenticated;
create policy "profiles read own" on public.profiles for select to authenticated using ((select auth.uid()) = id or public.is_admin());
create policy "profiles insert own" on public.profiles for insert to authenticated with check ((select auth.uid()) = id and role = 'user');
create policy "profiles update own display name" on public.profiles for update to authenticated using ((select auth.uid()) = id) with check ((select auth.uid()) = id and role = 'user');
create policy "admin read all profiles" on public.profiles for select to authenticated using (public.is_admin());

-- Songs: anyone can read published tracks. Only admin can insert/update/delete.
grant select on public.songs to anon, authenticated;
grant insert, update, delete on public.songs to authenticated;
create policy "published songs are readable" on public.songs for select to anon, authenticated using (published = true or public.is_admin());
create policy "admin insert songs" on public.songs for insert to authenticated with check (public.is_admin());
create policy "admin update songs" on public.songs for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "admin delete songs" on public.songs for delete to authenticated using (public.is_admin());

-- Favorites: users can only manage their own rows.
grant select, insert, delete on public.favorites to authenticated;
create policy "read own favorites" on public.favorites for select to authenticated using ((select auth.uid()) = user_id);
create policy "add own favorites" on public.favorites for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "delete own favorites" on public.favorites for delete to authenticated using ((select auth.uid()) = user_id);

-- Playlists: users can only manage their own playlists.
grant select, insert, update, delete on public.playlists to authenticated;
create policy "read own playlists" on public.playlists for select to authenticated using ((select auth.uid()) = user_id);
create policy "create own playlists" on public.playlists for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "update own playlists" on public.playlists for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "delete own playlists" on public.playlists for delete to authenticated using ((select auth.uid()) = user_id);

grant select, insert, delete on public.playlist_songs to authenticated;
create policy "read songs in own playlists" on public.playlist_songs for select to authenticated using (
  exists (select 1 from public.playlists p where p.id = playlist_id and p.user_id = (select auth.uid()))
);
create policy "add songs to own playlists" on public.playlist_songs for insert to authenticated with check (
  exists (select 1 from public.playlists p where p.id = playlist_id and p.user_id = (select auth.uid()))
);
create policy "remove songs from own playlists" on public.playlist_songs for delete to authenticated using (
  exists (select 1 from public.playlists p where p.id = playlist_id and p.user_id = (select auth.uid()))
);

-- Storage buckets. Public read is needed for simple public audio playback.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('music', 'music', true, 26214400, array['audio/mpeg','audio/mp3','audio/wav','audio/x-wav','audio/ogg','audio/mp4','audio/aac','audio/flac'])
on conflict (id) do nothing;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('covers', 'covers', true, 5242880, array['image/jpeg','image/png','image/webp','image/avif'])
on conflict (id) do nothing;

create policy "public can read music files" on storage.objects for select to anon, authenticated using (bucket_id = 'music');
create policy "admins upload music files" on storage.objects for insert to authenticated with check (bucket_id = 'music' and public.is_admin());
create policy "admins delete music files" on storage.objects for delete to authenticated using (bucket_id in ('music','covers') and public.is_admin());
create policy "public can read cover files" on storage.objects for select to anon, authenticated using (bucket_id = 'covers');
create policy "admins upload cover files" on storage.objects for insert to authenticated with check (bucket_id = 'covers' and public.is_admin());

-- To promote your own account to admin:
-- 1. Sign up through the website.
-- 2. In Supabase > Authentication > Users, copy your user's UUID.
-- 3. Replace YOUR_USER_UUID below and run this statement separately:
-- update public.profiles set role = 'admin' where id = 'YOUR_USER_UUID';
-- Never add an admin signup form to the public website.

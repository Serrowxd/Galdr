-- Avatar storage setup for Galdr.
-- Run once in the Supabase dashboard → SQL editor (it talks to the same Postgres
-- the app uses; bucket + policies live in the `storage` schema).
--
-- Files are stored as "<auth-user-id>/avatar-<timestamp>.<ext>" so each user can
-- only write inside their own folder. The bucket is public, so the
-- /object/public/... URLs work in <img> tags without any SELECT policy or signed
-- URLs. We deliberately do NOT add a broad SELECT policy: it isn't needed for URL
-- access and would let anyone list the bucket (enumerating every user's id).

-- 1. Create (or update) the bucket with a hard size limit + image-only MIME types.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'avatars',
  'avatars',
  true,
  2097152, -- 2 MB, matches AVATAR_MAX_BYTES in components/ProfileSettings.tsx
  array['image/png', 'image/jpeg', 'image/webp', 'image/gif']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- 2. Row-level security policies on storage.objects, scoped to the avatars bucket.
-- No SELECT policy: public buckets serve objects without one, and adding a broad
-- read policy would expose a listing of every file (and thus every user id).
drop policy if exists "Avatar images are publicly readable" on storage.objects;

drop policy if exists "Users can upload their own avatar" on storage.objects;
create policy "Users can upload their own avatar"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = (select auth.uid()::text)
  );

drop policy if exists "Users can update their own avatar" on storage.objects;
create policy "Users can update their own avatar"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = (select auth.uid()::text)
  );

drop policy if exists "Users can delete their own avatar" on storage.objects;
create policy "Users can delete their own avatar"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = (select auth.uid()::text)
  );

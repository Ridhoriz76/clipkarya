-- ClipKarya AI — Row Level Security and Storage policies.
-- Server routes additionally verify ownership; RLS is the last line of defense.

alter table public.subscription_plans enable row level security;
alter table public.profiles enable row level security;
alter table public.user_subscriptions enable row level security;
alter table public.brand_kits enable row level security;
alter table public.projects enable row level security;
alter table public.media_assets enable row level security;
alter table public.project_scenes enable row level security;
alter table public.transcripts enable row level security;
alter table public.subtitle_tracks enable row level security;
alter table public.video_clips enable row level security;
alter table public.timeline_tracks enable row level security;
alter table public.timeline_items enable row level security;
alter table public.ai_generation_jobs enable row level security;
alter table public.render_jobs enable row level security;
alter table public.credit_transactions enable row level security;
alter table public.usage_logs enable row level security;
alter table public.app_settings enable row level security;

-- Plans are public (pricing page).
create policy plans_read on public.subscription_plans for select to anon, authenticated using (is_active);

-- Profiles: own row; only safe columns are updatable (role cannot be self-escalated).
create policy profiles_select_own on public.profiles for select to authenticated using (id = auth.uid());
create policy profiles_update_own on public.profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid());
revoke update on public.profiles from authenticated;
grant update (full_name, avatar_url, locale, onboarded) on public.profiles to authenticated;

create policy subs_select_own on public.user_subscriptions for select to authenticated using (user_id = auth.uid());

-- Fully user-managed tables.
do $$
declare t text;
begin
  foreach t in array array['brand_kits', 'projects', 'project_scenes', 'subtitle_tracks'] loop
    execute format('create policy %I_select on public.%I for select to authenticated using (user_id = auth.uid())', t, t);
    execute format('create policy %I_insert on public.%I for insert to authenticated with check (user_id = auth.uid())', t, t);
    execute format('create policy %I_update on public.%I for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid())', t, t);
    execute format('create policy %I_delete on public.%I for delete to authenticated using (user_id = auth.uid())', t, t);
  end loop;
end $$;

-- Child rows must point at a project the user owns.
create policy project_scenes_project_owner on public.project_scenes as restrictive for all to authenticated
  using (exists (select 1 from public.projects p where p.id = project_id and p.user_id = auth.uid()))
  with check (exists (select 1 from public.projects p where p.id = project_id and p.user_id = auth.uid()));

-- Media: created by the server (signed upload flow) or worker; users read/rename/delete their own.
create policy media_select_own on public.media_assets for select to authenticated using (user_id = auth.uid());
create policy media_update_own on public.media_assets for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy media_delete_own on public.media_assets for delete to authenticated using (user_id = auth.uid());
revoke update on public.media_assets from authenticated;
grant update (original_name) on public.media_assets to authenticated;

-- Transcripts: produced by the worker; users may edit text/segments/words.
create policy transcripts_select_own on public.transcripts for select to authenticated using (user_id = auth.uid());
create policy transcripts_update_own on public.transcripts for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy transcripts_delete_own on public.transcripts for delete to authenticated using (user_id = auth.uid());
revoke update on public.transcripts from authenticated;
grant update (text, segments, words, edited) on public.transcripts to authenticated;

-- Clip suggestions: produced by the worker; users adjust timestamps/title/status.
create policy clips_select_own on public.video_clips for select to authenticated using (user_id = auth.uid());
create policy clips_update_own on public.video_clips for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy clips_delete_own on public.video_clips for delete to authenticated using (user_id = auth.uid());
revoke update on public.video_clips from authenticated;
grant update (title, start_sec, end_sec, status, derived_project_id) on public.video_clips to authenticated;

-- Timeline rows are written through save_timeline() (security definer); reads are direct.
create policy timeline_tracks_select_own on public.timeline_tracks for select to authenticated using (user_id = auth.uid());
create policy timeline_items_select_own on public.timeline_items for select to authenticated using (user_id = auth.uid());

-- Jobs, credits, usage: read-only for users. Creation/updates happen server-side with the service role
-- so that users cannot forge job status, credit cost, or balances.
create policy ai_jobs_select_own on public.ai_generation_jobs for select to authenticated using (user_id = auth.uid());
create policy render_jobs_select_own on public.render_jobs for select to authenticated using (user_id = auth.uid());
create policy credit_tx_select_own on public.credit_transactions for select to authenticated using (user_id = auth.uid());
create policy usage_select_own on public.usage_logs for select to authenticated using (user_id = auth.uid());
-- app_settings: no policies → service role only.

-- ---------------------------------------------------------------------------
-- Storage: one private bucket; object keys start with the owner's user id.
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'media', 'media', false, 2147483648,
  array[
    'video/mp4', 'video/quicktime', 'video/webm', 'video/x-matroska',
    'audio/mpeg', 'audio/mp4', 'audio/wav', 'audio/x-wav', 'audio/webm', 'audio/ogg', 'audio/aac', 'audio/x-m4a',
    'image/png', 'image/jpeg', 'image/webp',
    'text/plain', 'application/x-subrip', 'text/vtt'
  ]
)
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

create policy media_objects_select_own on storage.objects for select to authenticated
  using (bucket_id = 'media' and (storage.foldername(name))[1] = auth.uid()::text);
create policy media_objects_insert_own on storage.objects for insert to authenticated
  with check (bucket_id = 'media' and (storage.foldername(name))[1] = auth.uid()::text);
create policy media_objects_update_own on storage.objects for update to authenticated
  using (bucket_id = 'media' and (storage.foldername(name))[1] = auth.uid()::text);
create policy media_objects_delete_own on storage.objects for delete to authenticated
  using (bucket_id = 'media' and (storage.foldername(name))[1] = auth.uid()::text);

-- Realtime (optional): broadcast job progress changes to their owners.
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.ai_generation_jobs, public.render_jobs;
  end if;
end $$;

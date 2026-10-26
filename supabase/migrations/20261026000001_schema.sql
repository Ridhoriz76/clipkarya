-- ClipKarya AI — core schema
-- Every user-owned table carries user_id and is protected by RLS (see 0002).

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Plans & subscriptions
-- ---------------------------------------------------------------------------
create table public.subscription_plans (
  id text primary key,
  name text not null,
  description text not null default '',
  price_cents integer not null default 0 check (price_cents >= 0),
  currency text not null default 'IDR',
  interval text not null default 'month' check (interval in ('month', 'year')),
  monthly_credits integer not null check (monthly_credits >= 0),
  max_upload_mb integer not null default 500,
  max_source_duration_sec integer not null default 1800,
  max_export_resolution text not null default '720p' check (max_export_resolution in ('720p', '1080p')),
  watermark boolean not null default false,
  features jsonb not null default '[]'::jsonb,
  is_default boolean not null default false,
  is_active boolean not null default true,
  sort_order integer not null default 0,
  external_price_id text,            -- future payment provider (e.g. Stripe price id)
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index subscription_plans_one_default on public.subscription_plans (is_default) where is_default;

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text,
  full_name text,
  avatar_url text,
  locale text not null default 'id' check (locale in ('id', 'en')),
  role text not null default 'user' check (role in ('user', 'admin')),
  onboarded boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.user_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  plan_id text not null references public.subscription_plans (id),
  status text not null default 'active' check (status in ('trialing', 'active', 'past_due', 'canceled')),
  current_period_start timestamptz not null default now(),
  current_period_end timestamptz not null default (now() + interval '1 month'),
  cancel_at_period_end boolean not null default false,
  external_customer_id text,
  external_subscription_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index user_subscriptions_one_live on public.user_subscriptions (user_id) where status in ('trialing', 'active', 'past_due');
create index user_subscriptions_period_end on public.user_subscriptions (current_period_end) where status in ('trialing', 'active');

-- ---------------------------------------------------------------------------
-- Brand kits
-- ---------------------------------------------------------------------------
create table public.brand_kits (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null default 'Brand saya',
  logo_asset_id uuid,
  intro_asset_id uuid,
  outro_asset_id uuid,
  colors jsonb not null default '["#7C5CFF", "#FFFFFF", "#0B0B0F"]'::jsonb,
  fonts jsonb not null default '{"heading": "Inter", "body": "Inter"}'::jsonb,
  caption_preset jsonb not null default '{}'::jsonb,
  default_voice jsonb,
  is_default boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index brand_kits_user on public.brand_kits (user_id);

-- ---------------------------------------------------------------------------
-- Projects & media
-- ---------------------------------------------------------------------------
create table public.projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  title text not null default 'Proyek tanpa judul' check (char_length(title) <= 200),
  mode text not null default 'editor' check (mode in (
    'editor', 'auto_clip', 'script_to_video', 'text_story', 'video_story', 'commentary', 'split_screen', 'listicle', 'transcriber'
  )),
  status text not null default 'draft' check (status in ('draft', 'processing', 'ready', 'archived')),
  aspect_ratio text not null default '9:16' check (aspect_ratio in ('9:16', '16:9', '1:1')),
  resolution text not null default '1080p' check (resolution in ('720p', '1080p')),
  fps integer not null default 30 check (fps in (24, 25, 30, 60)),
  background text not null default '#000000',
  caption_style jsonb not null default '{}'::jsonb,
  settings jsonb not null default '{}'::jsonb,
  source_asset_id uuid,
  thumbnail_asset_id uuid,
  brand_kit_id uuid references public.brand_kits (id) on delete set null,
  template_id text,
  timeline_version integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index projects_user_updated on public.projects (user_id, updated_at desc);

create table public.media_assets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  project_id uuid references public.projects (id) on delete cascade,
  kind text not null check (kind in ('video', 'audio', 'image', 'subtitle', 'export', 'thumbnail')),
  source text not null default 'upload' check (source in ('upload', 'tts', 'image_gen', 'video_gen', 'render', 'derived')),
  status text not null default 'pending_upload' check (status in ('pending_upload', 'processing', 'ready', 'failed')),
  storage_bucket text not null default 'media',
  storage_path text not null unique,
  original_name text,
  mime_type text not null,
  size_bytes bigint check (size_bytes is null or size_bytes >= 0),
  duration_sec double precision,
  width integer,
  height integer,
  has_audio boolean,
  thumbnail_path text,
  is_demo boolean not null default false,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index media_assets_user_created on public.media_assets (user_id, created_at desc);
create index media_assets_project on public.media_assets (project_id);
-- Storage path must live under the owner's folder (mirrors storage policies).
alter table public.media_assets add constraint media_assets_path_owner check (split_part(storage_path, '/', 1) = user_id::text);

alter table public.projects add constraint projects_source_asset_fk foreign key (source_asset_id) references public.media_assets (id) on delete set null;
alter table public.projects add constraint projects_thumbnail_asset_fk foreign key (thumbnail_asset_id) references public.media_assets (id) on delete set null;
alter table public.brand_kits add constraint brand_kits_logo_fk foreign key (logo_asset_id) references public.media_assets (id) on delete set null;
alter table public.brand_kits add constraint brand_kits_intro_fk foreign key (intro_asset_id) references public.media_assets (id) on delete set null;
alter table public.brand_kits add constraint brand_kits_outro_fk foreign key (outro_asset_id) references public.media_assets (id) on delete set null;

create table public.project_scenes (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  position integer not null,
  title text not null default '',
  narration text not null default '',
  visual_description text not null default '',
  on_screen_text text not null default '',
  duration_sec double precision not null default 5 check (duration_sec > 0),
  needs_verification boolean not null default false,
  image_asset_id uuid references public.media_assets (id) on delete set null,
  video_asset_id uuid references public.media_assets (id) on delete set null,
  voice_asset_id uuid references public.media_assets (id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index project_scenes_project_pos on public.project_scenes (project_id, position);

create table public.transcripts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  project_id uuid references public.projects (id) on delete cascade,
  asset_id uuid not null references public.media_assets (id) on delete cascade,
  provider text not null,
  language text,
  text text not null default '',
  segments jsonb not null default '[]'::jsonb,
  words jsonb not null default '[]'::jsonb,
  duration_sec double precision,
  is_demo boolean not null default false,
  edited boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index transcripts_asset on public.transcripts (asset_id, created_at desc);
create index transcripts_project on public.transcripts (project_id);
create index transcripts_fts on public.transcripts using gin (to_tsvector('simple', text));

create table public.subtitle_tracks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  project_id uuid references public.projects (id) on delete cascade,
  transcript_id uuid references public.transcripts (id) on delete set null,
  language text,
  label text not null default 'Subtitle',
  cues jsonb not null default '[]'::jsonb,
  style jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index subtitle_tracks_project on public.subtitle_tracks (project_id);

create table public.video_clips (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  project_id uuid not null references public.projects (id) on delete cascade,
  source_asset_id uuid not null references public.media_assets (id) on delete cascade,
  transcript_id uuid references public.transcripts (id) on delete set null,
  derived_project_id uuid references public.projects (id) on delete set null,
  title text not null default '',
  start_sec double precision not null check (start_sec >= 0),
  end_sec double precision not null,
  transcript_excerpt text not null default '',
  hook_text text not null default '',
  score integer not null default 0 check (score between 0 and 100),
  score_breakdown jsonb not null default '{}'::jsonb,
  reasons jsonb not null default '[]'::jsonb,
  thumbnail_asset_id uuid references public.media_assets (id) on delete set null,
  status text not null default 'suggested' check (status in ('suggested', 'selected', 'exported', 'dismissed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (end_sec > start_sec)
);
create index video_clips_project_score on public.video_clips (project_id, score desc);

create table public.timeline_tracks (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  client_id text not null,                      -- stable id used by the editor document
  kind text not null check (kind in ('video', 'overlay', 'narration', 'audio', 'subtitle')),
  name text not null default '',
  position integer not null default 0,
  muted boolean not null default false,
  hidden boolean not null default false,
  locked boolean not null default false,
  volume double precision not null default 1 check (volume between 0 and 2),
  unique (project_id, client_id)
);
create index timeline_tracks_project on public.timeline_tracks (project_id, position);

create table public.timeline_items (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  track_id uuid not null references public.timeline_tracks (id) on delete cascade,
  client_id text not null,
  type text not null check (type in ('video', 'image', 'audio', 'text', 'caption')),
  start_sec double precision not null check (start_sec >= 0),
  duration_sec double precision not null check (duration_sec > 0),
  asset_id uuid references public.media_assets (id) on delete restrict,
  props jsonb not null default '{}'::jsonb,   -- type-specific properties (volume, crop, text, style…)
  unique (project_id, client_id)
);
create index timeline_items_project_start on public.timeline_items (project_id, start_sec);
create index timeline_items_asset on public.timeline_items (asset_id);

-- ---------------------------------------------------------------------------
-- Jobs
-- ---------------------------------------------------------------------------
create table public.ai_generation_jobs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  project_id uuid references public.projects (id) on delete cascade,
  type text not null check (type in ('probe', 'transcription', 'clip_analysis', 'voice', 'script', 'image', 'video')),
  status text not null default 'queued' check (status in ('queued', 'processing', 'completed', 'failed', 'canceled')),
  progress real not null default 0 check (progress between 0 and 1),
  stage text,
  input jsonb not null default '{}'::jsonb,
  output jsonb,
  provider text,
  provider_request_id text,
  is_demo boolean not null default false,
  credits_cost integer not null default 0 check (credits_cost >= 0),
  credits_refunded boolean not null default false,
  error_message text,
  error_code text,
  attempts integer not null default 0,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index ai_jobs_user_created on public.ai_generation_jobs (user_id, created_at desc);
create index ai_jobs_project on public.ai_generation_jobs (project_id, created_at desc);
create index ai_jobs_active on public.ai_generation_jobs (status, updated_at) where status in ('queued', 'processing');

create table public.render_jobs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  project_id uuid not null references public.projects (id) on delete cascade,
  status text not null default 'queued' check (status in ('queued', 'processing', 'completed', 'failed', 'canceled')),
  progress real not null default 0 check (progress between 0 and 1),
  stage text,
  settings jsonb not null,
  timeline_snapshot jsonb not null,           -- exact project state at export time
  duration_sec double precision,
  output_asset_id uuid references public.media_assets (id) on delete set null,
  srt_asset_id uuid references public.media_assets (id) on delete set null,
  credits_cost integer not null default 0 check (credits_cost >= 0),
  credits_refunded boolean not null default false,
  error_message text,
  attempts integer not null default 0,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index render_jobs_user_created on public.render_jobs (user_id, created_at desc);
create index render_jobs_project on public.render_jobs (project_id, created_at desc);
create index render_jobs_active on public.render_jobs (status, updated_at) where status in ('queued', 'processing');

-- ---------------------------------------------------------------------------
-- Credits & usage
-- ---------------------------------------------------------------------------
create table public.credit_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  amount integer not null check (amount <> 0),  -- positive = grant/refund, negative = spend
  kind text not null check (kind in ('grant', 'spend', 'refund', 'adjustment', 'expire')),
  reason text not null,
  job_id uuid,
  job_table text check (job_table in ('ai_generation_jobs', 'render_jobs')),
  balance_after integer not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index credit_tx_user_created on public.credit_transactions (user_id, created_at desc);
-- A job can be refunded at most once.
create unique index credit_tx_one_refund_per_job on public.credit_transactions (job_id) where kind = 'refund';

create table public.usage_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  job_id uuid,
  job_table text,
  provider text not null,
  operation text not null,
  model text,
  units double precision not null default 0,
  unit_type text not null,
  estimated_cost_usd numeric(12, 6),
  credits integer not null default 0,
  is_demo boolean not null default false,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index usage_logs_user_created on public.usage_logs (user_id, created_at desc);
create index usage_logs_provider_created on public.usage_logs (provider, created_at desc);

-- Admin-editable key/value settings (feature flags, limits). Never store secrets here.
create table public.app_settings (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users (id) on delete set null
);

-- ---------------------------------------------------------------------------
-- updated_at triggers
-- ---------------------------------------------------------------------------
create or replace function public.touch_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

do $$
declare t text;
begin
  foreach t in array array[
    'subscription_plans', 'profiles', 'user_subscriptions', 'brand_kits', 'projects', 'media_assets',
    'project_scenes', 'transcripts', 'subtitle_tracks', 'video_clips', 'ai_generation_jobs', 'render_jobs'
  ] loop
    execute format('create trigger %I_touch before update on public.%I for each row execute function public.touch_updated_at()', t, t);
  end loop;
end $$;

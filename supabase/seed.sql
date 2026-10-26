-- Plan configuration (safe for all environments; edit prices/credits freely).
insert into public.subscription_plans (id, name, description, price_cents, currency, monthly_credits, max_upload_mb, max_source_duration_sec, max_export_resolution, watermark, features, is_default, sort_order)
values
  ('free', 'Gratis', 'Coba semua alur kerja inti.', 0, 'IDR', 30, 500, 1800, '720p', false,
   '["30 kredit/bulan", "Ekspor 720p", "Auto-clip & subtitle", "Voiceover AI"]', true, 0),
  ('creator', 'Kreator', 'Untuk kreator yang rutin posting.', 9900000, 'IDR', 300, 2048, 7200, '1080p', false,
   '["300 kredit/bulan", "Ekspor 1080p", "Upload hingga 2 GB", "Brand kit"]', false, 1),
  ('pro', 'Pro', 'Untuk tim dan agensi.', 29900000, 'IDR', 1200, 2048, 10800, '1080p', false,
   '["1.200 kredit/bulan", "Ekspor 1080p", "Prioritas antrean render", "Semua fitur AI"]', false, 2)
on conflict (id) do update set
  name = excluded.name, description = excluded.description, price_cents = excluded.price_cents,
  monthly_credits = excluded.monthly_credits, features = excluded.features, sort_order = excluded.sort_order;

insert into public.app_settings (key, value) values
  ('signups_enabled', 'true'::jsonb),
  ('max_concurrent_renders_per_user', '2'::jsonb)
on conflict (key) do nothing;

-- Integration test for migrations: run after stub_supabase.sql + migrations + seed.
\set ON_ERROR_STOP on
begin;

insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'a@example.com'),
  ('22222222-2222-2222-2222-222222222222', 'b@example.com');

-- Signup trigger bootstraps profile, subscription, credits, brand kit.
do $$ begin
  assert (select count(*) from public.profiles) = 2, 'profiles created';
  assert public.credit_balance('11111111-1111-1111-1111-111111111111') = 30, 'starting credits = free plan';
  assert (select plan_id from public.user_subscriptions where user_id = '11111111-1111-1111-1111-111111111111') = 'free';
end $$;

-- User A creates a project and (as server) an asset.
insert into public.projects (id, user_id, title) values ('aaaaaaaa-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'A project');
insert into public.media_assets (id, user_id, project_id, kind, storage_path, mime_type, status)
values ('aaaaaaaa-0000-0000-0000-0000000000a1', '11111111-1111-1111-1111-111111111111', 'aaaaaaaa-0000-0000-0000-000000000001', 'video',
        '11111111-1111-1111-1111-111111111111/aaaaaaaa-0000-0000-0000-000000000001/a1.mp4', 'video/mp4', 'ready');
insert into public.media_assets (id, user_id, kind, storage_path, mime_type, status)
values ('bbbbbbbb-0000-0000-0000-0000000000b1', '22222222-2222-2222-2222-222222222222', 'video',
        '22222222-2222-2222-2222-222222222222/library/b1.mp4', 'video/mp4', 'ready');

-- Path ownership constraint.
do $$ begin
  begin
    insert into public.media_assets (user_id, kind, storage_path, mime_type)
    values ('11111111-1111-1111-1111-111111111111', 'video', '22222222-2222-2222-2222-222222222222/x.mp4', 'video/mp4');
    raise exception 'path constraint not enforced';
  exception when check_violation then null;
  end;
end $$;

-- Credits: spend, insufficient, refund once.
insert into public.ai_generation_jobs (id, user_id, type, credits_cost) values ('cccccccc-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'transcription', 10);
select public.spend_credits('11111111-1111-1111-1111-111111111111', 10, 'test', 'cccccccc-0000-0000-0000-000000000001', 'ai_generation_jobs');
do $$ begin
  assert public.credit_balance('11111111-1111-1111-1111-111111111111') = 20;
  begin
    perform public.spend_credits('11111111-1111-1111-1111-111111111111', 999, 'too much', null, null);
    raise exception 'overspend allowed';
  exception when raise_exception then
    if sqlerrm <> 'insufficient_credits' then raise; end if;
  end;
  assert public.refund_job_credits('cccccccc-0000-0000-0000-000000000001', 'ai_generation_jobs') = 10;
  assert public.refund_job_credits('cccccccc-0000-0000-0000-000000000001', 'ai_generation_jobs') = 0, 'double refund';
  assert public.credit_balance('11111111-1111-1111-1111-111111111111') = 30;
end $$;

-- ---- Act as user A (authenticated) ----
set local role authenticated;
select set_config('request.jwt.claim.sub', '11111111-1111-1111-1111-111111111111', true);

do $$ begin
  assert (select count(*) from public.projects) = 1, 'A sees own project';
  assert (select count(*) from public.media_assets) = 1, 'A sees only own assets';
  assert (select count(*) from public.credit_transactions) >= 1;
  assert public.my_credit_balance() = 30;
end $$;

-- A cannot escalate role.
do $$ begin
  begin
    update public.profiles set role = 'admin' where id = auth.uid();
    raise exception 'role escalation allowed';
  exception when insufficient_privilege then null;
  end;
end $$;

-- A cannot call credit functions.
do $$ begin
  begin
    perform public.grant_credits(auth.uid(), 1000, 'hack');
    raise exception 'grant allowed';
  exception when insufficient_privilege then null;
  end;
end $$;

-- A cannot insert jobs directly.
do $$ begin
  begin
    insert into public.render_jobs (user_id, project_id, settings, timeline_snapshot) values (auth.uid(), 'aaaaaaaa-0000-0000-0000-000000000001', '{}', '{}');
    raise exception 'job insert allowed';
  exception when insufficient_privilege then null;
  end;
end $$;

-- Save + read timeline.
select public.save_timeline('aaaaaaaa-0000-0000-0000-000000000001', 0, '{
  "aspectRatio":"9:16","resolution":"720p","fps":30,"background":"#000000","captionStyle":{"font":"Inter"},
  "tracks":[{"id":"trk_video","kind":"video","name":"Video","position":0},{"id":"trk_subtitle","kind":"subtitle","name":"Sub","position":1}],
  "items":[
    {"id":"v1","trackId":"trk_video","type":"video","start":0,"duration":5,"assetId":"aaaaaaaa-0000-0000-0000-0000000000a1","sourceIn":3,"volume":1},
    {"id":"c1","trackId":"trk_subtitle","type":"caption","start":0,"duration":2,"text":"Halo","words":[]}
  ]}'::jsonb);
do $$ declare d jsonb; begin
  d := public.get_timeline('aaaaaaaa-0000-0000-0000-000000000001');
  assert jsonb_array_length(d -> 'items') = 2, 'items round-trip';
  assert (d -> 'items' -> 0 ->> 'sourceIn')::numeric = 3, 'props preserved';
  assert (d ->> 'timelineVersion')::int = 1;
  -- Version conflict detection.
  begin
    perform public.save_timeline('aaaaaaaa-0000-0000-0000-000000000001', 0, '{"tracks":[],"items":[]}'::jsonb);
    raise exception 'conflict not detected';
  exception when sqlstate 'P0003' then null;
  end;
  -- Cannot reference another user's asset.
  begin
    perform public.save_timeline('aaaaaaaa-0000-0000-0000-000000000001', 1, '{"tracks":[{"id":"t","kind":"video","position":0}],
      "items":[{"id":"x","trackId":"t","type":"video","start":0,"duration":1,"assetId":"bbbbbbbb-0000-0000-0000-0000000000b1"}]}'::jsonb);
    raise exception 'foreign asset allowed';
  exception when sqlstate 'P0004' then null;
  end;
end $$;

-- Storage policy: own folder only.
insert into storage.objects (bucket_id, name) values ('media', '11111111-1111-1111-1111-111111111111/p/x.mp4');
do $$ begin
  begin
    insert into storage.objects (bucket_id, name) values ('media', '22222222-2222-2222-2222-222222222222/p/x.mp4');
    raise exception 'foreign storage insert allowed';
  exception when insufficient_privilege then null;
  end;
end $$;

-- ---- Act as user B ----
select set_config('request.jwt.claim.sub', '22222222-2222-2222-2222-222222222222', true);
do $$ begin
  assert (select count(*) from public.projects) = 0, 'B cannot see A projects';
  assert (select count(*) from public.timeline_items) = 0, 'B cannot see A timeline';
  assert (select count(*) from storage.objects) = 0, 'B cannot see A objects';
  begin
    perform public.save_timeline('aaaaaaaa-0000-0000-0000-000000000001', null, '{"tracks":[],"items":[]}'::jsonb);
    raise exception 'B saved A timeline';
  exception when sqlstate 'P0002' then null;
  end;
end $$;
update public.projects set title = 'pwned' where id = 'aaaaaaaa-0000-0000-0000-000000000001';
reset role;
do $$ begin
  assert (select title from public.projects where id = 'aaaaaaaa-0000-0000-0000-000000000001') = 'A project', 'B updated A project';
end $$;

-- Monthly renewal grants once per period.
update public.user_subscriptions set current_period_end = now() - interval '1 minute' where user_id = '22222222-2222-2222-2222-222222222222';
do $$ begin
  assert public.renew_due_subscriptions() = 1;
  assert public.renew_due_subscriptions() = 0;
  assert public.credit_balance('22222222-2222-2222-2222-222222222222') = 60;
end $$;

select 'ALL DATABASE TESTS PASSED' as result;
rollback;

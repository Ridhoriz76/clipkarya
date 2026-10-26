-- ClipKarya AI — business functions (credits, signup bootstrap, timeline persistence)

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------
create or replace function public.is_admin(p_user uuid default auth.uid()) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = p_user and role = 'admin');
$$;

create or replace function public.credit_balance(p_user uuid) returns integer
language sql stable security definer set search_path = public as $$
  select coalesce(sum(amount), 0)::integer from public.credit_transactions where user_id = p_user;
$$;

-- Users may read only their own balance through this wrapper.
create or replace function public.my_credit_balance() returns integer
language sql stable security definer set search_path = public as $$
  select public.credit_balance(auth.uid());
$$;

-- ---------------------------------------------------------------------------
-- Credits (service role only). A per-user advisory lock serializes balance checks.
-- ---------------------------------------------------------------------------
create or replace function public.grant_credits(p_user uuid, p_amount integer, p_reason text, p_kind text default 'grant')
returns integer language plpgsql security definer set search_path = public as $$
declare v_balance integer;
begin
  if p_amount = 0 then return public.credit_balance(p_user); end if;
  perform pg_advisory_xact_lock(hashtext('credits:' || p_user::text));
  v_balance := public.credit_balance(p_user) + p_amount;
  insert into public.credit_transactions (user_id, amount, kind, reason, balance_after)
  values (p_user, p_amount, p_kind, p_reason, v_balance);
  return v_balance;
end $$;

create or replace function public.spend_credits(
  p_user uuid, p_amount integer, p_reason text, p_job_id uuid, p_job_table text
) returns integer language plpgsql security definer set search_path = public as $$
declare v_balance integer;
begin
  if p_amount < 0 then raise exception 'invalid_amount'; end if;
  if p_amount = 0 then return public.credit_balance(p_user); end if;
  perform pg_advisory_xact_lock(hashtext('credits:' || p_user::text));
  v_balance := public.credit_balance(p_user);
  if v_balance < p_amount then
    raise exception 'insufficient_credits' using errcode = 'P0001', detail = format('balance=%s required=%s', v_balance, p_amount);
  end if;
  insert into public.credit_transactions (user_id, amount, kind, reason, job_id, job_table, balance_after)
  values (p_user, -p_amount, 'spend', p_reason, p_job_id, p_job_table, v_balance - p_amount);
  return v_balance - p_amount;
end $$;

-- Refund a failed/canceled job exactly once (unique index on refunds by job_id enforces it).
create or replace function public.refund_job_credits(p_job_id uuid, p_job_table text, p_reason text default 'Pengembalian kredit: job gagal')
returns integer language plpgsql security definer set search_path = public as $$
declare v_user uuid; v_cost integer; v_refunded boolean; v_balance integer;
begin
  if p_job_table = 'ai_generation_jobs' then
    select user_id, credits_cost, credits_refunded into v_user, v_cost, v_refunded from public.ai_generation_jobs where id = p_job_id for update;
  elsif p_job_table = 'render_jobs' then
    select user_id, credits_cost, credits_refunded into v_user, v_cost, v_refunded from public.render_jobs where id = p_job_id for update;
  else
    raise exception 'invalid_job_table';
  end if;
  if v_user is null or v_refunded or coalesce(v_cost, 0) = 0 then return 0; end if;
  perform pg_advisory_xact_lock(hashtext('credits:' || v_user::text));
  v_balance := public.credit_balance(v_user) + v_cost;
  insert into public.credit_transactions (user_id, amount, kind, reason, job_id, job_table, balance_after)
  values (v_user, v_cost, 'refund', p_reason, p_job_id, p_job_table, v_balance)
  on conflict do nothing;
  execute format('update public.%I set credits_refunded = true where id = $1', p_job_table) using p_job_id;
  return v_cost;
end $$;

-- Monthly renewal: grant each live subscription its plan credits once per period.
create or replace function public.renew_due_subscriptions() returns integer
language plpgsql security definer set search_path = public as $$
declare r record; n integer := 0;
begin
  for r in
    select s.id, s.user_id, p.monthly_credits, p.name
    from public.user_subscriptions s join public.subscription_plans p on p.id = s.plan_id
    where s.status in ('trialing', 'active') and s.current_period_end <= now()
    for update of s skip locked
  loop
    update public.user_subscriptions
      set current_period_start = current_period_end,
          current_period_end = current_period_end + interval '1 month'
      where id = r.id;
    perform public.grant_credits(r.user_id, r.monthly_credits, 'Kredit bulanan paket ' || r.name);
    n := n + 1;
  end loop;
  return n;
end $$;

revoke all on function public.grant_credits(uuid, integer, text, text) from public, anon, authenticated;
revoke all on function public.spend_credits(uuid, integer, text, uuid, text) from public, anon, authenticated;
revoke all on function public.refund_job_credits(uuid, text, text) from public, anon, authenticated;
revoke all on function public.renew_due_subscriptions() from public, anon, authenticated;
revoke all on function public.credit_balance(uuid) from public, anon, authenticated;
grant execute on function public.grant_credits(uuid, integer, text, text) to service_role;
grant execute on function public.spend_credits(uuid, integer, text, uuid, text) to service_role;
grant execute on function public.refund_job_credits(uuid, text, text) to service_role;
grant execute on function public.renew_due_subscriptions() to service_role;
grant execute on function public.credit_balance(uuid) to service_role;
grant execute on function public.my_credit_balance() to authenticated;

-- ---------------------------------------------------------------------------
-- New user bootstrap: profile, default plan, starting credits, brand kit.
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_plan public.subscription_plans%rowtype;
begin
  insert into public.profiles (id, email, full_name)
  values (new.id, new.email, coalesce(new.raw_user_meta_data ->> 'full_name', split_part(new.email, '@', 1)))
  on conflict (id) do nothing;

  select * into v_plan from public.subscription_plans where is_default and is_active limit 1;
  if found then
    insert into public.user_subscriptions (user_id, plan_id, status) values (new.id, v_plan.id, 'active');
    perform public.grant_credits(new.id, v_plan.monthly_credits, 'Kredit awal paket ' || v_plan.name);
  end if;

  insert into public.brand_kits (user_id) values (new.id);
  return new;
end $$;

create trigger on_auth_user_created after insert on auth.users
for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Timeline persistence. Replaces the project's tracks/items atomically with
-- optimistic concurrency (p_expected_version must match projects.timeline_version).
-- The API validates the document with the shared zod schema before calling this.
-- ---------------------------------------------------------------------------
create or replace function public.save_timeline(p_project uuid, p_expected_version integer, p_doc jsonb)
returns integer language plpgsql security definer set search_path = public as $$
declare
  v_owner uuid;
  v_version integer;
  v_track jsonb;
  v_item jsonb;
  v_track_id uuid;
  v_asset uuid;
  v_track_map jsonb := '{}'::jsonb;
begin
  select user_id, timeline_version into v_owner, v_version from public.projects where id = p_project for update;
  if v_owner is null or v_owner <> auth.uid() then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  if p_expected_version is not null and p_expected_version <> v_version then
    raise exception 'version_conflict' using errcode = 'P0003', detail = format('current=%s', v_version);
  end if;

  delete from public.timeline_items where project_id = p_project;
  delete from public.timeline_tracks where project_id = p_project;

  for v_track in select * from jsonb_array_elements(coalesce(p_doc -> 'tracks', '[]'::jsonb)) loop
    insert into public.timeline_tracks (project_id, user_id, client_id, kind, name, position, muted, hidden, locked, volume)
    values (
      p_project, v_owner, v_track ->> 'id', v_track ->> 'kind', coalesce(v_track ->> 'name', ''),
      coalesce((v_track ->> 'position')::int, 0), coalesce((v_track ->> 'muted')::boolean, false),
      coalesce((v_track ->> 'hidden')::boolean, false), coalesce((v_track ->> 'locked')::boolean, false),
      coalesce((v_track ->> 'volume')::double precision, 1)
    ) returning id into v_track_id;
    v_track_map := v_track_map || jsonb_build_object(v_track ->> 'id', v_track_id);
  end loop;

  for v_item in select * from jsonb_array_elements(coalesce(p_doc -> 'items', '[]'::jsonb)) loop
    v_asset := nullif(v_item ->> 'assetId', '')::uuid;
    if v_asset is not null and not exists (select 1 from public.media_assets where id = v_asset and user_id = v_owner) then
      raise exception 'asset_forbidden' using errcode = 'P0004', detail = v_asset::text;
    end if;
    if not (v_track_map ? (v_item ->> 'trackId')) then
      raise exception 'unknown_track' using errcode = 'P0005';
    end if;
    insert into public.timeline_items (project_id, user_id, track_id, client_id, type, start_sec, duration_sec, asset_id, props)
    values (
      p_project, v_owner, (v_track_map ->> (v_item ->> 'trackId'))::uuid, v_item ->> 'id', v_item ->> 'type',
      (v_item ->> 'start')::double precision, (v_item ->> 'duration')::double precision, v_asset,
      v_item - array['id', 'trackId', 'type', 'start', 'duration', 'assetId']
    );
  end loop;

  update public.projects set
    aspect_ratio = coalesce(p_doc ->> 'aspectRatio', aspect_ratio),
    resolution = coalesce(p_doc ->> 'resolution', resolution),
    fps = coalesce((p_doc ->> 'fps')::int, fps),
    background = coalesce(p_doc ->> 'background', background),
    caption_style = coalesce(p_doc -> 'captionStyle', caption_style),
    timeline_version = v_version + 1
  where id = p_project;
  return v_version + 1;
end $$;

revoke all on function public.save_timeline(uuid, integer, jsonb) from public, anon;
grant execute on function public.save_timeline(uuid, integer, jsonb) to authenticated;

-- Read the timeline as the editor document shape.
create or replace function public.get_timeline(p_project uuid) returns jsonb
language sql stable security invoker set search_path = public as $$
  select jsonb_build_object(
    'version', 1,
    'aspectRatio', p.aspect_ratio,
    'resolution', p.resolution,
    'fps', p.fps,
    'background', p.background,
    'captionStyle', p.caption_style,
    'timelineVersion', p.timeline_version,
    'tracks', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', t.client_id, 'kind', t.kind, 'name', t.name, 'position', t.position,
        'muted', t.muted, 'hidden', t.hidden, 'locked', t.locked, 'volume', t.volume
      ) order by t.position) from public.timeline_tracks t where t.project_id = p.id), '[]'::jsonb),
    'items', coalesce((
      select jsonb_agg(i.props || jsonb_build_object(
        'id', i.client_id, 'trackId', t.client_id, 'type', i.type, 'start', i.start_sec, 'duration', i.duration_sec
      ) || case when i.asset_id is null then '{}'::jsonb else jsonb_build_object('assetId', i.asset_id) end
      order by i.start_sec)
      from public.timeline_items i join public.timeline_tracks t on t.id = i.track_id where i.project_id = p.id), '[]'::jsonb)
  )
  from public.projects p where p.id = p_project;
$$;
grant execute on function public.get_timeline(uuid) to authenticated, service_role;

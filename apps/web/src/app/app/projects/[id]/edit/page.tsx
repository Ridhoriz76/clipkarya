import { notFound } from "next/navigation";
import { assetIdsInTimeline, emptyTimeline, timelineSchema, type Timeline } from "@clipkarya/core";
import { Editor } from "@/components/editor/editor";
import { signPaths } from "@/lib/media";
import { createClient } from "@/lib/supabase/server";
import type { AssetDTO } from "@/lib/types";

export const metadata = { title: "Editor" };

const ASSET_COLS = "id, kind, status, source, original_name, mime_type, size_bytes, duration_sec, width, height, has_audio, is_demo, project_id, created_at, storage_path, thumbnail_path";

export default async function EditPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: project } = await supabase.from("projects").select("id, title, aspect_ratio, resolution").eq("id", id).maybeSingle();
  if (!project) notFound();
  const { data: raw } = await supabase.rpc("get_timeline", { p_project: id });
  const parsed = timelineSchema.safeParse(raw);
  const timeline: Timeline = parsed.success ? parsed.data : emptyTimeline(project.aspect_ratio, project.resolution);
  if (!timeline.tracks.length) timeline.tracks = emptyTimeline(project.aspect_ratio, project.resolution).tracks;
  const version = (raw as { timelineVersion?: number } | null)?.timelineVersion ?? 0;

  // Project media + any library media referenced by the timeline (both RLS-scoped to the owner).
  const referenced = assetIdsInTimeline(timeline);
  const [own, refs] = await Promise.all([
    supabase.from("media_assets").select(ASSET_COLS).eq("project_id", id).in("kind", ["video", "audio", "image"]).order("created_at", { ascending: false }),
    referenced.length ? supabase.from("media_assets").select(ASSET_COLS).in("id", referenced) : Promise.resolve({ data: [] }),
  ]);
  const rows = [...(own.data ?? []), ...((refs.data ?? []) as NonNullable<typeof own.data>)].filter((r, i, all) => all.findIndex((x) => x.id === r.id) === i);
  const urls = await signPaths(rows.flatMap((r) => [r.status === "ready" ? r.storage_path : null, r.thumbnail_path]), 3600);
  const assets: AssetDTO[] = rows.map(({ storage_path, thumbnail_path, ...r }) => ({
    ...r,
    url: r.status === "ready" ? (urls[storage_path] ?? null) : null,
    thumbnailUrl: thumbnail_path ? (urls[thumbnail_path] ?? null) : null,
  }));

  return <Editor project={{ id: project.id, title: project.title }} initialTimeline={timeline} initialVersion={version} initialAssets={assets} />;
}

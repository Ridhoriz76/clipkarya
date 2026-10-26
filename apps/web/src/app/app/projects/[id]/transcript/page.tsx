import { notFound } from "next/navigation";
import { TranscriptWorkspace } from "@/components/projects/transcript-workspace";
import { signPaths } from "@/lib/media";
import { createClient } from "@/lib/supabase/server";
import type { TranscriptDTO } from "@/lib/types";

export default async function ProjectTranscriptPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: project } = await supabase.from("projects").select("id, title, source_asset_id").eq("id", id).maybeSingle<{ id: string; title: string; source_asset_id: string | null }>();
  if (!project?.source_asset_id) notFound();
  const { data: source } = await supabase.from("media_assets").select("id, status, storage_path, duration_sec, original_name").eq("id", project.source_asset_id).single();
  const { data: transcript } = await supabase
    .from("transcripts")
    .select("id, asset_id, provider, language, text, segments, words, is_demo, edited, created_at")
    .eq("asset_id", project.source_asset_id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle<TranscriptDTO>();
  const urls = await signPaths([source?.storage_path]);
  return (
    <TranscriptWorkspace
      project={project}
      source={source ? { id: source.id, status: source.status, duration: source.duration_sec, name: source.original_name, url: urls[source.storage_path] ?? null } : null}
      transcript={transcript}
    />
  );
}

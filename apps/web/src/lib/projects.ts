import "server-only";
import { createClient } from "@/lib/supabase/server";
import { signPaths } from "@/lib/media";
import type { ProjectCardData } from "@/components/app/project-card";

/** Projects with signed thumbnail URLs (thumbnail = the project's thumbnail asset's poster frame). */
export async function listProjects(limit = 50): Promise<ProjectCardData[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("projects")
    .select("id, title, status, mode, aspect_ratio, updated_at, thumb:media_assets!projects_thumbnail_asset_fk(thumbnail_path)")
    .neq("status", "archived")
    .order("updated_at", { ascending: false })
    .limit(limit);
  const rows = (data ?? []) as unknown as (Omit<ProjectCardData, "thumbnailUrl"> & { thumb: { thumbnail_path: string | null } | null })[];
  const urls = await signPaths(rows.map((r) => r.thumb?.thumbnail_path));
  return rows.map(({ thumb, ...r }) => ({ ...r, thumbnailUrl: thumb?.thumbnail_path ? (urls[thumb.thumbnail_path] ?? null) : null }));
}

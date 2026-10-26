import { DEFAULT_CAPTION_STYLE } from "@clipkarya/core";
import { PageHeader } from "@/components/ui/misc";
import { requireUser } from "@/lib/auth";
import { signPaths } from "@/lib/media";
import { createClient } from "@/lib/supabase/server";
import { BrandKitForm, type BrandKitValue, type LibraryAsset } from "./form";

export default async function BrandKitPage() {
  await requireUser();
  const supabase = await createClient();
  const [{ data: kit }, { data: assets }] = await Promise.all([
    supabase
      .from("brand_kits")
      .select("name, colors, fonts, caption_preset, default_voice, logo_asset_id, intro_asset_id, outro_asset_id")
      .eq("is_default", true)
      .maybeSingle<BrandKitValue>(),
    supabase
      .from("media_assets")
      .select("id, kind, original_name, storage_path, thumbnail_path")
      .in("kind", ["image", "video"])
      .eq("status", "ready")
      .order("created_at", { ascending: false })
      .limit(100),
  ]);
  const rows = (assets ?? []) as { id: string; kind: "image" | "video"; original_name: string | null; storage_path: string; thumbnail_path: string | null }[];
  const urls = await signPaths(rows.map((a) => (a.kind === "image" ? a.storage_path : a.thumbnail_path)));
  const library: LibraryAsset[] = rows.map((a) => ({
    id: a.id,
    kind: a.kind,
    name: a.original_name ?? a.id.slice(0, 8),
    previewUrl: urls[(a.kind === "image" ? a.storage_path : a.thumbnail_path) ?? ""] ?? null,
  }));
  const value: BrandKitValue = kit ?? {
    name: "Brand saya",
    colors: ["#7C5CFF", "#FFFFFF", "#0B0B0F"],
    fonts: { heading: "Inter", body: "Inter" },
    caption_preset: {},
    default_voice: null,
    logo_asset_id: null,
    intro_asset_id: null,
    outro_asset_id: null,
  };
  return (
    <div className="max-w-4xl">
      <PageHeader title="Brand Kit" description="Warna, font, logo, intro/outro, gaya subtitle, dan suara default. Gaya subtitle diterapkan ke proyek baru yang tidak memakai template." />
      <BrandKitForm initial={{ ...value, caption_preset: { ...DEFAULT_CAPTION_STYLE, ...value.caption_preset } }} library={library} />
    </div>
  );
}

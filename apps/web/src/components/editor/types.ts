import type { AssetDTO } from "@/lib/types";

export type EditorAsset = AssetDTO;

export type SaveState = "saved" | "dirty" | "saving" | "error" | "conflict";

export const PX_PER_SEC_DEFAULT = 40;

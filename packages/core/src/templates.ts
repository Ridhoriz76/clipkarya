import type { CaptionStyle } from "./timeline";
import { DEFAULT_CAPTION_STYLE } from "./timeline";
import type { AspectRatio } from "./config";

/**
 * Templates are reusable presets: aspect ratio, caption typography and a scene
 * structure used by the script generator and the editor.
 */
export type TemplatePreset = {
  id: string;
  name: string;
  description: string;
  aspectRatio: AspectRatio;
  captionStyle: CaptionStyle;
  sceneStructure: string[];
  format: "script" | "story" | "listicle" | "clip";
};

const cap = (o: Partial<CaptionStyle>): CaptionStyle => ({ ...DEFAULT_CAPTION_STYLE, ...o });

export const TEMPLATES: TemplatePreset[] = [
  {
    id: "storytelling",
    name: "Storytelling",
    description: "Cerita faceless dengan hook kuat, konflik, dan penutup.",
    aspectRatio: "9:16",
    captionStyle: cap({ font: "Inter", size: 64, highlightColor: "#FACC15" }),
    sceneStructure: ["Hook", "Latar", "Konflik", "Puncak", "Penutup"],
    format: "story",
  },
  {
    id: "educational",
    name: "Edukasi",
    description: "Penjelasan langkah demi langkah dengan teks ringkas.",
    aspectRatio: "9:16",
    captionStyle: cap({ size: 58, highlightColor: "#38BDF8", position: "middle" }),
    sceneStructure: ["Hook", "Masalah", "Penjelasan", "Contoh", "Ringkasan & CTA"],
    format: "script",
  },
  {
    id: "product-promo",
    name: "Promosi Produk",
    description: "Masalah, solusi, manfaat, dan ajakan membeli.",
    aspectRatio: "9:16",
    captionStyle: cap({ uppercase: true, size: 60, highlightColor: "#34D399" }),
    sceneStructure: ["Hook", "Masalah", "Produk", "Manfaat", "Bukti", "CTA"],
    format: "script",
  },
  {
    id: "top-five",
    name: "Top 5 Ranking",
    description: "Hitung mundur lima item dengan satu scene per item.",
    aspectRatio: "9:16",
    captionStyle: cap({ uppercase: true, highlightColor: "#F97316" }),
    sceneStructure: ["Intro", "#5", "#4", "#3", "#2", "#1", "Penutup"],
    format: "listicle",
  },
  {
    id: "commentary",
    name: "Komentar & Reaksi",
    description: "Video utama dengan narasi komentar dan layout split.",
    aspectRatio: "9:16",
    captionStyle: cap({ position: "middle", size: 56 }),
    sceneStructure: ["Konteks", "Klip", "Reaksi", "Opini", "Penutup"],
    format: "script",
  },
  {
    id: "podcast-highlights",
    name: "Highlight Podcast",
    description: "Potongan terbaik dari podcast panjang dengan caption besar.",
    aspectRatio: "9:16",
    captionStyle: cap({ size: 70, maxWordsPerCaption: 3 }),
    sceneStructure: ["Hook", "Klip"],
    format: "clip",
  },
  {
    id: "gaming-highlights",
    name: "Highlight Gaming",
    description: "Momen seru dari rekaman gameplay.",
    aspectRatio: "9:16",
    captionStyle: cap({ uppercase: true, size: 66, highlightColor: "#A78BFA" }),
    sceneStructure: ["Momen", "Reaksi"],
    format: "clip",
  },
  {
    id: "news-explainer",
    name: "Penjelasan Berita",
    description: "Format berita singkat: apa, kenapa, dampaknya.",
    aspectRatio: "9:16",
    captionStyle: cap({ background: true, karaoke: false, size: 54, position: "bottom" }),
    sceneStructure: ["Headline", "Apa yang terjadi", "Kenapa penting", "Dampak", "Sumber"],
    format: "script",
  },
];

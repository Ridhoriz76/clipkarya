import Link from "next/link";
import {
  ArrowRight,
  AudioLines,
  Captions,
  Check,
  Clapperboard,
  FileText,
  Image as ImageIcon,
  LayoutPanelTop,
  ListOrdered,
  Mic,
  Scissors,
  Sparkles,
  Upload,
  Wand2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EditorPreview } from "@/components/marketing/editor-preview";
import { getPlans } from "@/lib/plans";
import { formatPrice } from "@/lib/utils";
import { APP_NAME, FREE_MODE } from "@/lib/env";

const steps = [
  { icon: Upload, title: "Masukkan ide atau video", text: "Tulis topik, tempel naskah, atau unggah rekaman panjang Anda." },
  { icon: Wand2, title: "AI menyiapkan draf", text: "Transkripsi, deteksi klip, naskah per scene, voiceover, dan subtitle dibuat otomatis." },
  { icon: Scissors, title: "Sunting di editor", text: "Atur timeline, potong klip, ubah gaya caption, dan tambahkan musik." },
  { icon: Clapperboard, title: "Ekspor MP4", text: "Render H.264 siap unggah dalam 9:16, 16:9, atau 1:1." },
];

const features = [
  { icon: Scissors, title: "Auto-clip dari video panjang", text: "Temukan potongan terbaik dengan skor yang dapat dijelaskan: kekuatan hook, kelengkapan kalimat, tempo, dan durasi." },
  { icon: Captions, title: "Subtitle otomatis yang bisa diedit", text: "Caption per kata dengan sorotan karaoke, font, warna, latar, dan posisi yang dapat diatur." },
  { icon: Mic, title: "Voiceover AI", text: "Pilih suara dari pustaka penyedia yang Anda hubungkan, atur kecepatan, dan tempatkan per scene." },
  { icon: FileText, title: "Naskah ke video", text: "Hook, narasi, dan deskripsi visual per scene. Anda selalu bisa meninjau sebelum render." },
  { icon: LayoutPanelTop, title: "Editor multitrack", text: "Video, teks, narasi, musik, dan subtitle dalam satu timeline dengan undo/redo." },
  { icon: AudioLines, title: "Transkripsi & SRT/VTT", text: "Transkrip dengan penanda waktu, pencarian teks, dan unduhan subtitle." },
  { icon: ImageIcon, title: "Gambar & video AI", text: "Hasilkan visual untuk scene melalui penyedia yang terkonfigurasi." },
  { icon: ListOrdered, title: "Ranking & listicle", text: "Satu scene per item, dengan klaim yang perlu diverifikasi ditandai jelas." },
];

const platforms = ["TikTok", "Instagram Reels", "YouTube Shorts", "Facebook Reels"];

const useCases = [
  { title: "Kreator faceless", text: "Ubah ide cerita menjadi video naratif dengan voiceover dan caption." },
  { title: "Affiliate marketer", text: "Video ulasan produk singkat yang konsisten setiap hari." },
  { title: "Podcaster", text: "Potong episode panjang menjadi highlight vertikal." },
  { title: "Bisnis & UMKM", text: "Promosi produk dengan template yang menjaga identitas brand." },
  { title: "Agensi media sosial", text: "Produksi banyak klip untuk banyak klien dengan alur yang sama." },
  { title: "Edukator", text: "Penjelasan singkat dengan teks di layar yang mudah diikuti." },
];

const faqs = [
  { q: `Apa itu ${APP_NAME}?`, a: "Aplikasi web untuk membuat video pendek: dari ide, naskah, atau video panjang, hingga voiceover, subtitle, dan ekspor MP4." },
  { q: "Apakah skor klip menjamin video viral?", a: "Tidak. Skor adalah heuristik yang transparan (hook, kelengkapan, tempo, kepadatan ucapan, durasi) untuk membantu Anda memilih lebih cepat, bukan prediksi." },
  { q: "Video siapa yang boleh saya unggah?", a: "Hanya rekaman milik Anda atau materi yang Anda punya izin untuk gunakan. Kami tidak menyediakan pengunduh video pihak ketiga." },
  { q: "Bagaimana data saya disimpan?", a: "File disimpan di penyimpanan privat yang hanya bisa diakses akun Anda melalui URL bertanda tangan yang kedaluwarsa. Anda dapat menghapus proyek dan media kapan saja." },
  FREE_MODE
    ? { q: "Apakah benar gratis?", a: "Ya. Semua fitur gratis tanpa paket berbayar. Agar adil untuk semua pengguna, ada batas pemakaian harian per fitur." }
    : { q: "Apa itu kredit?", a: "Kredit dipakai untuk pekerjaan AI dan render. Biaya ditampilkan sebelum memulai, dan kredit dikembalikan otomatis jika job gagal." },
  { q: "Format apa yang didukung untuk ekspor?", a: "MP4 (H.264 + AAC) dalam 9:16, 16:9, atau 1:1 pada 720p atau 1080p, dengan subtitle tertanam dan file SRT terpisah opsional." },
];

// Pricing comes from the database (editable in admin); refresh the static page every 5 minutes.
export const revalidate = 300;

export default async function LandingPage() {
  const plans = FREE_MODE ? [] : await getPlans();
  return (
    <>
      <section className="relative overflow-hidden">
        <div className="bg-grid pointer-events-none absolute inset-0 [mask-image:radial-gradient(ellipse_at_top,black_30%,transparent_70%)]" />
        <div className="relative mx-auto max-w-6xl px-4 pb-16 pt-16 sm:px-6 sm:pt-24">
          <div className="mx-auto max-w-3xl text-center">
            <Badge variant="outline" className="mb-5 gap-1.5 px-3 py-1">
              <Sparkles className="size-3.5 text-primary" /> Untuk TikTok, Reels, dan Shorts
            </Badge>
            <h1 className="text-balance text-4xl font-semibold tracking-tight sm:text-5xl">Ubah Ide Menjadi Video Pendek dengan AI.</h1>
            <p className="mx-auto mt-5 max-w-2xl text-pretty text-base text-muted-foreground sm:text-lg">
              Buat video untuk TikTok, Reels, dan YouTube Shorts dengan bantuan AI. Mulai dari ide, naskah, voiceover, hingga subtitle dan ekspor video dalam satu workflow.
            </p>
            <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Button asChild size="lg">
                <Link href="/signup">
                  Mulai gratis <ArrowRight />
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline">
                <Link href="#cara-kerja">Lihat cara kerja</Link>
              </Button>
            </div>
          </div>
          <div className="mt-14">
            <EditorPreview />
          </div>
        </div>
      </section>

      <section className="border-y border-border/60 bg-card/40">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-center gap-x-10 gap-y-3 px-4 py-6 text-sm text-muted-foreground sm:px-6">
          <span>Format siap untuk:</span>
          {platforms.map((p) => (
            <span key={p} className="font-medium text-foreground/80">{p}</span>
          ))}
        </div>
      </section>

      <section id="cara-kerja" className="mx-auto max-w-6xl scroll-mt-20 px-4 py-20 sm:px-6">
        <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">Cara kerjanya</h2>
        <p className="mt-2 max-w-2xl text-muted-foreground">Empat langkah dari ide ke file MP4.</p>
        <ol className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {steps.map((s, i) => (
            <li key={s.title} className="rounded-xl border border-border bg-card p-5">
              <div className="flex items-center gap-3">
                <span className="flex size-8 items-center justify-center rounded-lg bg-primary/15 text-sm font-semibold text-primary">{i + 1}</span>
                <s.icon className="size-4 text-muted-foreground" />
              </div>
              <p className="mt-4 font-medium">{s.title}</p>
              <p className="mt-1 text-sm text-muted-foreground">{s.text}</p>
            </li>
          ))}
        </ol>
      </section>

      <section id="fitur" className="mx-auto max-w-6xl scroll-mt-20 px-4 pb-20 sm:px-6">
        <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">Semua yang dibutuhkan untuk video pendek</h2>
        <div className="mt-10 grid gap-px overflow-hidden rounded-xl border border-border bg-border sm:grid-cols-2 lg:grid-cols-4">
          {features.map((f) => (
            <div key={f.title} className="bg-card p-5">
              <f.icon className="size-5 text-primary" />
              <p className="mt-3 font-medium">{f.title}</p>
              <p className="mt-1 text-sm text-muted-foreground">{f.text}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 pb-20 sm:px-6">
        <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">Dipakai untuk</h2>
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {useCases.map((u) => (
            <div key={u.title} className="rounded-xl border border-border p-5">
              <p className="font-medium">{u.title}</p>
              <p className="mt-1 text-sm text-muted-foreground">{u.text}</p>
            </div>
          ))}
        </div>
      </section>

      {!FREE_MODE && (
      <section id="harga" className="scroll-mt-20 border-y border-border/60 bg-card/40">
        <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
          <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">Harga sederhana</h2>
          <p className="mt-2 text-muted-foreground">Mulai gratis. Upgrade saat Anda butuh lebih banyak kredit dan 1080p.</p>
          <div className="mt-10 grid gap-4 md:grid-cols-3">
            {plans.map((p, i) => (
              <div key={p.id} className={`flex flex-col rounded-xl border bg-card p-6 ${i === 1 ? "border-primary/60 ring-1 ring-primary/30" : "border-border"}`}>
                <div className="flex items-center justify-between">
                  <p className="font-medium">{p.name}</p>
                  {i === 1 && <Badge>Populer</Badge>}
                </div>
                <p className="mt-1 text-sm text-muted-foreground">{p.description}</p>
                <p className="mt-5 text-3xl font-semibold tracking-tight">
                  {formatPrice(p.price_cents, p.currency)}
                  {p.price_cents > 0 && <span className="text-sm font-normal text-muted-foreground">/bulan</span>}
                </p>
                <ul className="mt-5 flex-1 space-y-2 text-sm">
                  {p.features.map((f) => (
                    <li key={f} className="flex gap-2">
                      <Check className="mt-0.5 size-4 shrink-0 text-primary" /> {f}
                    </li>
                  ))}
                </ul>
                <Button asChild className="mt-6" variant={i === 1 ? "default" : "outline"}>
                  <Link href="/signup">{p.price_cents === 0 ? "Mulai gratis" : "Pilih paket"}</Link>
                </Button>
              </div>
            ))}
          </div>
          <p className="mt-4 text-xs text-muted-foreground">Pembayaran online belum aktif; paket berbayar diaktifkan oleh admin selama masa MVP.</p>
        </div>
      </section>
      )}

      <section id="faq" className="mx-auto max-w-3xl scroll-mt-20 px-4 py-20 sm:px-6">
        <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">Pertanyaan umum</h2>
        <div className="mt-8 divide-y divide-border rounded-xl border border-border">
          {faqs.map((f) => (
            <details key={f.q} className="group p-5">
              <summary className="cursor-pointer list-none font-medium marker:hidden">
                <span className="flex items-center justify-between gap-4">
                  {f.q}
                  <span className="text-muted-foreground transition-transform group-open:rotate-45">+</span>
                </span>
              </summary>
              <p className="mt-3 text-sm text-muted-foreground">{f.a}</p>
            </details>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 pb-24 sm:px-6">
        <div className="rounded-2xl border border-border bg-card p-10 text-center">
          <h2 className="text-2xl font-semibold tracking-tight">Siap membuat video pertama Anda?</h2>
          <p className="mt-2 text-muted-foreground">{FREE_MODE ? "Gratis, tanpa kartu kredit. Daftar dan langsung buat video." : "Daftar gratis dan dapatkan kredit awal untuk mencoba semua alur kerja."}</p>
          <Button asChild size="lg" className="mt-6">
            <Link href="/signup">
              Buat akun <ArrowRight />
            </Link>
          </Button>
        </div>
      </section>
    </>
  );
}

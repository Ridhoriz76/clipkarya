import Link from "next/link";
import { PageHeader } from "@/components/ui/misc";
import { FREE_MODE } from "@/lib/env";

const sections: { title: string; items: { q: string; a: React.ReactNode }[] }[] = [
  {
    title: "Memulai",
    items: [
      { q: "Bagaimana alur dasar membuat video?", a: <>Pilih mode di <Link className="underline" href="/app/create">Buat Video</Link>, unggah media atau tulis topik, sunting di editor, lalu klik Ekspor. File MP4 hanya tersedia setelah render benar-benar selesai.</> },
      { q: "Format apa yang didukung?", a: "Unggah MP4, MOV, WebM, MKV, MP3, WAV, M4A, PNG, JPG, dan WebP hingga 2 GB (durasi maksimum 3 jam). Ekspor menghasilkan MP4 H.264 + AAC dalam rasio 9:16, 16:9, atau 1:1, resolusi 720p atau 1080p." },
      { q: "Kenapa ada fitur bertanda \"Perlu API key\"?", a: "Fitur AI hanya berjalan bila penyedianya dikonfigurasi oleh admin. Kami tidak pernah menampilkan hasil AI palsu; bila penyedia belum siap, fitur ditandai dengan jelas." },
      { q: "Apa arti label DEMO?", a: "Mode demo hanya membuat hasil placeholder yang jelas ditandai (misalnya nada uji, bukan suara asli) untuk menguji alur kerja. Hasil demo bukan keluaran AI." },
    ],
  },
  {
    title: "Auto-clip & skor",
    items: [
      { q: "Bagaimana skor klip dihitung?", a: "Skor adalah heuristik yang dapat dijelaskan: kekuatan hook di awal, kelengkapan kalimat, tempo bicara, kepadatan kata, kecocokan durasi, dan (jika penyedia teks aktif) relevansi terhadap fokus Anda. Skor membantu memilah, bukan prediksi viral." },
      { q: "Bisakah saya memakai link YouTube/TikTok?", a: "Tidak. Kami tidak mengunduh video pihak ketiga. Unggah file yang Anda miliki atau punya izin untuk digunakan." },
    ],
  },
  {
    title: FREE_MODE ? "Pemakaian & ekspor" : "Kredit & ekspor",
    items: [
      FREE_MODE
        ? { q: "Apakah ada batas pemakaian?", a: <>Semua fitur gratis, dengan batas harian per fitur agar adil untuk semua pengguna. Sisa kuota Anda ada di <Link className="underline" href="/app/usage">Penggunaan</Link>.</> }
        : { q: "Kapan kredit dipotong?", a: <>Kredit dicadangkan saat pekerjaan dimulai dan dikembalikan otomatis jika pekerjaan gagal atau dibatalkan. Rincian ada di <Link className="underline" href="/app/usage">Penggunaan & Kredit</Link>.</> },
      { q: "Ekspor saya gagal. Apa yang harus dilakukan?", a: "Buka riwayat ekspor di proyek untuk melihat pesan kesalahan, lalu coba lagi. Penyebab umum: media sumber dihapus, atau timeline kosong." + (FREE_MODE ? "" : " Kredit untuk ekspor yang gagal dikembalikan.") },
      { q: "Apakah ranking/listicle dibuat berdasarkan data nyata?", a: "AI tidak mengarang statistik. Klaim yang perlu bukti ditandai \"perlu verifikasi\" di setiap scene; tambahkan sumber Anda sendiri sebelum mempublikasikan." },
    ],
  },
  {
    title: "Data & privasi",
    items: [
      { q: "Siapa yang bisa melihat file saya?", a: "File disimpan di penyimpanan privat dan hanya dapat diakses oleh akun Anda melalui tautan bertanda tangan yang kedaluwarsa. Admin tidak memiliki tampilan untuk file Anda di aplikasi." },
      { q: "Ke mana data dikirim untuk pemrosesan AI?", a: "Hanya bagian yang diperlukan (misalnya audio untuk transkripsi atau teks untuk voiceover) yang dikirim ke penyedia AI yang dikonfigurasi, sesuai kebijakan masing-masing penyedia." },
      { q: "Bagaimana menghapus data?", a: <>Hapus proyek atau media dari aplikasi; file di penyimpanan ikut dihapus. Untuk menghapus akun, <Link className="underline" href="/contact">hubungi kami</Link>.</> },
    ],
  },
];

export default function HelpPage() {
  return (
    <div className="max-w-3xl">
      <PageHeader title="Pusat Bantuan" description="Jawaban singkat untuk pertanyaan umum." />
      <div className="space-y-8">
        {sections.map((s) => (
          <section key={s.title}>
            <h2 className="mb-3 font-semibold">{s.title}</h2>
            <div className="divide-y divide-border rounded-xl border border-border bg-card">
              {s.items.map((it) => (
                <details key={it.q} className="group p-4">
                  <summary className="cursor-pointer list-none font-medium marker:hidden">
                    <span className="mr-2 inline-block text-muted-foreground transition-transform group-open:rotate-90">›</span>
                    {it.q}
                  </summary>
                  <div className="mt-2 pl-4 text-sm text-muted-foreground">{it.a}</div>
                </details>
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}

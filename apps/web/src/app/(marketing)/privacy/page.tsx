import type { Metadata } from "next";
import { APP_NAME } from "@/lib/env";

export const metadata: Metadata = { title: "Kebijakan Privasi" };

export default function PrivacyPage() {
  return (
    <article className="mx-auto max-w-3xl space-y-4 px-4 py-16 sm:px-6">
      <h1 className="text-3xl font-semibold tracking-tight">Kebijakan Privasi</h1>
      <p className="text-sm text-muted-foreground">Ringkasan cara {APP_NAME} menyimpan, memproses, dan menghapus data Anda.</p>
      <h2 className="pt-4 text-lg font-semibold">Data yang kami simpan</h2>
      <ul className="list-disc space-y-1 pl-5 text-muted-foreground">
        <li>Akun: email, nama, preferensi bahasa.</li>
        <li>Media: file yang Anda unggah, hasil AI (audio, gambar, video), dan hasil ekspor, di bucket penyimpanan privat.</li>
        <li>Proyek: timeline, transkrip, subtitle, dan saran klip.</li>
        <li>Penggunaan: riwayat job dan log penggunaan penyedia AI (tanpa isi file).</li>
      </ul>
      <h2 className="pt-4 text-lg font-semibold">Pemrosesan</h2>
      <p className="text-muted-foreground">
        Media diproses oleh worker kami menggunakan FFmpeg. Untuk fitur AI, potongan data yang diperlukan (misalnya audio untuk transkripsi atau teks untuk voiceover) dikirim ke penyedia yang dikonfigurasi (seperti OpenAI, Anthropic, ElevenLabs, atau fal.ai) sesuai kebijakan mereka.
      </p>
      <h2 className="pt-4 text-lg font-semibold">Akses</h2>
      <p className="text-muted-foreground">File hanya dapat diakses oleh pemilik akun melalui URL bertanda tangan yang kedaluwarsa. Basis data dilindungi Row Level Security.</p>
      <h2 className="pt-4 text-lg font-semibold">Penghapusan</h2>
      <p className="text-muted-foreground">
        Menghapus proyek akan menghapus timeline, transkrip, klip, dan file media terkait dari penyimpanan. File sementara di worker dihapus setelah job selesai, dan sisa yang tertinggal dibersihkan otomatis dalam 6 jam. Unggahan yang tidak selesai dihapus setelah 24 jam.
      </p>
    </article>
  );
}

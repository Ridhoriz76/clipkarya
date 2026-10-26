import type { Metadata } from "next";
import { APP_NAME, FREE_MODE } from "@/lib/env";

export const metadata: Metadata = { title: "Syarat Layanan" };

export default function TermsPage() {
  return (
    <article className="prose-sm mx-auto max-w-3xl space-y-4 px-4 py-16 sm:px-6">
      <h1 className="text-3xl font-semibold tracking-tight">Syarat Layanan</h1>
      <p className="text-sm text-muted-foreground">Templat awal — tinjau bersama penasihat hukum sebelum peluncuran publik.</p>
      <h2 className="pt-4 text-lg font-semibold">1. Penggunaan layanan</h2>
      <p className="text-muted-foreground">{APP_NAME} menyediakan alat untuk membuat dan menyunting video pendek. Anda bertanggung jawab atas konten yang Anda unggah dan hasilkan.</p>
      <h2 className="pt-4 text-lg font-semibold">2. Hak atas konten</h2>
      <p className="text-muted-foreground">Unggah hanya materi milik Anda atau yang Anda miliki izinnya. Dilarang mengunggah konten yang melanggar hak cipta, privasi, atau hukum yang berlaku. Kloning suara hanya boleh dilakukan dengan persetujuan pemilik suara dan sesuai ketentuan penyedia.</p>
      <h2 className="pt-4 text-lg font-semibold">3. Konten buatan AI</h2>
      <p className="text-muted-foreground">Hasil AI dapat mengandung kesalahan. Tinjau naskah, klaim faktual, dan peringkat sebelum dipublikasikan. Skor klip adalah heuristik, bukan jaminan performa.</p>
      <h2 className="pt-4 text-lg font-semibold">4. {FREE_MODE ? "Layanan gratis dan batas pemakaian" : "Kredit dan paket"}</h2>
      <p className="text-muted-foreground">
        {FREE_MODE
          ? "Layanan ini gratis. Untuk menjaga ketersediaan bagi semua pengguna, berlaku batas pemakaian harian per fitur yang dapat berubah sewaktu-waktu."
          : "Kredit digunakan untuk pemrosesan AI dan render. Kredit untuk job yang gagal dikembalikan otomatis. Kredit bulanan tidak dapat diuangkan."}
      </p>
      <h2 className="pt-4 text-lg font-semibold">5. Penghentian</h2>
      <p className="text-muted-foreground">Kami dapat menangguhkan akun yang melanggar ketentuan ini. Anda dapat menghapus akun dan data Anda kapan saja.</p>
    </article>
  );
}

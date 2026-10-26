import { capabilityAvailability } from "@clipkarya/core/providers";
import { Notice, PageHeader } from "@/components/ui/misc";
import { ImageTool } from "./tool";

export const metadata = { title: "Gambar AI" };

export default function ImagePage() {
  const cap = capabilityAvailability().image;
  return (
    <div className="space-y-6">
      <PageHeader title="Gambar AI" description="Hasilkan visual untuk scene dan thumbnail. Semua hasil tersimpan di pustaka media." />
      {!cap.available && <Notice variant="warning" title="Belum dikonfigurasi">Atur OPENAI_API_KEY (gpt-image-1) atau FAL_KEY (FLUX) untuk mengaktifkan pembuatan gambar. Tidak ada gambar palsu yang dibuat tanpa penyedia.</Notice>}
      <ImageTool disabled={!cap.available} />
    </div>
  );
}

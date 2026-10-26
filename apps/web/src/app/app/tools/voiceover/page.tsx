import { capabilityAvailability } from "@clipkarya/core/providers";
import { Notice, PageHeader } from "@/components/ui/misc";
import { VoiceoverTool } from "./tool";

export const metadata = { title: "Voiceover AI" };

export default function VoiceoverPage() {
  const cap = capabilityAvailability().speech;
  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <PageHeader title="Voiceover AI" description="Ubah teks menjadi narasi. Daftar suara diambil langsung dari penyedia yang terkonfigurasi." />
      {!cap.available && <Notice variant="warning" title="Belum dikonfigurasi">Atur ELEVENLABS_API_KEY atau OPENAI_API_KEY untuk mengaktifkan voiceover.</Notice>}
      <Notice variant="info">Kloning suara kustom memerlukan persetujuan pemilik suara dan mengikuti ketentuan penyedia. Fitur kloning belum diaktifkan di aplikasi ini.</Notice>
      <VoiceoverTool />
    </div>
  );
}

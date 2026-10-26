import { capabilityAvailability } from "@clipkarya/core/providers";
import { Notice, PageHeader } from "@/components/ui/misc";
import { TranscriberForm } from "./form";

export const metadata = { title: "Transkripsi Video" };

export default function TranscriberPage() {
  const cap = capabilityAvailability().transcription;
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="Transkripsi Video" description="Unggah video atau audio untuk mendapatkan transkrip dengan penanda waktu, SRT, dan VTT." />
      {!cap.available && <div className="mb-4"><Notice variant="warning" title="Belum dikonfigurasi">Perlu OPENAI_API_KEY (Whisper, penanda waktu per kata) atau ELEVENLABS_API_KEY (Scribe, dengan label pembicara).</Notice></div>}
      {cap.demoOnly && <div className="mb-4"><Notice variant="warning" title="Mode DEMO">Hasil berupa teks placeholder berlabel [DEMO].</Notice></div>}
      <TranscriberForm />
    </div>
  );
}

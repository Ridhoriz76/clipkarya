import { capabilityAvailability } from "@clipkarya/core/providers";
import { Notice, PageHeader } from "@/components/ui/misc";
import { AutoClipForm } from "./form";

export default function AutoClipPage() {
  const cap = capabilityAvailability().transcription;
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="Auto-clip / AI Shorts" description="Unggah video panjang. Kami mentranskripsi, menilai segmen, dan menyarankan klip pendek yang bisa Anda sunting." />
      {!cap.available && (
        <div className="mb-4">
          <Notice variant="warning" title="Transkripsi belum dikonfigurasi">
            Admin perlu mengatur OPENAI_API_KEY atau ELEVENLABS_API_KEY (atau DEMO_MODE=true untuk pengujian lokal). Anda tetap bisa mengunggah video.
          </Notice>
        </div>
      )}
      {cap.demoOnly && (
        <div className="mb-4">
          <Notice variant="warning" title="Mode DEMO aktif">
            Transkripsi akan berisi teks placeholder berlabel [DEMO], bukan hasil AI dari audio Anda.
          </Notice>
        </div>
      )}
      <AutoClipForm />
    </div>
  );
}

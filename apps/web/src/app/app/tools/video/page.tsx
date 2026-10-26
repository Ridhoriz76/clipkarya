import { capabilityAvailability, providerConfig } from "@clipkarya/core/providers";
import { Notice, PageHeader } from "@/components/ui/misc";
import { VideoTool } from "./tool";

export const metadata = { title: "Video AI" };

export default function VideoGenPage() {
  const cap = capabilityAvailability().video;
  const model = providerConfig().fal?.videoModel;
  return (
    <div className="space-y-6">
      <PageHeader title="Video AI" description={model ? `Model: ${model} via fal.ai` : "Hasilkan klip video dari prompt teks."} />
      {!cap.available && <Notice variant="warning" title="Belum dikonfigurasi">Atur FAL_KEY (dan opsional FAL_VIDEO_MODEL). Tanpa penyedia, tidak ada video yang dihasilkan.</Notice>}
      <VideoTool disabled={!cap.available} />
    </div>
  );
}

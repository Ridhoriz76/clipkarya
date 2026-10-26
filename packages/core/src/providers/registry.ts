import { anthropicText } from "./anthropic";
import { demoSpeech, demoTranscription } from "./demo";
import { elevenLabsSpeech, elevenLabsTranscription } from "./elevenlabs";
import { falImage, falVideo } from "./fal";
import { openAIImage, openAISpeech, openAIText, openAITranscription } from "./openai";
import type {
  Capability,
  ImageProvider,
  ProviderStatus,
  SpeechProvider,
  TextProvider,
  TranscriptionProvider,
  VideoProvider,
} from "./types";
import { UserFacingError } from "../jobs";

type Env = Record<string, string | undefined>;

export function providerConfig(env: Env = process.env) {
  return {
    demoMode: env.DEMO_MODE === "true",
    openai: env.OPENAI_API_KEY
      ? {
          apiKey: env.OPENAI_API_KEY,
          textModel: env.OPENAI_TEXT_MODEL || "gpt-4.1-mini",
          transcribeModel: env.OPENAI_TRANSCRIBE_MODEL || "whisper-1",
          ttsModel: env.OPENAI_TTS_MODEL || "gpt-4o-mini-tts",
          imageModel: env.OPENAI_IMAGE_MODEL || "gpt-image-1",
        }
      : null,
    anthropic: env.ANTHROPIC_API_KEY ? { apiKey: env.ANTHROPIC_API_KEY, model: env.ANTHROPIC_MODEL || "claude-sonnet-5-5" } : null,
    elevenlabs: env.ELEVENLABS_API_KEY
      ? {
          apiKey: env.ELEVENLABS_API_KEY,
          ttsModel: env.ELEVENLABS_TTS_MODEL || "eleven_multilingual_v2",
          sttModel: env.ELEVENLABS_STT_MODEL || "scribe_v2",
        }
      : null,
    fal: env.FAL_KEY
      ? {
          apiKey: env.FAL_KEY,
          videoModel: env.FAL_VIDEO_MODEL || "fal-ai/kling-video/v2.1/standard/text-to-video",
          imageModel: env.FAL_IMAGE_MODEL || "fal-ai/flux/schnell",
        }
      : null,
    prefer: {
      text: env.TEXT_PROVIDER, // "openai" | "anthropic"
      transcription: env.TRANSCRIPTION_PROVIDER, // "openai" | "elevenlabs"
      speech: env.SPEECH_PROVIDER, // "openai" | "elevenlabs"
      image: env.IMAGE_PROVIDER, // "openai" | "fal"
    },
  };
}

function notConfigured(capability: Capability, envs: string[]): never {
  throw new UserFacingError(
    `Fitur ${capability} belum dikonfigurasi. Admin perlu mengatur ${envs.join(" atau ")}.`,
    "provider_not_configured",
  );
}

export function getTextProvider(env: Env = process.env): TextProvider {
  const c = providerConfig(env);
  if (c.prefer.text === "anthropic" && c.anthropic) return anthropicText(c.anthropic);
  if (c.prefer.text === "openai" && c.openai) return openAIText(c.openai);
  if (c.anthropic) return anthropicText(c.anthropic);
  if (c.openai) return openAIText(c.openai);
  return notConfigured("text", ["ANTHROPIC_API_KEY", "OPENAI_API_KEY"]);
}

export function getTranscriptionProvider(env: Env = process.env): TranscriptionProvider {
  const c = providerConfig(env);
  if (c.prefer.transcription === "elevenlabs" && c.elevenlabs) return elevenLabsTranscription(c.elevenlabs);
  if (c.prefer.transcription === "openai" && c.openai) return openAITranscription(c.openai);
  if (c.openai) return openAITranscription(c.openai);
  if (c.elevenlabs) return elevenLabsTranscription(c.elevenlabs);
  if (c.demoMode) return demoTranscription();
  return notConfigured("transcription", ["OPENAI_API_KEY", "ELEVENLABS_API_KEY"]);
}

export function getSpeechProviders(env: Env = process.env): SpeechProvider[] {
  const c = providerConfig(env);
  const list: SpeechProvider[] = [];
  if (c.elevenlabs) list.push(elevenLabsSpeech(c.elevenlabs));
  if (c.openai) list.push(openAISpeech(c.openai));
  if (c.prefer.speech === "openai") list.reverse();
  if (!list.length && c.demoMode) list.push(demoSpeech());
  return list;
}

export function getSpeechProvider(id: string | undefined, env: Env = process.env): SpeechProvider {
  const list = getSpeechProviders(env);
  const p = id ? list.find((x) => x.id === id) : list[0];
  if (!p) return notConfigured("speech", ["ELEVENLABS_API_KEY", "OPENAI_API_KEY"]);
  return p;
}

export function getImageProvider(env: Env = process.env): ImageProvider {
  const c = providerConfig(env);
  if (c.prefer.image === "fal" && c.fal) return falImage(c.fal);
  if (c.openai) return openAIImage(c.openai);
  if (c.fal) return falImage(c.fal);
  return notConfigured("image", ["OPENAI_API_KEY", "FAL_KEY"]);
}

export function getVideoProvider(env: Env = process.env): VideoProvider {
  const c = providerConfig(env);
  if (c.fal) return falVideo(c.fal);
  return notConfigured("video", ["FAL_KEY"]);
}

/** Status for the admin page and for gating UI features. Never includes secret values. */
export function providerStatuses(env: Env = process.env): ProviderStatus[] {
  const c = providerConfig(env);
  const s: ProviderStatus[] = [
    { id: "anthropic", label: "Anthropic (teks/naskah)", capability: "text", configured: !!c.anthropic, isDemo: false, missingEnv: c.anthropic ? [] : ["ANTHROPIC_API_KEY"], model: c.anthropic?.model },
    { id: "openai", label: "OpenAI (teks/naskah)", capability: "text", configured: !!c.openai, isDemo: false, missingEnv: c.openai ? [] : ["OPENAI_API_KEY"], model: c.openai?.textModel },
    { id: "openai", label: "OpenAI (transkripsi)", capability: "transcription", configured: !!c.openai, isDemo: false, missingEnv: c.openai ? [] : ["OPENAI_API_KEY"], model: c.openai?.transcribeModel },
    { id: "elevenlabs", label: "ElevenLabs (transkripsi)", capability: "transcription", configured: !!c.elevenlabs, isDemo: false, missingEnv: c.elevenlabs ? [] : ["ELEVENLABS_API_KEY"], model: c.elevenlabs?.sttModel },
    { id: "elevenlabs", label: "ElevenLabs (voiceover)", capability: "speech", configured: !!c.elevenlabs, isDemo: false, missingEnv: c.elevenlabs ? [] : ["ELEVENLABS_API_KEY"], model: c.elevenlabs?.ttsModel },
    { id: "openai", label: "OpenAI (voiceover)", capability: "speech", configured: !!c.openai, isDemo: false, missingEnv: c.openai ? [] : ["OPENAI_API_KEY"], model: c.openai?.ttsModel },
    { id: "openai", label: "OpenAI (gambar)", capability: "image", configured: !!c.openai, isDemo: false, missingEnv: c.openai ? [] : ["OPENAI_API_KEY"], model: c.openai?.imageModel },
    { id: "fal", label: "fal.ai (gambar)", capability: "image", configured: !!c.fal, isDemo: false, missingEnv: c.fal ? [] : ["FAL_KEY"], model: c.fal?.imageModel },
    { id: "fal", label: "fal.ai (video AI)", capability: "video", configured: !!c.fal, isDemo: false, missingEnv: c.fal ? [] : ["FAL_KEY"], model: c.fal?.videoModel },
  ];
  if (c.demoMode) {
    s.push(
      { id: "demo", label: "DEMO transkripsi (placeholder)", capability: "transcription", configured: true, isDemo: true, missingEnv: [] },
      { id: "demo", label: "DEMO voiceover (nada, bukan suara)", capability: "speech", configured: true, isDemo: true, missingEnv: [] },
    );
  }
  return s;
}

export function capabilityAvailability(env: Env = process.env): Record<Capability, { available: boolean; demoOnly: boolean }> {
  const st = providerStatuses(env);
  const caps: Capability[] = ["text", "transcription", "speech", "image", "video"];
  return Object.fromEntries(
    caps.map((cap) => {
      const real = st.some((x) => x.capability === cap && x.configured && !x.isDemo);
      const demo = st.some((x) => x.capability === cap && x.configured && x.isDemo);
      return [cap, { available: real || demo, demoOnly: !real && demo }];
    }),
  ) as Record<Capability, { available: boolean; demoOnly: boolean }>;
}

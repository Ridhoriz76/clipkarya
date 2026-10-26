import { spawn } from "node:child_process";
import { env } from "./env";

export type ProbeResult = {
  durationSec: number | null;
  width: number | null;
  height: number | null;
  hasVideo: boolean;
  hasAudio: boolean;
  videoCodec: string | null;
  audioCodec: string | null;
  fps: number | null;
  rotation: number;
  formatName: string | null;
  bitRate: number | null;
};

export function run(
  cmd: string,
  args: string[],
  opts: { onStdout?: (chunk: string) => void; timeoutMs?: number; signal?: AbortSignal } = {},
): Promise<{ stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    const timer = opts.timeoutMs ? setTimeout(() => child.kill("SIGKILL"), opts.timeoutMs) : null;
    const onAbort = () => child.kill("SIGKILL");
    opts.signal?.addEventListener("abort", onAbort);
    child.stdout.on("data", (d: Buffer) => {
      const s = d.toString();
      if (stdout.length < 2_000_000) stdout += s;
      opts.onStdout?.(s);
    });
    child.stderr.on("data", (d: Buffer) => {
      stderr += d.toString();
      if (stderr.length > 200_000) stderr = stderr.slice(-100_000);
    });
    child.on("error", reject);
    child.on("close", (code, sig) => {
      if (timer) clearTimeout(timer);
      opts.signal?.removeEventListener("abort", onAbort);
      if (code === 0) resolve({ stdout, stderr });
      else reject(new Error(`${cmd} exited ${code ?? sig}: ${stderr.slice(-2000)}`));
    });
  });
}

export async function probe(file: string): Promise<ProbeResult> {
  const { stdout } = await run(env().FFPROBE_PATH, ["-v", "error", "-print_format", "json", "-show_format", "-show_streams", file], {
    timeoutMs: 60_000,
  });
  return parseProbe(stdout);
}

type FFProbeJson = {
  format?: { duration?: string; format_name?: string; bit_rate?: string };
  streams?: {
    codec_type?: string;
    codec_name?: string;
    width?: number;
    height?: number;
    duration?: string;
    avg_frame_rate?: string;
    tags?: { rotate?: string };
    side_data_list?: { rotation?: number }[];
  }[];
};

export function parseProbe(json: string): ProbeResult {
  const p = JSON.parse(json) as FFProbeJson;
  const v = p.streams?.find((s) => s.codec_type === "video");
  const a = p.streams?.find((s) => s.codec_type === "audio");
  const rotation = Math.abs(Number(v?.tags?.rotate ?? v?.side_data_list?.find((d) => d.rotation !== undefined)?.rotation ?? 0)) % 360;
  let width = v?.width ?? null;
  let height = v?.height ?? null;
  if (rotation === 90 || rotation === 270) [width, height] = [height, width];
  const fr = v?.avg_frame_rate?.split("/").map(Number);
  const fps = fr && fr.length === 2 && fr[1] ? fr[0]! / fr[1] : null;
  const dur = Number(p.format?.duration ?? v?.duration ?? a?.duration);
  return {
    durationSec: Number.isFinite(dur) ? dur : null,
    width,
    height,
    hasVideo: !!v && v.codec_name !== "mjpeg" && v.codec_name !== "png",
    hasAudio: !!a,
    videoCodec: v?.codec_name ?? null,
    audioCodec: a?.codec_name ?? null,
    fps: fps && Number.isFinite(fps) ? Math.round(fps * 100) / 100 : null,
    rotation,
    formatName: p.format?.format_name ?? null,
    bitRate: p.format?.bit_rate ? Number(p.format.bit_rate) : null,
  };
}

/** Mono speech-optimized audio for STT: 16 kHz, low bitrate MP3 keeps ~1.8 h under 25 MB. */
export async function extractSpeechAudio(input: string, output: string, kbps = 32): Promise<void> {
  await run(env().FFMPEG_PATH, ["-hide_banner", "-y", "-nostdin", "-i", input, "-vn", "-ac", "1", "-ar", "16000", "-c:a", "libmp3lame", "-b:a", `${kbps}k`, output], {
    timeoutMs: 30 * 60_000,
  });
}

export async function thumbnail(input: string, output: string, atSec: number, width = 480): Promise<void> {
  await run(env().FFMPEG_PATH, ["-hide_banner", "-y", "-nostdin", "-ss", String(Math.max(0, atSec)), "-i", input, "-frames:v", "1", "-vf", `scale=${width}:-2`, "-q:v", "4", output], {
    timeoutMs: 60_000,
  });
}

export async function audioDuration(file: string): Promise<number | null> {
  return (await probe(file)).durationSec;
}

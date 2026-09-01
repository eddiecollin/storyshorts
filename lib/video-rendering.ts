"use client";

import type { CaptionCue, CaptionPreset, GameplaySettings, RenderProgress } from "@/types/storyshorts";

type RenderOptions = {
  videoFile: File;
  audioBlob: Blob | null;
  cues: CaptionCue[];
  captionPreset: CaptionPreset;
  duration: number;
  settings: GameplaySettings;
  onProgress: (progress: RenderProgress) => void;
};

const canvasWidth = 1080;
const canvasHeight = 1920;
const frameRate = 30;

export async function renderVerticalVideo(options: RenderOptions): Promise<Blob> {
  assertBrowserSupport();

  options.onProgress({ stage: "preparing", progress: 4, message: "Preparing media..." });
  const webmBlob = await recordCanvasComposition(options);

  options.onProgress({ stage: "transcoding", progress: 78, message: "Converting to MP4..." });
  return transcodeWebmToMp4(webmBlob, options.onProgress);
}

function assertBrowserSupport() {
  if (typeof window === "undefined") {
    throw new Error("Video rendering must run in the browser.");
  }
  if (!("MediaRecorder" in window)) {
    throw new Error("This browser does not support MediaRecorder. Try the latest Chrome or Edge.");
  }
  if (!HTMLCanvasElement.prototype.captureStream) {
    throw new Error("This browser cannot capture canvas video streams.");
  }
}

async function recordCanvasComposition({
  videoFile,
  audioBlob,
  cues,
  captionPreset,
  duration,
  settings,
  onProgress
}: RenderOptions): Promise<Blob> {
  const canvas = document.createElement("canvas");
  canvas.width = canvasWidth;
  canvas.height = canvasHeight;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("Could not create a video canvas.");
  }

  const videoUrl = URL.createObjectURL(videoFile);
  const audioUrl = audioBlob ? URL.createObjectURL(audioBlob) : null;
  const video = document.createElement("video");
  video.src = videoUrl;
  video.playsInline = true;
  video.muted = settings.muteOriginalAudio;
  video.volume = settings.gameplayVolume;

  const audio = audioUrl ? document.createElement("audio") : null;
  if (audio && audioUrl) {
    audio.src = audioUrl;
  }

  try {
    await waitForMetadata(video);
    if (audio) {
      await waitForMetadata(audio);
    }

    const trimStart = clamp(settings.trimStart, 0, Math.max(0, video.duration - 0.2));
    const trimEnd = settings.trimEnd > trimStart ? Math.min(settings.trimEnd, video.duration) : video.duration;
    const gameplayDuration = Math.max(1, trimEnd - trimStart);
    const targetDuration = settings.loopGameplay ? duration : Math.min(duration, gameplayDuration);

    const canvasStream = canvas.captureStream(frameRate);
    const stream = new MediaStream(canvasStream.getVideoTracks());
    const audioContext = new AudioContext();
    const destination = audioContext.createMediaStreamDestination();

    if (!settings.muteOriginalAudio) {
      const videoSource = audioContext.createMediaElementSource(video);
      const gameplayGain = audioContext.createGain();
      gameplayGain.gain.value = settings.gameplayVolume;
      videoSource.connect(gameplayGain).connect(destination);
    }

    if (audio) {
      const audioSource = audioContext.createMediaElementSource(audio);
      audioSource.connect(destination);
    }

    destination.stream.getAudioTracks().forEach((track) => stream.addTrack(track));

    const mimeType = chooseRecorderMimeType();
    const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
    const chunks: BlobPart[] = [];
    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        chunks.push(event.data);
      }
    };

    await seekVideo(video, trimStart);
    await audioContext.resume();

    const startedAt = performance.now();
    const stopped = new Promise<void>((resolve, reject) => {
      recorder.onerror = () => reject(new Error("Browser recording failed."));
      recorder.onstop = () => resolve();
    });

    recorder.start(250);
    void video.play();
    if (audio) {
      void audio.play();
    }

    onProgress({ stage: "recording", progress: 10, message: "Rendering frames..." });

    await new Promise<void>((resolve) => {
      const draw = () => {
        const elapsed = (performance.now() - startedAt) / 1000;
        const progress = Math.min(76, 10 + (elapsed / targetDuration) * 66);

        if (video.currentTime >= trimEnd - 0.05) {
          if (settings.loopGameplay) {
            void seekVideo(video, trimStart).then(() => void video.play());
          } else {
            video.pause();
          }
        }

        drawFrame(ctx, video, cues, elapsed, captionPreset, settings.cropZoom);
        onProgress({ stage: "recording", progress, message: "Rendering frames..." });

        if (elapsed >= targetDuration) {
          resolve();
          return;
        }

        requestAnimationFrame(draw);
      };
      requestAnimationFrame(draw);
    });

    video.pause();
    audio?.pause();
    recorder.stop();
    await stopped;
    await audioContext.close();

    if (chunks.length === 0) {
      throw new Error("The browser did not produce any video data.");
    }

    return new Blob(chunks, { type: "video/webm" });
  } finally {
    URL.revokeObjectURL(videoUrl);
    if (audioUrl) {
      URL.revokeObjectURL(audioUrl);
    }
  }
}

async function transcodeWebmToMp4(webmBlob: Blob, onProgress: (progress: RenderProgress) => void): Promise<Blob> {
  const [{ FFmpeg }, { fetchFile, toBlobURL }] = await Promise.all([
    import("@ffmpeg/ffmpeg"),
    import("@ffmpeg/util")
  ]);
  const ffmpeg = new FFmpeg();
  const baseUrl = "https://unpkg.com/@ffmpeg/core@0.12.10/dist/umd";

  ffmpeg.on("progress", ({ progress }) => {
    onProgress({
      stage: "transcoding",
      progress: Math.min(98, 78 + progress * 20),
      message: "Converting to MP4..."
    });
  });

  await ffmpeg.load({
    coreURL: await toBlobURL(`${baseUrl}/ffmpeg-core.js`, "text/javascript"),
    wasmURL: await toBlobURL(`${baseUrl}/ffmpeg-core.wasm`, "application/wasm")
  });

  await ffmpeg.writeFile("storyshorts.webm", await fetchFile(webmBlob));
  await ffmpeg.exec([
    "-i",
    "storyshorts.webm",
    "-vf",
    "scale=1080:1920",
    "-c:v",
    "libx264",
    "-pix_fmt",
    "yuv420p",
    "-movflags",
    "faststart",
    "-c:a",
    "aac",
    "-b:a",
    "192k",
    "storyshorts.mp4"
  ]);

  const data = await ffmpeg.readFile("storyshorts.mp4");
  await ffmpeg.deleteFile("storyshorts.webm");
  await ffmpeg.deleteFile("storyshorts.mp4");

  onProgress({ stage: "complete", progress: 100, message: "Export ready." });
  const bytes = typeof data === "string" ? new TextEncoder().encode(data) : new Uint8Array(data);
  return new Blob([bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength)], { type: "video/mp4" });
}

function drawFrame(
  ctx: CanvasRenderingContext2D,
  video: HTMLVideoElement,
  cues: CaptionCue[],
  currentTime: number,
  preset: CaptionPreset,
  cropZoom: number
) {
  ctx.fillStyle = "#050505";
  ctx.fillRect(0, 0, canvasWidth, canvasHeight);
  drawCroppedVideo(ctx, video, cropZoom);
  drawCaption(ctx, cues.find((cue) => currentTime >= cue.start && currentTime < cue.end) ?? null, preset);
}

function drawCroppedVideo(ctx: CanvasRenderingContext2D, video: HTMLVideoElement, cropZoom: number) {
  const sourceWidth = video.videoWidth;
  const sourceHeight = video.videoHeight;
  if (!sourceWidth || !sourceHeight) {
    return;
  }

  const targetRatio = canvasWidth / canvasHeight;
  const sourceRatio = sourceWidth / sourceHeight;
  let cropWidth = sourceWidth;
  let cropHeight = sourceHeight;

  if (sourceRatio > targetRatio) {
    cropWidth = sourceHeight * targetRatio;
  } else {
    cropHeight = sourceWidth / targetRatio;
  }

  const zoom = clamp(cropZoom, 1, 1.8);
  cropWidth /= zoom;
  cropHeight /= zoom;
  const sx = (sourceWidth - cropWidth) / 2;
  const sy = (sourceHeight - cropHeight) / 2;

  ctx.drawImage(video, sx, sy, cropWidth, cropHeight, 0, 0, canvasWidth, canvasHeight);
  const gradient = ctx.createLinearGradient(0, canvasHeight * 0.45, 0, canvasHeight);
  gradient.addColorStop(0, "rgba(0,0,0,0)");
  gradient.addColorStop(1, "rgba(0,0,0,0.46)");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, canvasWidth, canvasHeight);
}

function drawCaption(ctx: CanvasRenderingContext2D, cue: CaptionCue | null, preset: CaptionPreset) {
  if (!cue) {
    return;
  }

  const lines = wrapCanvasText(ctx, cue.text.toUpperCase(), preset === "Minimal" ? 520 : 820);
  const fontSize = preset === "Minimal" ? 54 : preset === "Bold" ? 86 : 76;
  const y = canvasHeight * 0.66 - ((lines.length - 1) * fontSize) / 2;

  ctx.save();
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.lineJoin = "round";
  ctx.font = `900 ${fontSize}px Arial`;
  ctx.lineWidth = preset === "Minimal" ? 10 : 18;
  ctx.strokeStyle = "rgba(0,0,0,0.94)";
  ctx.fillStyle = preset === "Yellow Highlight" ? "#facc15" : "#ffffff";

  lines.forEach((line, index) => {
    const lineY = y + index * fontSize * 1.12;
    if (preset === "Yellow Highlight") {
      const metrics = ctx.measureText(line);
      ctx.fillStyle = "rgba(250,204,21,0.92)";
      roundRect(ctx, canvasWidth / 2 - metrics.width / 2 - 22, lineY - fontSize / 2 - 10, metrics.width + 44, fontSize + 20, 18);
      ctx.fill();
      ctx.fillStyle = "#0a0a0a";
      ctx.lineWidth = 0;
      ctx.fillText(line, canvasWidth / 2, lineY);
    } else {
      ctx.strokeText(line, canvasWidth / 2, lineY);
      ctx.fillText(line, canvasWidth / 2, lineY);
    }
  });
  ctx.restore();
}

function wrapCanvasText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number) {
  const words = text.split(" ");
  const lines: string[] = [];
  let current = "";

  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (ctx.measureText(next).width > maxWidth && current) {
      lines.push(current);
      current = word;
    } else {
      current = next;
    }
  }

  if (current) {
    lines.push(current);
  }

  return lines.slice(0, 3);
}

function chooseRecorderMimeType() {
  const options = ["video/webm;codecs=vp9,opus", "video/webm;codecs=vp8,opus", "video/webm"];
  return options.find((mimeType) => MediaRecorder.isTypeSupported(mimeType));
}

function waitForMetadata(media: HTMLMediaElement) {
  return new Promise<void>((resolve, reject) => {
    if (Number.isFinite(media.duration) && media.duration > 0) {
      resolve();
      return;
    }
    media.onloadedmetadata = () => resolve();
    media.onerror = () => reject(new Error("Could not load the selected media file."));
    media.load();
  });
}

function seekVideo(video: HTMLVideoElement, time: number) {
  return new Promise<void>((resolve) => {
    const done = () => {
      video.removeEventListener("seeked", done);
      resolve();
    };
    video.addEventListener("seeked", done);
    video.currentTime = time;
  });
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, radius: number) {
  ctx.beginPath();
  ctx.roundRect(x, y, width, height, radius);
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

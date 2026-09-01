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
  signal?: AbortSignal;
};

const outputWidth = 1080;
const outputHeight = 1920;
const longRenderWidth = 720;
const longRenderHeight = 1280;
const frameRate = 30;
const logPrefix = "[StoryShorts renderer]";

export async function renderVerticalVideo(options: RenderOptions): Promise<Blob> {
  assertBrowserSupport();
  throwIfAborted(options.signal);

  options.onProgress({ stage: "preparing", progress: 4, message: "Preparing media..." });
  renderLog("Starting browser render", {
    videoName: options.videoFile.name,
    videoType: options.videoFile.type || "unknown",
    videoSizeMb: Math.round((options.videoFile.size / 1024 / 1024) * 10) / 10,
    estimatedDuration: options.duration
  });
  const webmBlob = await recordCanvasComposition(options);

  options.onProgress({ stage: "transcoding", progress: 74, message: "Encoding MP4..." });
  try {
    return await transcodeWebmToMp4(webmBlob, options.onProgress, options.signal);
  } finally {
    renderLog("Released recorded WebM input", { sizeMb: Math.round((webmBlob.size / 1024 / 1024) * 10) / 10 });
  }
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
  onProgress,
  signal
}: RenderOptions): Promise<Blob> {
  const renderSize = getWorkingRenderSize(duration);
  const canvas = document.createElement("canvas");
  canvas.width = renderSize.width;
  canvas.height = renderSize.height;
  const ctx = canvas.getContext("2d", { alpha: false });
  if (!ctx) {
    throw new Error("Could not create a video canvas.");
  }

  const videoUrl = URL.createObjectURL(videoFile);
  const audioUrl = audioBlob ? URL.createObjectURL(audioBlob) : null;
  const video = document.createElement("video");
  video.src = videoUrl;
  video.playsInline = true;
  video.preload = "auto";
  video.muted = settings.muteOriginalAudio;
  video.volume = settings.gameplayVolume;
  video.crossOrigin = "anonymous";

  const audio = audioUrl ? document.createElement("audio") : null;
  if (audio && audioUrl) {
    audio.src = audioUrl;
    audio.preload = "auto";
  }

  let canvasStream: MediaStream | null = null;
  let outputStream: MediaStream | null = null;
  let audioContext: AudioContext | null = null;
  let recorder: MediaRecorder | null = null;
  let animationFrame = 0;
  let stoppedAtTrimEnd = false;
  let loopSeekInFlight = false;

  try {
    throwIfAborted(signal);
    await waitForMetadata(video, signal, `Could not load ${videoFile.name}. MOV preview/export only works when this browser can decode the uploaded file.`);
    if (audio) {
      await waitForMetadata(audio, signal, "Could not load generated narration audio.");
    }

    const trimStart = clamp(settings.trimStart, 0, Math.max(0, video.duration - 0.2));
    const trimEnd = settings.trimEnd > trimStart ? Math.min(settings.trimEnd, video.duration) : video.duration;
    const gameplayDuration = Math.max(1, trimEnd - trimStart);
    const targetDuration = settings.loopGameplay ? duration : Math.min(duration, gameplayDuration);

    if (targetDuration > 180) {
      renderLog("Long render requested", { targetDuration, workingSize: `${renderSize.width}x${renderSize.height}` });
    }

    renderLog("Media decoded", {
      sourceVideo: `${video.videoWidth}x${video.videoHeight}`,
      browserDuration: video.duration,
      trimStart,
      trimEnd,
      targetDuration,
      loopGameplay: settings.loopGameplay,
      workingSize: `${renderSize.width}x${renderSize.height}`
    });

    canvasStream = canvas.captureStream(frameRate);
    outputStream = new MediaStream(canvasStream.getVideoTracks());
    audioContext = new AudioContext();
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

    destination.stream.getAudioTracks().forEach((track) => outputStream?.addTrack(track));
    renderLog("Audio muxing prepared", {
      includesNarration: Boolean(audio),
      includesGameplayAudio: !settings.muteOriginalAudio,
      outputAudioTracks: outputStream.getAudioTracks().length
    });

    const mimeType = chooseRecorderMimeType();
    recorder = new MediaRecorder(outputStream, {
      ...(mimeType ? { mimeType } : {}),
      videoBitsPerSecond: renderSize.videoBitsPerSecond,
      audioBitsPerSecond: 128_000
    });
    const chunks: BlobPart[] = [];
    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        chunks.push(event.data);
        renderLog("Recorder chunk", {
          chunkSizeMb: Math.round((event.data.size / 1024 / 1024) * 10) / 10,
          chunks: chunks.length
        });
      }
    };

    await seekVideo(video, trimStart, signal);
    await audioContext.resume();

    const startedAt = performance.now();
    const stopped = waitForRecorderStop(recorder, signal);

    recorder.start(1000);
    renderLog("MediaRecorder started", { mimeType: recorder.mimeType || mimeType || "browser default" });
    await withTimeout(video.play(), 10000, "The browser could not start decoding the gameplay video.");
    if (audio) {
      await withTimeout(audio.play(), 10000, "The browser could not start narration playback for rendering.");
    }

    onProgress({ stage: "recording", progress: 10, message: "Rendering frames..." });

    await withTimeout(
      new Promise<void>((resolve, reject) => {
        let settled = false;
        let lastLoggedSecond = -10;
        const cleanup = () => signal?.removeEventListener("abort", abort);
        const finish = () => {
          if (settled) {
            return;
          }
          settled = true;
          cleanup();
          resolve();
        };
        const fail = (error: unknown) => {
          if (settled) {
            return;
          }
          settled = true;
          cleanup();
          reject(error instanceof Error ? error : new Error("Rendering failed."));
        };
        const abort = () => fail(new DOMException("Rendering canceled.", "AbortError"));
        signal?.addEventListener("abort", abort, { once: true });

        const draw = () => {
          if (signal?.aborted) {
            abort();
            return;
          }

          if (video.error) {
            fail(new Error(`Gameplay decode failed while rendering. MediaError code ${video.error.code}.`));
            return;
          }

          const elapsed = (performance.now() - startedAt) / 1000;
          const progress = Math.min(70, 10 + (elapsed / targetDuration) * 60);
          const elapsedSecond = Math.floor(elapsed);

          if (elapsedSecond >= lastLoggedSecond + 10) {
            lastLoggedSecond = elapsedSecond;
            renderLog("Frame rendering progress", {
              elapsed: elapsedSecond,
              targetDuration: Math.round(targetDuration),
              sourceTime: Math.round(video.currentTime * 10) / 10,
              readyState: video.readyState,
              progress: Math.round(progress)
            });
          }

          if (video.currentTime >= trimEnd - 0.08) {
            if (settings.loopGameplay) {
              if (!loopSeekInFlight) {
                loopSeekInFlight = true;
                video.pause();
                void seekVideo(video, trimStart, signal)
                  .then(() => {
                    void video.play();
                    renderLog("Looped gameplay video", { trimStart });
                  })
                  .catch((error) => {
                    renderLog("Loop seek failed", error);
                    fail(error instanceof Error ? error : new Error("Gameplay loop seek failed."));
                  })
                  .finally(() => {
                    loopSeekInFlight = false;
                  });
              }
            } else if (!stoppedAtTrimEnd) {
              stoppedAtTrimEnd = true;
              video.pause();
            }
          }

          drawFrame(ctx, video, cues, elapsed, captionPreset, settings.cropZoom, renderSize.width, renderSize.height);
          onProgress({ stage: "recording", progress, message: "Rendering frames..." });

          if (elapsed >= targetDuration) {
            finish();
            return;
          }

          animationFrame = requestAnimationFrame(draw);
        };
        animationFrame = requestAnimationFrame(draw);
      }),
      Math.max(45000, targetDuration * 1000 + 45000),
      "Frame rendering stalled before the recording phase could finish."
    );

    video.pause();
    audio?.pause();
    onProgress({ stage: "finalizing", progress: 72, message: "Finalizing browser recording..." });
    renderLog("Stopping MediaRecorder");
    recorder.stop();
    await withTimeout(stopped, 20000, "MediaRecorder did not finish finalizing the video. Try a shorter trim or a browser-supported MP4/WebM source.");
    await audioContext.close();
    audioContext = null;
    renderLog("Browser recording complete", { chunks: chunks.length });

    if (chunks.length === 0) {
      throw new Error("The browser did not produce any video data.");
    }

    const output = new Blob(chunks, { type: "video/webm" });
    chunks.length = 0;
    renderLog("Recorded WebM ready", { sizeMb: Math.round((output.size / 1024 / 1024) * 10) / 10 });
    return output;
  } finally {
    if (animationFrame) {
      cancelAnimationFrame(animationFrame);
    }
    if (recorder && recorder.state !== "inactive") {
      try {
        recorder.stop();
      } catch (error) {
        renderLog("MediaRecorder cleanup stop failed", error);
      }
    }
    canvasStream?.getTracks().forEach((track) => track.stop());
    outputStream?.getTracks().forEach((track) => track.stop());
    await audioContext?.close().catch(() => undefined);
    video.pause();
    audio?.pause();
    video.removeAttribute("src");
    video.load();
    if (audio) {
      audio.removeAttribute("src");
      audio.load();
    }
    canvas.width = 0;
    canvas.height = 0;
    URL.revokeObjectURL(videoUrl);
    if (audioUrl) {
      URL.revokeObjectURL(audioUrl);
    }
    renderLog("Released browser render resources");
  }
}

async function transcodeWebmToMp4(webmBlob: Blob, onProgress: (progress: RenderProgress) => void, signal?: AbortSignal): Promise<Blob> {
  const [{ FFmpeg }, { fetchFile, toBlobURL }] = await Promise.all([
    import("@ffmpeg/ffmpeg"),
    import("@ffmpeg/util")
  ]);
  const ffmpeg = new FFmpeg();
  const baseUrl = "https://unpkg.com/@ffmpeg/core@0.12.10/dist/umd";
  const abort = () => {
    renderLog("Cancelling ffmpeg worker");
    ffmpeg.terminate();
  };

  ffmpeg.on("progress", ({ progress }) => {
    onProgress({
      stage: "transcoding",
      progress: Math.min(98, 74 + progress * 24),
      message: "Encoding MP4..."
    });
  });
  ffmpeg.on("log", ({ type, message }) => renderLog(`ffmpeg ${type}`, message));

  signal?.addEventListener("abort", abort, { once: true });

  try {
    throwIfAborted(signal);
    onProgress({ stage: "transcoding", progress: 75, message: "Loading MP4 encoder..." });
    renderLog("Loading ffmpeg.wasm");
    await withTimeout(
      ffmpeg.load(
        {
          coreURL: await toBlobURL(`${baseUrl}/ffmpeg-core.js`, "text/javascript"),
          wasmURL: await toBlobURL(`${baseUrl}/ffmpeg-core.wasm`, "application/wasm")
        },
        { signal }
      ),
      60000,
      "ffmpeg.wasm did not load. Check the browser console and network access."
    );

    throwIfAborted(signal);
    onProgress({ stage: "transcoding", progress: 77, message: "Loading recorded video into encoder..." });
    await withTimeout(
      ffmpeg.writeFile("storyshorts.webm", await fetchFile(webmBlob), { signal }),
      60000,
      "Could not load the recorded video into ffmpeg.wasm."
    );

    renderLog("Starting MP4 encode", { inputSizeMb: Math.round((webmBlob.size / 1024 / 1024) * 10) / 10 });
    const exitCode = await withTimeout(
      ffmpeg.exec(
        [
          "-i",
          "storyshorts.webm",
          "-vf",
          `scale=${outputWidth}:${outputHeight}`,
          "-c:v",
          "libx264",
          "-preset",
          "veryfast",
          "-crf",
          "23",
          "-pix_fmt",
          "yuv420p",
          "-movflags",
          "faststart",
          "-c:a",
          "aac",
          "-b:a",
          "160k",
          "storyshorts.mp4"
        ],
        20 * 60 * 1000,
        { signal }
      ),
      20 * 60 * 1000 + 10000,
      "MP4 encoding timed out. Try a shorter trim or a smaller source video."
    );

    if (exitCode !== 0) {
      throw new Error(`ffmpeg.wasm failed while encoding MP4. Exit code: ${exitCode}.`);
    }

    throwIfAborted(signal);
    const data = await withTimeout(ffmpeg.readFile("storyshorts.mp4", undefined, { signal }), 60000, "Could not read the encoded MP4.");
    const bytes = typeof data === "string" ? new TextEncoder().encode(data) : new Uint8Array(data);
    const output = new Blob([bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength)], { type: "video/mp4" });
    renderLog("MP4 encode complete", { outputSizeMb: Math.round((output.size / 1024 / 1024) * 10) / 10 });
    onProgress({ stage: "complete", progress: 100, message: "Export ready." });
    return output;
  } finally {
    signal?.removeEventListener("abort", abort);
    await ffmpeg.deleteFile("storyshorts.webm").catch(() => undefined);
    await ffmpeg.deleteFile("storyshorts.mp4").catch(() => undefined);
    ffmpeg.terminate();
    renderLog("Released ffmpeg worker and buffers");
  }
}

function drawFrame(
  ctx: CanvasRenderingContext2D,
  video: HTMLVideoElement,
  cues: CaptionCue[],
  currentTime: number,
  preset: CaptionPreset,
  cropZoom: number,
  canvasWidth: number,
  canvasHeight: number
) {
  ctx.fillStyle = "#050505";
  ctx.fillRect(0, 0, canvasWidth, canvasHeight);
  drawCroppedVideo(ctx, video, cropZoom, canvasWidth, canvasHeight);
  drawCaption(ctx, cues.find((cue) => currentTime >= cue.start && currentTime < cue.end) ?? null, preset, canvasWidth, canvasHeight);
}

function drawCroppedVideo(ctx: CanvasRenderingContext2D, video: HTMLVideoElement, cropZoom: number, canvasWidth: number, canvasHeight: number) {
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

function drawCaption(ctx: CanvasRenderingContext2D, cue: CaptionCue | null, preset: CaptionPreset, canvasWidth: number, canvasHeight: number) {
  if (!cue) {
    return;
  }

  const scale = canvasWidth / outputWidth;
  const lines = wrapCanvasText(ctx, cue.text.toUpperCase(), (preset === "Minimal" ? 520 : 820) * scale);
  const fontSize = (preset === "Minimal" ? 54 : preset === "Bold" ? 86 : 76) * scale;
  const y = canvasHeight * 0.66 - ((lines.length - 1) * fontSize) / 2;

  ctx.save();
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.lineJoin = "round";
  ctx.font = `900 ${fontSize}px Arial`;
  ctx.lineWidth = (preset === "Minimal" ? 10 : 18) * scale;
  ctx.strokeStyle = "rgba(0,0,0,0.94)";
  ctx.fillStyle = preset === "Yellow Highlight" ? "#facc15" : "#ffffff";

  lines.forEach((line, index) => {
    const lineY = y + index * fontSize * 1.12;
    if (preset === "Yellow Highlight") {
      const metrics = ctx.measureText(line);
      ctx.fillStyle = "rgba(250,204,21,0.92)";
      roundRect(ctx, canvasWidth / 2 - metrics.width / 2 - 22 * scale, lineY - fontSize / 2 - 10 * scale, metrics.width + 44 * scale, fontSize + 20 * scale, 18 * scale);
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

function waitForMetadata(media: HTMLMediaElement, signal: AbortSignal | undefined, errorMessage: string) {
  return withTimeout(
    new Promise<void>((resolve, reject) => {
      if (Number.isFinite(media.duration) && media.duration > 0) {
        resolve();
        return;
      }
      const abort = () => {
        cleanup();
        reject(new DOMException("Rendering canceled.", "AbortError"));
      };
      const cleanup = () => {
        media.removeEventListener("loadedmetadata", loaded);
        media.removeEventListener("error", failed);
        signal?.removeEventListener("abort", abort);
      };
      const loaded = () => {
        cleanup();
        resolve();
      };
      const failed = () => {
        cleanup();
        const details = media.error ? ` MediaError code ${media.error.code}.` : "";
        reject(new Error(`${errorMessage}${details}`));
      };
      signal?.addEventListener("abort", abort, { once: true });
      media.addEventListener("loadedmetadata", loaded, { once: true });
      media.addEventListener("error", failed, { once: true });
      media.load();
    }),
    20000,
    errorMessage
  );
}

function seekVideo(video: HTMLVideoElement, time: number, signal?: AbortSignal) {
  return withTimeout(
    new Promise<void>((resolve, reject) => {
      const abort = () => {
        cleanup();
        reject(new DOMException("Rendering canceled.", "AbortError"));
      };
      const cleanup = () => {
        video.removeEventListener("seeked", done);
        video.removeEventListener("error", failed);
        signal?.removeEventListener("abort", abort);
      };
      const done = () => {
        cleanup();
        resolve();
      };
      const failed = () => {
        cleanup();
        reject(new Error("The browser could not seek the gameplay video. MOV files can fail here if the codec is not browser-decodable."));
      };
      signal?.addEventListener("abort", abort, { once: true });
      video.addEventListener("seeked", done, { once: true });
      video.addEventListener("error", failed, { once: true });
      video.currentTime = time;
    }),
    10000,
    "Seeking the gameplay video took too long. Try converting the MOV to H.264 MP4 or trimming the clip."
  );
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, radius: number) {
  ctx.beginPath();
  ctx.roundRect(x, y, width, height, radius);
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function getWorkingRenderSize(duration: number) {
  if (duration >= 90) {
    return {
      width: longRenderWidth,
      height: longRenderHeight,
      videoBitsPerSecond: 5_000_000
    };
  }

  return {
    width: outputWidth,
    height: outputHeight,
    videoBitsPerSecond: 8_000_000
  };
}

function waitForRecorderStop(recorder: MediaRecorder, signal?: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    const abort = () => {
      cleanup();
      reject(new DOMException("Rendering canceled.", "AbortError"));
    };
    const cleanup = () => {
      recorder.removeEventListener("stop", stopped);
      recorder.removeEventListener("error", failed);
      signal?.removeEventListener("abort", abort);
    };
    const stopped = () => {
      cleanup();
      resolve();
    };
    const failed = (event: Event) => {
      cleanup();
      const error = event instanceof ErrorEvent ? event.error : undefined;
      reject(error instanceof Error ? error : new Error("Browser recording failed."));
    };

    signal?.addEventListener("abort", abort, { once: true });
    recorder.addEventListener("stop", stopped, { once: true });
    recorder.addEventListener("error", failed, { once: true });
  });
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number, message: string): Promise<T> {
  let timeoutId = 0;
  const timeout = new Promise<never>((_, reject) => {
    timeoutId = window.setTimeout(() => reject(new Error(message)), timeoutMs);
  });

  try {
    return await Promise.race([promise, timeout]);
  } finally {
    window.clearTimeout(timeoutId);
  }
}

function throwIfAborted(signal?: AbortSignal) {
  if (signal?.aborted) {
    throw new DOMException("Rendering canceled.", "AbortError");
  }
}

function renderLog(message: string, details?: unknown) {
  if (details === undefined) {
    console.info(logPrefix, message);
    return;
  }
  console.info(logPrefix, message, details);
}

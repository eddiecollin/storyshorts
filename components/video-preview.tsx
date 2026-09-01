"use client";

import { Pause, Play } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { getActiveCaption } from "@/lib/captions";
import { formatDuration } from "@/lib/file-handling";
import type { CaptionCue, CaptionPreset, GameplaySettings, VoiceId } from "@/types/storyshorts";
import { Button } from "@/components/ui";

type VideoPreviewProps = {
  videoUrl: string | null;
  audioUrl: string | null;
  storyText: string;
  voice: VoiceId;
  cues: CaptionCue[];
  captionPreset: CaptionPreset;
  duration: number;
  settings: GameplaySettings;
};

export function VideoPreview({
  videoUrl,
  audioUrl,
  storyText,
  voice,
  cues,
  captionPreset,
  duration,
  settings
}: VideoPreviewProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const activeCue = useMemo(() => getActiveCaption(cues, currentTime), [cues, currentTime]);

  useEffect(() => {
    if (!isPlaying) {
      return;
    }

    const startedAt = performance.now() - currentTime * 1000;
    let frame = 0;
    const tick = () => {
      const elapsed = (performance.now() - startedAt) / 1000;
      setCurrentTime(elapsed);

      if (elapsed >= duration) {
        setIsPlaying(false);
        videoRef.current?.pause();
        audioRef.current?.pause();
        window.speechSynthesis?.cancel();
        return;
      }

      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);

    return () => cancelAnimationFrame(frame);
  }, [currentTime, duration, isPlaying]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !videoUrl) {
      return;
    }
    video.muted = settings.muteOriginalAudio;
    video.volume = settings.gameplayVolume;
  }, [settings.gameplayVolume, settings.muteOriginalAudio, videoUrl]);

  async function togglePlayback() {
    if (isPlaying) {
      setIsPlaying(false);
      videoRef.current?.pause();
      audioRef.current?.pause();
      window.speechSynthesis?.cancel();
      return;
    }

    setCurrentTime(0);
    const video = videoRef.current;
    const audio = audioRef.current;

    if (video && videoUrl) {
      video.currentTime = settings.trimStart;
      video.loop = settings.loopGameplay;
      await video.play().catch(() => undefined);
    }

    if (audio && audioUrl) {
      audio.currentTime = 0;
      await audio.play().catch(() => undefined);
    } else if (storyText.trim() && "speechSynthesis" in window) {
      const utterance = new SpeechSynthesisUtterance(storyText);
      utterance.rate = 1.04;
      utterance.voice = pickBrowserVoice(voice);
      window.speechSynthesis.cancel();
      window.speechSynthesis.speak(utterance);
    }

    setIsPlaying(true);
  }

  return (
    <section className="flex min-h-[680px] flex-col rounded-lg border border-white/10 bg-[var(--color-panel)] p-4">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <h2 className="font-semibold">Preview</h2>
          <p className="text-sm text-neutral-500">{formatDuration(duration)} estimated</p>
        </div>
        <Button type="button" variant="secondary" onClick={togglePlayback} className="min-w-28">
          {isPlaying ? <Pause size={17} /> : <Play size={17} />}
          {isPlaying ? "Pause" : "Preview"}
        </Button>
      </div>

      <div className="grid flex-1 place-items-center">
        <div className="phone-shadow relative aspect-[9/16] h-[72vh] max-h-[760px] min-h-[520px] w-auto overflow-hidden rounded-[2rem] border border-white/10 bg-neutral-950">
          {videoUrl ? (
            <video
              ref={videoRef}
              src={videoUrl}
              className="absolute inset-0 size-full object-cover"
              playsInline
              muted={settings.muteOriginalAudio}
            />
          ) : (
            <div className="absolute inset-0 grid place-items-center bg-[linear-gradient(160deg,#111,#202020_48%,#0a0a0a)] px-8 text-center text-sm text-neutral-400">
              Upload MP4, MOV or WebM gameplay to see the vertical composition.
            </div>
          )}
          {audioUrl ? <audio ref={audioRef} src={audioUrl} /> : null}
          <div className="absolute inset-x-0 bottom-[26%] flex justify-center px-8">
            {activeCue ? <CaptionText preset={captionPreset} text={activeCue.text} /> : null}
          </div>
          <div className="absolute inset-x-0 top-0 h-28 bg-gradient-to-b from-black/45 to-transparent" />
          <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-black/55 to-transparent" />
        </div>
      </div>
    </section>
  );
}

function CaptionText({ text, preset }: { text: string; preset: CaptionPreset }) {
  const base = "max-w-[86%] text-center font-black uppercase leading-[1.02] tracking-normal caption-outline";
  const size = preset === "Minimal" ? "text-3xl sm:text-4xl" : preset === "Bold" ? "text-5xl sm:text-6xl" : "text-4xl sm:text-5xl";

  if (preset === "Yellow Highlight") {
    return (
      <div className={`${base} ${size} rounded-lg bg-yellow-300 px-3 py-2 text-neutral-950 [text-shadow:none]`}>
        {text}
      </div>
    );
  }

  return <div className={`${base} ${size} text-white`}>{text}</div>;
}

function pickBrowserVoice(voice: VoiceId) {
  const voices = window.speechSynthesis?.getVoices() ?? [];
  const lower = voice.toLowerCase();
  return voices.find((item) => item.name.toLowerCase().includes(lower)) ?? voices.find((item) => item.lang.startsWith("en")) ?? null;
}

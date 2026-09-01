"use client";

import { AlertCircle, CheckCircle2, Info } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { ChangeEvent, Suspense, useEffect, useMemo, useRef, useState } from "react";
import { ControlPanel } from "@/components/control-panel";
import { VideoPreview } from "@/components/video-preview";
import { createCaptionCues, estimateNarrationDuration } from "@/lib/captions";
import { blobToObjectUrl, validateGameplayFile } from "@/lib/file-handling";
import { getTemplate } from "@/lib/templates";
import { renderVerticalVideo } from "@/lib/video-rendering";
import type {
  CaptionPreset,
  GameplaySettings,
  GeneratedStory,
  RenderProgress,
  StoryCategory,
  VoiceId
} from "@/types/storyshorts";

const defaultSettings: GameplaySettings = {
  trimStart: 0,
  trimEnd: 0,
  cropZoom: 1.15,
  muteOriginalAudio: true,
  gameplayVolume: 0.15,
  loopGameplay: true
};

export function EditorWorkspace() {
  return (
    <Suspense fallback={<main className="mx-auto max-w-7xl px-4 py-8 text-neutral-400">Loading editor...</main>}>
      <EditorWorkspaceContent />
    </Suspense>
  );
}

function EditorWorkspaceContent() {
  const searchParams = useSearchParams();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [title, setTitle] = useState("");
  const [storyText, setStoryText] = useState("");
  const [premise, setPremise] = useState("");
  const [category, setCategory] = useState<StoryCategory>("Relationship");
  const [voice, setVoice] = useState<VoiceId>("nova");
  const [captionPreset, setCaptionPreset] = useState<CaptionPreset>("Classic");
  const [settings, setSettings] = useState<GameplaySettings>(defaultSettings);
  const [gameplayFile, setGameplayFile] = useState<File | null>(null);
  const [gameplayUrl, setGameplayUrl] = useState<string | null>(null);
  const [gameplayDuration, setGameplayDuration] = useState(0);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [exportedUrl, setExportedUrl] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ type: "info" | "success" | "error"; text: string } | null>({
    type: "info",
    text: "Demo mode works without an OpenAI key: write or generate a demo story, preview captions, and render gameplay. Add OPENAI_API_KEY for AI generation and narration."
  });
  const [isGeneratingStory, setIsGeneratingStory] = useState(false);
  const [isGeneratingAudio, setIsGeneratingAudio] = useState(false);
  const [isRendering, setIsRendering] = useState(false);
  const [renderProgress, setRenderProgress] = useState<RenderProgress | null>(null);
  const renderAbortControllerRef = useRef<AbortController | null>(null);
  const objectUrlsRef = useRef({ gameplayUrl: null as string | null, audioUrl: null as string | null, exportedUrl: null as string | null });

  useEffect(() => {
    const template = getTemplate(searchParams.get("template"));
    if (!template) {
      return;
    }

    setCategory(template.category);
    setCaptionPreset(template.captionPreset);
    setVoice(template.voice);
    setPremise(template.premise);
    setTitle(template.hook);
    setNotice({ type: "success", text: `${template.name} template loaded.` });
  }, [searchParams]);

  useEffect(() => {
    objectUrlsRef.current = { gameplayUrl, audioUrl, exportedUrl };
  }, [audioUrl, exportedUrl, gameplayUrl]);

  useEffect(() => {
    return () => {
      const urls = objectUrlsRef.current;
      if (urls.gameplayUrl) {
        URL.revokeObjectURL(urls.gameplayUrl);
      }
      if (urls.audioUrl) {
        URL.revokeObjectURL(urls.audioUrl);
      }
      if (urls.exportedUrl) {
        URL.revokeObjectURL(urls.exportedUrl);
      }
    };
  }, []);

  const duration = useMemo(() => {
    if (audioBlob && audioUrl) {
      return estimateNarrationDuration(storyText);
    }
    return estimateNarrationDuration(storyText);
  }, [audioBlob, audioUrl, storyText]);

  const cues = useMemo(() => createCaptionCues(storyText, duration), [duration, storyText]);

  async function handleGenerateStory() {
    setIsGeneratingStory(true);
    setNotice(null);

    try {
      const response = await fetch("/api/story", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ category, premise })
      });
      const data = (await response.json()) as GeneratedStory & { error?: string };

      if (!response.ok) {
        throw new Error(data.error || "Story generation failed.");
      }

      setTitle(data.title);
      setStoryText(data.story);
      setAudioBlob(null);
      setAudioUrl((current) => {
        if (current) {
          URL.revokeObjectURL(current);
        }
        return null;
      });
      setNotice({
        type: data.demo ? "info" : "success",
        text: data.demo
          ? "OPENAI_API_KEY is not configured, so StoryShorts loaded an original local demo story."
          : "Story generated."
      });
    } catch (error) {
      setNotice({ type: "error", text: error instanceof Error ? error.message : "Story generation failed." });
    } finally {
      setIsGeneratingStory(false);
    }
  }

  async function handleGenerateAudio() {
    if (!storyText.trim()) {
      setNotice({ type: "error", text: "Enter story text before generating narration." });
      return;
    }

    setIsGeneratingAudio(true);
    setNotice(null);

    try {
      const response = await fetch("/api/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: storyText, voice })
      });

      if (!response.ok) {
        const data = (await response.json()) as { error?: string };
        throw new Error(data.error || "Narration generation failed.");
      }

      const blob = await response.blob();
      setAudioBlob(blob);
      setAudioUrl((current) => blobToObjectUrl(current, blob));
      setNotice({ type: "success", text: "Narration generated." });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Narration generation failed.";
      setNotice({
        type: "info",
        text: `${message} You can still preview with browser speech and render a captioned gameplay video.`
      });
    } finally {
      setIsGeneratingAudio(false);
    }
  }

  function handleGameplayUpload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    const error = validateGameplayFile(file);
    if (error) {
      setNotice({ type: "error", text: error });
      event.target.value = "";
      return;
    }

    const url = URL.createObjectURL(file);
    const video = document.createElement("video");
    video.preload = "metadata";
    video.src = url;
    video.onloadedmetadata = () => {
      setGameplayFile(file);
      setGameplayUrl((current) => {
        if (current) {
          URL.revokeObjectURL(current);
        }
        return url;
      });
      setGameplayDuration(video.duration);
      setSettings((current) => ({
        ...current,
        trimStart: 0,
        trimEnd: video.duration
      }));
      video.removeAttribute("src");
      video.load();
      setNotice({ type: "success", text: "Gameplay uploaded." });
    };
    video.onerror = () => {
      URL.revokeObjectURL(url);
      setNotice({ type: "error", text: "This video could not be loaded by the browser." });
    };
  }

  async function handleGenerateVideo() {
    if (!storyText.trim()) {
      setNotice({ type: "error", text: "Enter story text before generating video." });
      return;
    }
    if (!gameplayFile) {
      setNotice({ type: "error", text: "Upload a gameplay video before rendering." });
      return;
    }

    setIsRendering(true);
    const abortController = new AbortController();
    renderAbortControllerRef.current = abortController;
    setRenderProgress({ stage: "preparing", progress: 1, message: "Starting render..." });
    setNotice(null);

    try {
      const output = await renderVerticalVideo({
        videoFile: gameplayFile,
        audioBlob,
        cues,
        captionPreset,
        duration,
        settings,
        onProgress: setRenderProgress,
        signal: abortController.signal
      });
      setExportedUrl((current) => blobToObjectUrl(current, output));
      setNotice({
        type: "success",
        text: audioBlob
          ? "MP4 export is ready."
          : "MP4 export is ready without AI narration. Add OPENAI_API_KEY and generate narration for a voiced export."
      });
    } catch (error) {
      console.error("[StoryShorts renderer] Render failed", error);
      setNotice({
        type: isAbortError(error) ? "info" : "error",
        text: error instanceof Error ? error.message : "Rendering failed."
      });
    } finally {
      renderAbortControllerRef.current = null;
      setIsRendering(false);
    }
  }

  function handleCancelRender() {
    renderAbortControllerRef.current?.abort();
    setRenderProgress({ stage: "finalizing", progress: renderProgress?.progress ?? 0, message: "Cancelling render..." });
  }

  return (
    <main className="mx-auto grid max-w-7xl gap-5 px-4 py-5 sm:px-6 lg:grid-cols-[minmax(360px,0.92fr)_minmax(360px,1.08fr)]">
      <div className="space-y-4">
        {notice ? <Notice type={notice.type} text={notice.text} /> : null}
        <ControlPanel
          title={title}
          storyText={storyText}
          premise={premise}
          category={category}
          voice={voice}
          captionPreset={captionPreset}
          gameplayName={gameplayFile?.name ?? null}
          gameplayDuration={gameplayDuration}
          settings={settings}
          audioReady={Boolean(audioBlob)}
          exportedUrl={exportedUrl}
          duration={duration}
          isGeneratingStory={isGeneratingStory}
          isGeneratingAudio={isGeneratingAudio}
          isRendering={isRendering}
          renderProgress={renderProgress}
          fileInputRef={fileInputRef}
          onTitleChange={setTitle}
          onStoryTextChange={setStoryText}
          onPremiseChange={setPremise}
          onCategoryChange={setCategory}
          onVoiceChange={setVoice}
          onCaptionPresetChange={setCaptionPreset}
          onGameplayUpload={handleGameplayUpload}
          onGenerateStory={handleGenerateStory}
          onGenerateAudio={handleGenerateAudio}
          onGenerateVideo={handleGenerateVideo}
          onCancelRender={handleCancelRender}
          onSettingsChange={setSettings}
        />
      </div>
      <VideoPreview
        videoUrl={gameplayUrl}
        audioUrl={audioUrl}
        storyText={storyText}
        voice={voice}
        cues={cues}
        captionPreset={captionPreset}
        duration={duration}
        settings={settings}
      />
    </main>
  );
}

function isAbortError(error: unknown) {
  return error instanceof DOMException && error.name === "AbortError";
}

function Notice({ type, text }: { type: "info" | "success" | "error"; text: string }) {
  const icon = {
    info: Info,
    success: CheckCircle2,
    error: AlertCircle
  }[type];
  const Icon = icon;
  const tone = {
    info: "border-sky-300/20 bg-sky-300/10 text-sky-100",
    success: "border-emerald-300/20 bg-emerald-300/10 text-emerald-100",
    error: "border-red-300/25 bg-red-400/10 text-red-100"
  }[type];

  return (
    <div className={`flex gap-3 rounded-lg border p-3 text-sm leading-6 ${tone}`}>
      <Icon className="mt-0.5 shrink-0" size={18} />
      <p>{text}</p>
    </div>
  );
}

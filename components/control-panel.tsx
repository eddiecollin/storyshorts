"use client";

import { Download, FileVideo, Mic2, RefreshCw, Sparkles, Wand2, X } from "lucide-react";
import { ChangeEvent, RefObject } from "react";
import { captionPresets, exampleStory, storyCategories, voices } from "@/lib/constants";
import { formatDuration } from "@/lib/file-handling";
import type { CaptionPreset, GameplaySettings, RenderProgress, StoryCategory, VoiceId } from "@/types/storyshorts";
import { Button, Field, inputClass } from "@/components/ui";

type ControlPanelProps = {
  title: string;
  storyText: string;
  premise: string;
  category: StoryCategory;
  voice: VoiceId;
  captionPreset: CaptionPreset;
  gameplayName: string | null;
  gameplayDuration: number;
  settings: GameplaySettings;
  audioReady: boolean;
  exportedUrl: string | null;
  duration: number;
  isGeneratingStory: boolean;
  isGeneratingAudio: boolean;
  isRendering: boolean;
  renderProgress: RenderProgress | null;
  fileInputRef: RefObject<HTMLInputElement | null>;
  onTitleChange: (value: string) => void;
  onStoryTextChange: (value: string) => void;
  onPremiseChange: (value: string) => void;
  onCategoryChange: (value: StoryCategory) => void;
  onVoiceChange: (value: VoiceId) => void;
  onCaptionPresetChange: (value: CaptionPreset) => void;
  onGameplayUpload: (event: ChangeEvent<HTMLInputElement>) => void;
  onGenerateStory: () => void;
  onGenerateAudio: () => void;
  onGenerateVideo: () => void;
  onCancelRender: () => void;
  onSettingsChange: (settings: GameplaySettings) => void;
};

export function ControlPanel({
  title,
  storyText,
  premise,
  category,
  voice,
  captionPreset,
  gameplayName,
  gameplayDuration,
  settings,
  audioReady,
  exportedUrl,
  duration,
  isGeneratingStory,
  isGeneratingAudio,
  isRendering,
  renderProgress,
  fileInputRef,
  onTitleChange,
  onStoryTextChange,
  onPremiseChange,
  onCategoryChange,
  onVoiceChange,
  onCaptionPresetChange,
  onGameplayUpload,
  onGenerateStory,
  onGenerateAudio,
  onGenerateVideo,
  onCancelRender,
  onSettingsChange
}: ControlPanelProps) {
  return (
    <section className="rounded-lg border border-white/10 bg-[var(--color-panel)] p-4 sm:p-5">
      <div className="mb-5 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-normal">Editor</h1>
          <p className="mt-1 text-sm text-neutral-400">Build a 9:16 narrated story short from your own footage.</p>
        </div>
        <span className="rounded-md border border-sky-300/20 bg-sky-300/10 px-2.5 py-1 text-xs font-medium text-sky-200">
          MVP
        </span>
      </div>

      <div className="space-y-4">
        <Field label="Story Title">
          <input value={title} onChange={(event) => onTitleChange(event.target.value)} className={inputClass} placeholder="The text I should have ignored" />
        </Field>

        <Field label="Story Text">
          <textarea
            value={storyText}
            onChange={(event) => onStoryTextChange(event.target.value)}
            className={`${inputClass} min-h-56 resize-y leading-6`}
            placeholder={exampleStory}
          />
        </Field>

        <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
          <Field label="Premise">
            <input
              value={premise}
              onChange={(event) => onPremiseChange(event.target.value)}
              className={inputClass}
              placeholder="A weird neighbor keeps returning the same lost wallet"
            />
          </Field>
          <Field label="Category">
            <select value={category} onChange={(event) => onCategoryChange(event.target.value as StoryCategory)} className={`${inputClass} sm:min-w-44`}>
              {storyCategories.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </Field>
        </div>

        <Button type="button" onClick={onGenerateStory} disabled={isGeneratingStory} className="w-full">
          {isGeneratingStory ? <RefreshCw className="animate-spin" size={17} /> : <Sparkles size={17} />}
          Generate Reddit Story
        </Button>

        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Voice">
            <select value={voice} onChange={(event) => onVoiceChange(event.target.value as VoiceId)} className={inputClass}>
              {voices.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.label} - {item.description}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Caption Style">
            <select value={captionPreset} onChange={(event) => onCaptionPresetChange(event.target.value as CaptionPreset)} className={inputClass}>
              {captionPresets.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </Field>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <Button type="button" variant="secondary" onClick={() => fileInputRef.current?.click()}>
            <FileVideo size={17} />
            Upload Gameplay
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".mp4,.mov,.webm,video/mp4,video/quicktime,video/x-quicktime,video/webm"
            className="hidden"
            onChange={onGameplayUpload}
          />
          <Button type="button" variant="secondary" onClick={onGenerateAudio} disabled={isGeneratingAudio || !storyText.trim()}>
            {isGeneratingAudio ? <RefreshCw className="animate-spin" size={17} /> : <Mic2 size={17} />}
            Generate Narration
          </Button>
        </div>

        <div className="rounded-lg border border-white/10 bg-neutral-950 p-4">
          <div className="mb-3 flex items-center justify-between gap-3 text-sm">
            <span className="text-neutral-300">{gameplayName ?? "No gameplay uploaded"}</span>
            <span className="text-neutral-500">{gameplayDuration ? formatDuration(gameplayDuration) : "0:00"}</span>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <NumberField label="Trim Start" value={settings.trimStart} min={0} max={Math.max(0, gameplayDuration - 1)} onChange={(trimStart) => onSettingsChange({ ...settings, trimStart })} />
            <NumberField label="Trim End" value={settings.trimEnd} min={0} max={Math.max(0, gameplayDuration)} onChange={(trimEnd) => onSettingsChange({ ...settings, trimEnd })} />
          </div>
          <Field label={`Crop / Zoom ${settings.cropZoom.toFixed(2)}x`}>
            <input
              type="range"
              min="1"
              max="1.8"
              step="0.05"
              value={settings.cropZoom}
              onChange={(event) => onSettingsChange({ ...settings, cropZoom: Number(event.target.value) })}
              className="w-full accent-sky-300"
            />
          </Field>
          <Field label={`Gameplay Volume ${Math.round(settings.gameplayVolume * 100)}%`}>
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={settings.gameplayVolume}
              disabled={settings.muteOriginalAudio}
              onChange={(event) => onSettingsChange({ ...settings, gameplayVolume: Number(event.target.value) })}
              className="w-full accent-sky-300 disabled:opacity-40"
            />
          </Field>
          <div className="grid gap-2 sm:grid-cols-2">
            <Toggle checked={settings.muteOriginalAudio} label="Mute gameplay audio" onChange={(muteOriginalAudio) => onSettingsChange({ ...settings, muteOriginalAudio })} />
            <Toggle checked={settings.loopGameplay} label="Loop short gameplay" onChange={(loopGameplay) => onSettingsChange({ ...settings, loopGameplay })} />
          </div>
        </div>

        <div className="rounded-lg border border-white/10 bg-white/[0.04] p-4">
          <div className="mb-3 grid grid-cols-3 gap-2 text-center text-xs text-neutral-400">
            <Stat label="Duration" value={formatDuration(duration)} />
            <Stat label="Audio" value={audioReady ? "Ready" : "Demo"} />
            <Stat label="Output" value="1080x1920" />
          </div>
          {renderProgress ? (
            <div className="mb-3">
              <div className="mb-2 flex justify-between text-xs text-neutral-400">
                <span>{renderProgress.message}</span>
                <span>{Math.round(renderProgress.progress)}%</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-neutral-800">
                <div className="h-full bg-sky-300 transition-all" style={{ width: `${renderProgress.progress}%` }} />
              </div>
            </div>
          ) : null}
          <div className={`grid gap-3 ${isRendering ? "sm:grid-cols-3" : "sm:grid-cols-2"}`}>
            <Button type="button" onClick={onGenerateVideo} disabled={isRendering || !storyText.trim()} className="w-full">
              {isRendering ? <RefreshCw className="animate-spin" size={17} /> : <Wand2 size={17} />}
              Generate Video
            </Button>
            {isRendering ? (
              <Button type="button" variant="secondary" onClick={onCancelRender} className="w-full">
                <X size={17} />
                Cancel Render
              </Button>
            ) : null}
            <a
              href={exportedUrl ?? undefined}
              download="storyshorts.mp4"
              aria-disabled={!exportedUrl}
              className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition ${
                exportedUrl ? "border border-white/10 bg-white/[0.06] text-white hover:bg-white/[0.1]" : "pointer-events-none border border-white/5 bg-white/[0.03] text-neutral-600"
              }`}
            >
              <Download size={17} />
              Download Video
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}

function NumberField({ label, value, min, max, onChange }: { label: string; value: number; min: number; max: number; onChange: (value: number) => void }) {
  return (
    <Field label={label}>
      <input
        type="number"
        min={min}
        max={max}
        step="0.1"
        value={Number.isFinite(value) ? value : 0}
        onChange={(event) => onChange(Math.max(min, Math.min(max, Number(event.target.value))))}
        className={inputClass}
      />
    </Field>
  );
}

function Toggle({ checked, label, onChange }: { checked: boolean; label: string; onChange: (checked: boolean) => void }) {
  return (
    <label className="flex min-h-11 cursor-pointer items-center justify-between gap-3 rounded-lg border border-white/10 bg-neutral-950 px-3 py-2 text-sm text-neutral-300">
      <span>{label}</span>
      <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} className="size-4 accent-sky-300" />
    </label>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-white/10 bg-neutral-950 p-2">
      <div className="text-[11px] uppercase text-neutral-500">{label}</div>
      <div className="mt-1 font-semibold text-neutral-100">{value}</div>
    </div>
  );
}

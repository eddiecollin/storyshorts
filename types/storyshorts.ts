export type StoryCategory =
  | "Relationship"
  | "Revenge"
  | "Creepy"
  | "School"
  | "Work"
  | "Confession"
  | "Family"
  | "Unexpected Twist";

export type CaptionPreset = "Classic" | "Yellow Highlight" | "Minimal" | "Bold";

export type VoiceId = "alloy" | "ash" | "coral" | "echo" | "fable" | "nova" | "onyx" | "sage" | "shimmer";

export type CaptionCue = {
  id: string;
  text: string;
  start: number;
  end: number;
};

export type GameplaySettings = {
  trimStart: number;
  trimEnd: number;
  cropZoom: number;
  muteOriginalAudio: boolean;
  gameplayVolume: number;
  loopGameplay: boolean;
};

export type StoryTemplate = {
  id: string;
  name: string;
  description: string;
  category: StoryCategory;
  captionPreset: CaptionPreset;
  voice: VoiceId;
  premise: string;
  hook: string;
};

export type GeneratedStory = {
  title: string;
  story: string;
  demo?: boolean;
};

export type RenderProgress = {
  stage: "preparing" | "recording" | "finalizing" | "transcoding" | "complete";
  progress: number;
  message: string;
};

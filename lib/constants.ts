import type { CaptionPreset, StoryCategory, VoiceId } from "@/types/storyshorts";

export const storyCategories: StoryCategory[] = [
  "Relationship",
  "Revenge",
  "Creepy",
  "School",
  "Work",
  "Confession",
  "Family",
  "Unexpected Twist"
];

export const voices: { id: VoiceId; label: string; description: string }[] = [
  { id: "alloy", label: "Alloy", description: "Balanced and clear" },
  { id: "ash", label: "Ash", description: "Direct and steady" },
  { id: "coral", label: "Coral", description: "Warm and energetic" },
  { id: "echo", label: "Echo", description: "Crisp storyteller" },
  { id: "fable", label: "Fable", description: "Expressive narrator" },
  { id: "nova", label: "Nova", description: "Bright and conversational" },
  { id: "onyx", label: "Onyx", description: "Deep and dramatic" },
  { id: "sage", label: "Sage", description: "Calm and natural" },
  { id: "shimmer", label: "Shimmer", description: "Light and upbeat" }
];

export const captionPresets: CaptionPreset[] = ["Classic", "Yellow Highlight", "Minimal", "Bold"];

export const exampleStory =
  "My girlfriend disappeared for three days and when she came back she acted like nothing happened. At first I thought she was cheating, but then I found a hospital bracelet hidden in the pocket of her hoodie.";

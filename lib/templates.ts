import type { StoryTemplate } from "@/types/storyshorts";

export const templates: StoryTemplate[] = [
  {
    id: "reddit-classic",
    name: "Reddit Classic",
    description: "A fast personal story with a clean hook, escalating details, and a final reveal.",
    category: "Unexpected Twist",
    captionPreset: "Classic",
    voice: "nova",
    premise: "A normal day slowly turns strange after one tiny detail does not add up.",
    hook: "I thought I was overreacting until I checked the camera."
  },
  {
    id: "minecraft-story",
    name: "Minecraft Story",
    description: "High-retention pacing designed to sit over parkour or satisfying gameplay.",
    category: "School",
    captionPreset: "Yellow Highlight",
    voice: "alloy",
    premise: "A student finds out their quiet classmate has been protecting them from a setup.",
    hook: "The quiet kid in my class warned me not to open my locker."
  },
  {
    id: "confession",
    name: "Confession",
    description: "A first-person admission that builds empathy before landing the real secret.",
    category: "Confession",
    captionPreset: "Minimal",
    voice: "sage",
    premise: "Someone confesses a harmless lie that accidentally changed their whole family.",
    hook: "I lied once when I was thirteen, and my family still believes it."
  },
  {
    id: "relationship-drama",
    name: "Relationship Drama",
    description: "A tense relationship story with suspicion, receipts, and a clean payoff.",
    category: "Relationship",
    captionPreset: "Bold",
    voice: "coral",
    premise: "A partner notices repeated odd behavior and discovers the truth is not what they expected.",
    hook: "My boyfriend kept leaving dinner early, so I followed him."
  },
  {
    id: "creepy-story",
    name: "Creepy Story",
    description: "A subtle unsettling story that gets stranger every few sentences.",
    category: "Creepy",
    captionPreset: "Classic",
    voice: "onyx",
    premise: "A person moves into a new place and receives messages meant for the previous tenant.",
    hook: "The first text said, 'Do not answer the door after midnight.'"
  }
];

export function getTemplate(id: string | null): StoryTemplate | undefined {
  return templates.find((template) => template.id === id);
}

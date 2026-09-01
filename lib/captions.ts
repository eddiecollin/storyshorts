import type { CaptionCue } from "@/types/storyshorts";

const wordsPerSecond = 2.35;

export function estimateNarrationDuration(text: string): number {
  const words = getWords(text).length;
  return Math.max(8, Math.min(180, words / wordsPerSecond));
}

export function createCaptionCues(text: string, duration?: number): CaptionCue[] {
  const words = getWords(text);
  if (words.length === 0) {
    return [];
  }

  const targetDuration = duration && Number.isFinite(duration) ? duration : estimateNarrationDuration(text);
  const phrases = chunkWords(words);
  const totalWords = words.length;
  let elapsed = 0;

  return phrases.map((phrase, index) => {
    const phraseDuration = Math.max(0.9, (phrase.length / totalWords) * targetDuration);
    const start = elapsed;
    const end = index === phrases.length - 1 ? targetDuration : Math.min(targetDuration, start + phraseDuration);
    elapsed = end;
    return {
      id: `${index}-${phrase.join("-").toLowerCase()}`,
      text: phrase.join(" "),
      start,
      end
    };
  });
}

export function getActiveCaption(cues: CaptionCue[], currentTime: number): CaptionCue | null {
  return cues.find((cue) => currentTime >= cue.start && currentTime < cue.end) ?? null;
}

function chunkWords(words: string[]): string[][] {
  const phrases: string[][] = [];
  let index = 0;

  while (index < words.length) {
    const remaining = words.length - index;
    const size = Math.min(remaining, chooseChunkSize(words[index] ?? "", index));
    phrases.push(words.slice(index, index + size));
    index += size;
  }

  return phrases;
}

function chooseChunkSize(word: string, index: number): number {
  if (word.length > 9) {
    return 2;
  }
  return [3, 4, 3, 5][index % 4] ?? 3;
}

function getWords(text: string): string[] {
  return text
    .replace(/\s+/g, " ")
    .trim()
    .split(" ")
    .map((word) => word.trim())
    .filter(Boolean);
}

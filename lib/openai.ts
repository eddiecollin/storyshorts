import type { GeneratedStory, StoryCategory, VoiceId } from "@/types/storyshorts";
import { buildDemoStory } from "@/lib/demo-story";

const openAiBaseUrl = "https://api.openai.com/v1";
const maxSpeechInputCharacters = 4096;

export function hasOpenAiKey() {
  return Boolean(process.env.OPENAI_API_KEY);
}

export async function generateStory({
  category,
  premise
}: {
  category: StoryCategory;
  premise: string;
}): Promise<GeneratedStory> {
  if (!process.env.OPENAI_API_KEY) {
    return buildDemoStory(category, premise);
  }

  const model = process.env.OPENAI_STORY_MODEL || "gpt-5-mini";
  const response = await fetch(`${openAiBaseUrl}/responses`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model,
      input: [
        {
          role: "system",
          content:
            "You write original fictional Reddit-style stories for vertical short-form videos. Never scrape, quote, or copy real posts. Return JSON only."
        },
        {
          role: "user",
          content: `Create one original ${category} story for a 45-90 second narration.
Premise from user: ${premise || "Surprise me with a high-retention hook."}

Rules:
- Start with an immediate hook.
- Simple conversational first-person language.
- Introduce tension quickly.
- Include curiosity gaps.
- Strong payoff.
- No unnecessary intro.
- Return {"title":"short hook title","story":"full narration"}.`
        }
      ],
      text: {
        format: {
          type: "json_schema",
          name: "storyshorts_story",
          strict: true,
          schema: {
            type: "object",
            additionalProperties: false,
            properties: {
              title: { type: "string" },
              story: { type: "string" }
            },
            required: ["title", "story"]
          }
        }
      }
    })
  });

  if (!response.ok) {
    const details = await safeText(response);
    throw new Error(details || "Story generation failed.");
  }

  const data = await response.json();
  const outputText = extractResponseText(data);

  if (!outputText) {
    throw new Error("The story generator returned an empty response.");
  }

  const parsed = JSON.parse(outputText) as GeneratedStory;
  return {
    title: parsed.title?.trim() || "Generated Reddit Story",
    story: parsed.story?.trim() || ""
  };
}

export async function createNarrationAudio({ text, voice }: { text: string; voice: VoiceId }) {
  if (!process.env.OPENAI_API_KEY) {
    throw new MissingApiKeyError("OpenAI text-to-speech requires OPENAI_API_KEY.");
  }

  if (text.length > maxSpeechInputCharacters) {
    throw new Error(
      `Narration text is ${text.length} characters. OpenAI speech supports up to ${maxSpeechInputCharacters} characters per request.`
    );
  }

  const model = process.env.OPENAI_TTS_MODEL || "gpt-4o-mini-tts";
  console.info("[StoryShorts TTS] Requesting narration", { model, voice, textLength: text.length });
  const response = await fetch(`${openAiBaseUrl}/audio/speech`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model,
      voice,
      input: text,
      response_format: "mp3"
    })
  });

  if (!response.ok) {
    const details = await safeText(response);
    console.error("[StoryShorts TTS] Narration request failed", {
      model,
      voice,
      status: response.status,
      details
    });
    throw new Error(details || "Narration generation failed.");
  }

  console.info("[StoryShorts TTS] Narration request complete", { model, voice });
  return response.arrayBuffer();
}

export class MissingApiKeyError extends Error {
  code = "missing_api_key";
}

async function safeText(response: Response) {
  try {
    const body = (await response.json()) as { error?: { message?: string } };
    return body.error?.message ?? response.statusText;
  } catch {
    return response.statusText;
  }
}

function extractResponseText(data: unknown): string | undefined {
  if (typeof data !== "object" || data === null) {
    return undefined;
  }

  if ("output_text" in data && typeof data.output_text === "string") {
    return data.output_text;
  }

  if (!("output" in data) || !Array.isArray(data.output)) {
    return undefined;
  }

  for (const item of data.output) {
    if (typeof item !== "object" || item === null || !("content" in item) || !Array.isArray(item.content)) {
      continue;
    }

    for (const content of item.content) {
      if (typeof content === "object" && content !== null && "text" in content && typeof content.text === "string") {
        return content.text;
      }
    }
  }

  return undefined;
}

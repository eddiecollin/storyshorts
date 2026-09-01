import { NextResponse } from "next/server";
import { createNarrationAudio, MissingApiKeyError } from "@/lib/openai";
import { voices } from "@/lib/constants";
import type { VoiceId } from "@/types/storyshorts";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { text?: string; voice?: VoiceId };
    const text = body.text?.trim();

    if (!text) {
      return NextResponse.json({ error: "Enter story text before generating narration." }, { status: 400 });
    }

    const voice = voices.some((item) => item.id === body.voice) ? (body.voice as VoiceId) : "nova";
    const audio = await createNarrationAudio({ text, voice });

    return new Response(audio, {
      headers: {
        "Content-Type": "audio/mpeg",
        "Cache-Control": "no-store"
      }
    });
  } catch (error) {
    const status = error instanceof MissingApiKeyError ? 503 : 500;
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Narration generation failed." },
      { status }
    );
  }
}

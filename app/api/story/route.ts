import { NextResponse } from "next/server";
import { generateStory } from "@/lib/openai";
import { storyCategories } from "@/lib/constants";
import type { StoryCategory } from "@/types/storyshorts";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { category?: StoryCategory; premise?: string };
    const category = storyCategories.includes(body.category as StoryCategory) ? (body.category as StoryCategory) : "Unexpected Twist";
    const generated = await generateStory({ category, premise: body.premise ?? "" });
    return NextResponse.json(generated);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Story generation failed." },
      { status: 500 }
    );
  }
}

import type { StoryCategory } from "@/types/storyshorts";

export function buildDemoStory(category: StoryCategory, premise: string) {
  const hook = premise.trim() || "My coworker asked me to cover one shift, and it exposed a secret nobody wanted me to know.";

  return {
    title: hook.length > 72 ? `${hook.slice(0, 69)}...` : hook,
    story: `${hook}

At first, I thought it was just one of those random favors people ask when they are stressed. But the second I walked in, everyone got quiet.

The manager kept checking the back door like he was waiting for someone, and my phone started buzzing with messages from a number I did not recognize. The first message said, "Do not let them know you are there."

I almost left, but then I saw my name printed on the schedule for every night that week. I had never agreed to any of it.

When I opened the office computer, I found a folder with screenshots of fake messages from me begging for extra shifts. Someone had been using my name to cover missing cash.

The twist was that the unknown number belonged to the new hire everyone ignored. She had noticed the pattern weeks earlier and stayed late to help me prove it.

By closing time, the manager was gone, corporate had the screenshots, and the new hire became my favorite person in that building.`,
    demo: true
  };
}

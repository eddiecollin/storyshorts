import { KeyRound, ServerCog, Video } from "lucide-react";

const rows = [
  {
    icon: KeyRound,
    title: "OpenAI API key",
    body: "Add OPENAI_API_KEY in Vercel project settings or in a local .env file to enable story generation and high-quality narration."
  },
  {
    icon: Video,
    title: "Browser rendering",
    body: "The MVP records the preview composition in the browser and transcodes with ffmpeg.wasm, keeping normal Vercel functions lightweight."
  },
  {
    icon: ServerCog,
    title: "Render backend ready",
    body: "The rendering service is isolated in lib/video-rendering.ts so a queue-based worker can replace browser rendering later."
  }
];

export default function SettingsPage() {
  return (
    <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
      <div className="mb-6">
        <p className="text-sm font-medium uppercase text-sky-300">Configuration</p>
        <h1 className="mt-2 text-3xl font-semibold">Settings</h1>
      </div>
      <div className="space-y-4">
        {rows.map((row) => (
          <section key={row.title} className="rounded-lg border border-white/10 bg-[var(--color-panel)] p-5">
            <div className="flex gap-4">
              <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-white text-neutral-950">
                <row.icon size={19} />
              </span>
              <div>
                <h2 className="font-semibold">{row.title}</h2>
                <p className="mt-1 leading-6 text-neutral-400">{row.body}</p>
              </div>
            </div>
          </section>
        ))}
      </div>
    </main>
  );
}

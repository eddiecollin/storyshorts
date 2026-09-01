import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { templates } from "@/lib/templates";

export default function TemplatesPage() {
  return (
    <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <div className="mb-6 flex flex-col gap-2">
        <p className="text-sm font-medium uppercase text-sky-300">Preset formats</p>
        <h1 className="text-3xl font-semibold tracking-normal">Templates</h1>
        <p className="max-w-2xl text-neutral-400">
          Choose a format to prefill the editor with a matching category, hook style, voice direction, and caption preset.
        </p>
      </div>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {templates.map((template) => (
          <Link
            key={template.id}
            href={`/?template=${template.id}`}
            className="group rounded-lg border border-white/10 bg-[var(--color-panel)] p-5 transition hover:border-sky-300/50 hover:bg-white/[0.06]"
          >
            <div className="mb-4 flex items-center justify-between gap-4">
              <h2 className="text-xl font-semibold">{template.name}</h2>
              <ArrowRight className="text-neutral-500 transition group-hover:translate-x-1 group-hover:text-sky-300" size={20} />
            </div>
            <p className="mb-5 text-sm leading-6 text-neutral-400">{template.description}</p>
            <div className="flex flex-wrap gap-2 text-xs text-neutral-300">
              <span className="rounded-md border border-white/10 px-2 py-1">{template.category}</span>
              <span className="rounded-md border border-white/10 px-2 py-1">{template.captionPreset}</span>
              <span className="rounded-md border border-white/10 px-2 py-1">{template.voice}</span>
            </div>
          </Link>
        ))}
      </div>
    </main>
  );
}

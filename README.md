# StoryShorts

StoryShorts is a production-ready Next.js MVP for generating Reddit-style vertical short-form videos for YouTube Shorts, TikTok, and Instagram Reels.

## Install

```bash
npm install
```

## Configure OpenAI

Create a local `.env` file:

```bash
OPENAI_API_KEY=your_api_key_here
OPENAI_STORY_MODEL=gpt-5-mini
OPENAI_TTS_MODEL=gpt-4o-mini-tts
```

Never expose `OPENAI_API_KEY` to the browser. Story generation and text-to-speech are handled through server API routes.

## Run Locally

```bash
npm run dev
```

Open the local URL printed by Next.js.

## Deploy To Vercel

1. Push the repository to GitHub.
2. Import the project in Vercel.
3. Add `OPENAI_API_KEY` in Vercel Environment Variables.
4. Deploy.

No database, auth provider, or persistent storage is required for the MVP.

## Demo Mode

The app still works without `OPENAI_API_KEY`:

- You can type or paste a story.
- The story generator returns a local original demo story and shows a notice.
- Preview can use browser `SpeechSynthesis` when available.
- Captions and gameplay preview work.
- Video export can render gameplay and captions without AI narration.

OpenAI-powered story generation and downloadable narration audio require `OPENAI_API_KEY`.

## Browser Limitations

Rendering happens in the browser and depends on:

- `MediaRecorder`
- canvas `captureStream`
- Web Audio
- `SharedArrayBuffer` support for ffmpeg.wasm

Modern Chromium browsers are the best target. Safari support can vary, especially for recording/transcoding.

## How Rendering Works

The MVP avoids long FFmpeg work inside Vercel serverless functions. Instead:

1. The browser loads the user-supplied MP4, MOV, or WebM gameplay when the format can be decoded by the browser.
2. A 1080x1920 canvas draws the cropped gameplay and animated captions.
3. Web Audio mixes gameplay audio and OpenAI narration when narration is available.
4. `MediaRecorder` records the canvas composition to WebM.
5. `ffmpeg.wasm` transcodes the WebM recording to a 1080x1920 MP4 with H.264 video and AAC audio.

The isolated renderer lives in `lib/video-rendering.ts`.

## Adding A Dedicated Render Backend Later

For heavier production workloads, replace the browser renderer with a job-based backend:

- Upload source assets to object storage.
- Create a render job through an API route.
- Process with a worker using native FFmpeg.
- Store the final MP4 and return a signed download URL.

The current UI already treats rendering as a service with progress updates, so swapping the implementation can be done without rewriting the editor.

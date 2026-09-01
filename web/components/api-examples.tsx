"use client";

import { useState } from "react";
import { CodeBlock } from "@/components/code-block";

const LANGUAGES = [
  { value: "curl", label: "curl" },
  { value: "typescript", label: "TypeScript" },
  { value: "python", label: "Python" },
] as const;

type Language = (typeof LANGUAGES)[number]["value"];

const EXAMPLES: ReadonlyArray<{
  title: string;
  snippets: Record<Language, string>;
}> = [
  {
    title: "Transcribe a URL",
    snippets: {
      curl: "curl 'https://transcriptly.dev/api/transcript?url=https://youtu.be/jNQXAC9IVRw&format=md'",
      typescript: `const url = new URL("https://transcriptly.dev/api/transcript");
url.searchParams.set("url", "https://youtu.be/jNQXAC9IVRw");
url.searchParams.set("format", "md");

const res = await fetch(url);
if (!res.ok) throw new Error(await res.text());
console.log(await res.text());`,
      python: `import requests

r = requests.get(
  "https://transcriptly.dev/api/transcript",
  params={"url": "https://youtu.be/jNQXAC9IVRw", "format": "md"},
)
r.raise_for_status()
print(r.text)`,
    },
  },
  {
    title: "Transcribe an uploaded file",
    snippets: {
      curl: "curl -F 'file=@video.mp4' 'https://transcriptly.dev/api/transcript?format=srt'",
      typescript: `async function transcribe(file: File) {
  const form = new FormData();
  form.append("file", file);
  const res = await fetch("https://transcriptly.dev/api/transcript?format=srt", {
    method: "POST",
    body: form,
  });
  if (!res.ok) throw new Error(await res.text());
  console.log(await res.text());
}`,
      python: `import requests

r = requests.post(
  "https://transcriptly.dev/api/transcript",
  params={"format": "srt"},
  files={"file": open("video.mp4", "rb")},
)
r.raise_for_status()
print(r.text)`,
    },
  },
  {
    title: "Inspect a source",
    snippets: {
      curl: "curl 'https://transcriptly.dev/api/info?url=https://youtu.be/jNQXAC9IVRw'",
      typescript: `const url = new URL("https://transcriptly.dev/api/info");
url.searchParams.set("url", "https://youtu.be/jNQXAC9IVRw");

const res = await fetch(url);
if (!res.ok) throw new Error(await res.text());
console.log(await res.json());`,
      python: `import requests

r = requests.get(
  "https://transcriptly.dev/api/info",
  params={"url": "https://youtu.be/jNQXAC9IVRw"},
)
r.raise_for_status()
print(r.json())`,
    },
  },
  {
    title: "Join the waitlist",
    snippets: {
      curl: "curl -H 'Content-Type: application/json' -d '{\"email\":\"you@example.com\"}' https://transcriptly.dev/api/waitlist",
      typescript: `const res = await fetch("https://transcriptly.dev/api/waitlist", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ email: "you@example.com" }),
});
if (!res.ok) throw new Error(await res.text());
console.log(await res.json());`,
      python: `import requests

r = requests.post(
  "https://transcriptly.dev/api/waitlist",
  json={"email": "you@example.com"},
)
r.raise_for_status()
print(r.json())`,
    },
  },
];

export function ApiExamples() {
  const [language, setLanguage] = useState<Language>("curl");

  return (
    <div className="mt-4 min-w-0 max-w-full">
      <div role="tablist" aria-label="Example language" className="flex flex-wrap gap-2">
        {LANGUAGES.map(({ value, label }) => {
          const active = language === value;

          return (
            <button
              key={value}
              id={`api-language-${value}`}
              type="button"
              role="tab"
              aria-selected={active}
              aria-controls="api-examples-panel"
              onClick={() => setLanguage(value)}
              className={`rounded-lg border border-border px-3 py-1.5 text-xs font-medium transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] active:scale-[0.98] ${
                active
                  ? "border-foreground/25 text-foreground"
                  : "text-muted-foreground hover:border-foreground/25 hover:text-foreground"
              }`}
            >
              {label}
            </button>
          );
        })}
      </div>

      <div
        id="api-examples-panel"
        role="tabpanel"
        aria-labelledby={`api-language-${language}`}
        className="mt-6 min-w-0 space-y-6"
      >
        {EXAMPLES.map(({ title, snippets }) => (
          <div key={title} className="min-w-0">
            <h4 className="text-sm font-semibold text-foreground">{title}</h4>
            <CodeBlock key={language} code={snippets[language]} className="mt-3" />
          </div>
        ))}
      </div>
    </div>
  );
}

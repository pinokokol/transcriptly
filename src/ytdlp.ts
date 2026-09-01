/**
 * YouTube blocks requests from datacenter IPs. Deployments can set
 * YOUTUBE_PROXY_URL (typically a residential proxy) and every yt-dlp call
 * for a YouTube source is routed through it. Other platforms, direct media
 * URLs, and non-proxy setups are unaffected.
 */

const YOUTUBE_HOSTS = new Set(["youtube.com", "youtu.be", "youtube-nocookie.com"]);

export function isYouTubeUrl(input: string): boolean {
  let url: URL;
  try {
    url = new URL(input);
  } catch {
    return false;
  }
  const host = url.hostname.toLowerCase();
  return YOUTUBE_HOSTS.has(host) || host.endsWith(".youtube.com") || host.endsWith(".youtube-nocookie.com");
}

export function ytDlpProxyArgs(
  source: string,
  env: Record<string, string | undefined> = process.env,
): string[] {
  const proxy = env.YOUTUBE_PROXY_URL?.trim();
  if (!proxy || !isYouTubeUrl(source)) return [];
  return ["--proxy", proxy];
}

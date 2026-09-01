import { appendFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isValidEmail(email: string): boolean {
  return email.length <= 254 && EMAIL_PATTERN.test(email);
}

/** The file append is the source of truth; the Discord ping is best-effort. */
export async function recordSignup(
  email: string,
  dataDir: string,
  webhookUrl: string | undefined,
  fetchImplementation: typeof fetch = fetch,
): Promise<void> {
  mkdirSync(dataDir, { recursive: true });
  appendFileSync(join(dataDir, "waitlist.txt"), `${new Date().toISOString()} ${email}\n`);

  if (!webhookUrl) return;
  try {
    await fetchImplementation(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: `waitlist: ${email}` }),
    });
  } catch (error) {
    process.stderr.write(`Discord webhook failed: ${String(error)}\n`);
  }
}

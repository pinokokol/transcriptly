import type { TranscriptSegment } from "./transcribe";

const MAX_SENTENCE_SECONDS = 15;
const MAX_FRAGMENT_GAP_SECONDS = 1.25;

export function cleanWhitespace(text: string): string {
  return text
    .replace(/\s+/g, " ")
    .replace(/\s+([,.;:!?])/g, "$1")
    .trim();
}

function endsSentence(text: string): boolean {
  return /[.!?…][\]})"']?$/.test(text);
}

function joinFragments(left: string, right: string): string {
  return cleanWhitespace(`${left} ${right}`);
}

export function normalizeSegments(
  input: readonly TranscriptSegment[],
): TranscriptSegment[] {
  const cleaned = input
    .map((segment, index) => ({ segment, index }))
    .filter(({ segment }) => segment.text.trim())
    .map(({ segment, index }) => {
      const start = Number.isFinite(segment.start) ? Math.max(0, segment.start) : 0;
      const rawEnd = Number.isFinite(segment.end) ? segment.end : start;
      return {
        index,
        start,
        end: Math.max(start, rawEnd),
        text: cleanWhitespace(segment.text),
      };
    })
    .sort((left, right) => left.start - right.start || left.index - right.index);

  const merged: TranscriptSegment[] = [];
  for (const segment of cleaned) {
    const current = merged[merged.length - 1];
    const gap = current ? segment.start - current.end : Number.POSITIVE_INFINITY;
    const canMerge =
      current &&
      !endsSentence(current.text) &&
      gap <= MAX_FRAGMENT_GAP_SECONDS &&
      segment.end - current.start <= MAX_SENTENCE_SECONDS;

    if (current && canMerge) {
      current.text = joinFragments(current.text, segment.text);
      current.end = Math.max(current.end, segment.end);
      continue;
    }

    const previousEnd = merged[merged.length - 1]?.end ?? 0;
    const start = Math.max(segment.start, previousEnd);
    merged.push({ start, end: Math.max(start, segment.end), text: segment.text });
  }

  return merged;
}

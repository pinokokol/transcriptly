import { describe, expect, test } from "bun:test";

import { cleanWhitespace, normalizeSegments } from "../src/normalize";

describe("normalizeSegments", () => {
  test("cleans text, orders cues, merges fragments, and repairs timestamps", () => {
    expect(
      normalizeSegments([
        { start: 1.1, end: 2, text: "a test." },
        { start: -1, end: 0.5, text: "  Hello  ,   world " },
        { start: 0.4, end: 1, text: "this is" },
        { start: 1.8, end: 1.7, text: "Next sentence." },
        { start: Number.NaN, end: Number.NaN, text: "" },
      ]),
    ).toEqual([
      { start: 0, end: 2, text: "Hello, world this is a test." },
      { start: 2, end: 2, text: "Next sentence." },
    ]);
  });

  test("does not merge across a large gap", () => {
    expect(
      normalizeSegments([
        { start: 0, end: 1, text: "fragment" },
        { start: 3, end: 4, text: "later" },
      ]),
    ).toHaveLength(2);
  });
});

test("cleanWhitespace removes spacing before punctuation", () => {
  expect(cleanWhitespace(" one   two  , three ! ")).toBe("one two, three!");
});

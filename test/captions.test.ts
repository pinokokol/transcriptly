import { describe, expect, test } from "bun:test";

import { dedupeCaptionSegments, parseVtt } from "../src/captions";

describe("parseVtt", () => {
  test("parses cue identifiers, settings, markup, and entities", () => {
    const vtt = `\uFEFFWEBVTT

NOTE generated captions
ignored

cue-1
00:00:00.000 --> 00:00:02.000 align:start position:0%
<v Speaker>Hello&nbsp; &amp; welcome</v>

00:00:02.100 --> 00:00:04.250
to <b>the zoo</b>.
`;

    expect(parseVtt(vtt)).toEqual([
      { start: 0, end: 2, text: "Hello & welcome" },
      { start: 2.1, end: 4.25, text: "to the zoo." },
    ]);
  });

  test("dedupes text rolled forward by automatic captions", () => {
    const vtt = `WEBVTT

00:00:00.000 --> 00:00:02.000
hello world

00:00:01.500 --> 00:00:03.500
hello world
this is

00:00:03.250 --> 00:00:05.000
this is a test
`;

    expect(parseVtt(vtt)).toEqual([
      { start: 0, end: 2, text: "hello world" },
      { start: 1.5, end: 3.5, text: "this is" },
      { start: 3.25, end: 5, text: "a test" },
    ]);
  });
});

describe("dedupeCaptionSegments", () => {
  test("drops a fully repeated overlapping cue and extends its end", () => {
    expect(
      dedupeCaptionSegments([
        { start: 0, end: 1, text: "same cue" },
        { start: 0.8, end: 2, text: "same cue" },
      ]),
    ).toEqual([{ start: 0, end: 2, text: "same cue" }]);
  });

  test("keeps repeated words when cues do not overlap in time", () => {
    expect(
      dedupeCaptionSegments([
        { start: 0, end: 1, text: "again" },
        { start: 3, end: 4, text: "again" },
      ]),
    ).toHaveLength(2);
  });
});

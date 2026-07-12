const formatWatchtime = require("../../src/utils/formatWatchtime");

// Characterization test for formatWatchtime (pure function: minutes -> string).
// These expected values were derived by reasoning through the ORIGINAL implementation
// in src/utils/formatWatchtime.js BEFORE any refactor, to pin current behavior.
//
// Notable quirks captured here that a naive "top-2 non-zero units" rule would miss:
//  - Under years>0 with months==0 && weeks==0, lower units (days/hours/mins) are DROPPED -> just "Na".
//  - Under years>0 with months==0 && weeks>0, weeks is terminal -> "Na Ms" and days/hours/mins dropped.
//  - Under years>0 with months>0, weeks is DROPPED (only months/days/hours/mins sub-branch runs).
//  - Up to 4 parts can be emitted (e.g. "1a 1m 1d 1h").
//  - Sub-minute fractions round via Math.round; 0.4 -> "0min", 0.5 -> "1min".

const MIN = 1;
const HOUR = 60;
const DAY = 60 * 24; // 1440
const WEEK = 60 * 24 * 7; // 10080
const MONTH = 60 * 24 * 30; // 43200
const YEAR = 60 * 24 * 365; // 525600

describe("formatWatchtime - characterization", () => {
  describe("zero / falsy inputs", () => {
    test.each([
      ["0", 0],
      ["undefined", undefined],
      ["null", null],
      ["false", false],
      ["NaN", NaN],
      ["empty string", ""],
    ])("returns '0 min' for %s", (_label, input) => {
      expect(formatWatchtime(input)).toBe("0 min");
    });
  });

  describe("sub-minute rounding", () => {
    test("0.4 rounds down to 0 -> '0min'", () => {
      expect(formatWatchtime(0.4)).toBe("0min");
    });
    test("0.5 rounds up to 1 -> '1min'", () => {
      expect(formatWatchtime(0.5)).toBe("1min");
    });
  });

  describe("pure minutes", () => {
    test.each([
      [1, "1min"],
      [30, "30min"],
      [59, "59min"],
    ])("%i min -> '%s'", (input, expected) => {
      expect(formatWatchtime(input)).toBe(expected);
    });
  });

  describe("hours", () => {
    test("exactly 60 -> '1h'", () => {
      expect(formatWatchtime(60)).toBe("1h");
    });
    test.each([
      [120, "2h"],
      [180, "3h"],
    ])("%i -> '%s'", (input, expected) => {
      expect(formatWatchtime(input)).toBe(expected);
    });
    // Quirk: the top-level hours branch does NOT append minutes (mins dropped).
    test.each([
      [90, "1h"],
      [125, "2h"],
    ])("%i -> '%s' (standalone hours drops mins)", (input, expected) => {
      expect(formatWatchtime(input)).toBe(expected);
    });
  });

  describe("days", () => {
    test("exactly 1440 (1 day) -> '1d'", () => {
      expect(formatWatchtime(DAY)).toBe("1d");
    });
    test.each([
      [2880, "2d"],
      [4320, "3d"],
    ])("%i -> '%s' (days only)", (input, expected) => {
      expect(formatWatchtime(input)).toBe(expected);
    });
    test.each([
      [1500, "1d 1h"],
      [2820, "1d 23h"],
    ])("%i -> '%s' (days+hours)", (input, expected) => {
      expect(formatWatchtime(input)).toBe(expected);
    });
    test.each([
      [1470, "1d 30min"],
      [1499, "1d 59min"],
    ])("%i -> '%s' (days+min, no hours)", (input, expected) => {
      expect(formatWatchtime(input)).toBe(expected);
    });
  });

  describe("weeks", () => {
    test("exactly 10080 (1 week) -> '1s'", () => {
      expect(formatWatchtime(WEEK)).toBe("1s");
    });
    test.each([
      [20160, "2s"],
      [30240, "3s"],
    ])("%i -> '%s' (weeks only)", (input, expected) => {
      expect(formatWatchtime(input)).toBe(expected);
    });
    test.each([
      [11520, "1s 1d"],
      [12960, "1s 2d"],
    ])("%i -> '%s' (weeks+days)", (input, expected) => {
      expect(formatWatchtime(input)).toBe(expected);
    });
    test("weeks+days+hours -> 3 parts", () => {
      expect(formatWatchtime(WEEK + DAY + HOUR)).toBe("1s 1d 1h");
    });
    test("weeks+days+mins (no hours) -> 3 parts", () => {
      expect(formatWatchtime(WEEK + DAY + 30)).toBe("1s 1d 30min");
    });
    test("weeks+hours (no days) -> 2 parts", () => {
      expect(formatWatchtime(WEEK + HOUR)).toBe("1s 1h");
    });
    test("weeks+mins (no days) -> 2 parts", () => {
      expect(formatWatchtime(WEEK + 30)).toBe("1s 30min");
    });
  });

  describe("months", () => {
    test("exactly 43200 (1 month) -> '1m'", () => {
      expect(formatWatchtime(MONTH)).toBe("1m");
    });
    test.each([
      [86400, "2m"],
      [129600, "3m"],
    ])("%i -> '%s' (months only)", (input, expected) => {
      expect(formatWatchtime(input)).toBe(expected);
    });
    test("months+days -> '1m 1d'", () => {
      expect(formatWatchtime(MONTH + DAY)).toBe("1m 1d");
    });
    test("months+days+hours -> 3 parts", () => {
      expect(formatWatchtime(MONTH + DAY + HOUR)).toBe("1m 1d 1h");
    });
    test("months+days+mins (no hours) -> 3 parts", () => {
      expect(formatWatchtime(MONTH + DAY + 30)).toBe("1m 1d 30min");
    });
    test("months+hours (no days) -> 2 parts", () => {
      expect(formatWatchtime(MONTH + HOUR)).toBe("1m 1h");
    });
    test("months+mins (no days) -> 2 parts", () => {
      expect(formatWatchtime(MONTH + 30)).toBe("1m 30min");
    });
  });

  describe("years", () => {
    test("exactly 525600 (1 year in minutes) -> '1a'", () => {
      expect(formatWatchtime(YEAR)).toBe("1a");
    });
    test.each([
      [YEAR * 2, "2a"],
      [YEAR * 3, "3a"],
    ])("%i -> '%s' (years only)", (input, expected) => {
      expect(formatWatchtime(input)).toBe(expected);
    });

    // years + months sub-branch (weeks is DROPPED here)
    test("years+months -> '1a 1m'", () => {
      expect(formatWatchtime(YEAR + MONTH)).toBe("1a 1m");
    });
    test("years+months+days -> 3 parts", () => {
      expect(formatWatchtime(YEAR + MONTH + DAY)).toBe("1a 1m 1d");
    });
    test("years+months+days+hours -> 4 parts", () => {
      expect(formatWatchtime(YEAR + MONTH + DAY + HOUR)).toBe("1a 1m 1d 1h");
    });
    test("years+months+days+mins (no hours) -> 4 parts", () => {
      expect(formatWatchtime(YEAR + MONTH + DAY + 30)).toBe("1a 1m 1d 30min");
    });
    test("years+months+hours (no days) -> 3 parts", () => {
      expect(formatWatchtime(YEAR + MONTH + HOUR)).toBe("1a 1m 1h");
    });
    test("years+months+mins (no days) -> 3 parts", () => {
      expect(formatWatchtime(YEAR + MONTH + 30)).toBe("1a 1m 30min");
    });
    test("years+months+weeks+days -> weeks DROPPED (only '1a 1m 1d')", () => {
      expect(formatWatchtime(YEAR + MONTH + WEEK + DAY)).toBe("1a 1m 1d");
    });

    // years + weeks sub-branch (months==0): weeks is TERMINAL
    test("years+weeks (months==0) -> '1a 1s'", () => {
      expect(formatWatchtime(YEAR + WEEK)).toBe("1a 1s");
    });
    test("years+weeks+days (months==0) -> days DROPPED, still '1a 1s'", () => {
      expect(formatWatchtime(YEAR + WEEK + DAY)).toBe("1a 1s");
    });
    test("years+weeks+hours (months==0) -> hours DROPPED, still '1a 1s'", () => {
      expect(formatWatchtime(YEAR + WEEK + HOUR)).toBe("1a 1s");
    });

    // years with months==0 && weeks==0: ALL lower units dropped -> just 'Na'
    test("years+days (months==0, weeks==0) -> days DROPPED, just '1a'", () => {
      expect(formatWatchtime(YEAR + DAY)).toBe("1a");
    });
    test("years+hours (months==0, weeks==0) -> hours DROPPED, just '1a'", () => {
      expect(formatWatchtime(YEAR + HOUR)).toBe("1a");
    });
    test("years+mins (months==0, weeks==0) -> mins DROPPED, just '1a'", () => {
      expect(formatWatchtime(YEAR + MIN)).toBe("1a");
    });
  });

  describe("multi-year composite", () => {
    test("2 years + 3 months + 5 days + 4 hours -> '2a 3m 5d 4h'", () => {
      expect(formatWatchtime(YEAR * 2 + MONTH * 3 + DAY * 5 + HOUR * 4)).toBe(
        "2a 3m 5d 4h"
      );
    });
    test("1 year + 2 weeks (months==0) -> '1a 2s'", () => {
      expect(formatWatchtime(YEAR + WEEK * 2)).toBe("1a 2s");
    });
  });
});

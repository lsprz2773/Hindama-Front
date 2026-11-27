import { describe, expect, it } from "vitest";
import { formatCountdown } from "./use-countdown";

describe("formatCountdown", () => {
  it.each([
    [42, "0:42"],
    [5, "0:05"],
    [60, "1:00"],
    [125, "2:05"],
    [0, "0:00"],
    [-3, "0:00"],
  ])("%i s → %s", (seconds, expected) => {
    expect(formatCountdown(seconds)).toBe(expected);
  });
});

import type { Difficulty } from "./types";

/** Color classes per difficulty. Centralized so the ramp reads consistently
 *  across cards, badges, and the detail page. */
export const DIFFICULTY_STYLES: Record<
  Difficulty,
  { text: string; bg: string; rail: string }
> = {
  Easy: { text: "text-diff-easy", bg: "bg-diff-easy-bg", rail: "bg-diff-easy" },
  Medium: { text: "text-diff-medium", bg: "bg-diff-medium-bg", rail: "bg-diff-medium" },
  Hard: { text: "text-diff-hard", bg: "bg-diff-hard-bg", rail: "bg-diff-hard" },
};

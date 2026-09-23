// §32 — shared priority styling for flagged (Needs Attention) jobs. Used by
// the Messages inbox; extracted out of the old run-sheet NeedsAttention
// component so the styling has one source rather than being reinvented.
import type { Job } from "./run-sheet";

export type Priority = NonNullable<Job["attention_priority"]>;

export const PRIORITY_STYLES: Record<Priority, string> = {
  low: "border-rig-700/20 bg-white",
  medium: "border-amber-500/40 bg-amber-500/10",
  high: "border-rust-500/40 bg-rust-500/10",
};

export const PRIORITY_LABELS: Record<Priority, string> = {
  low: "Low",
  medium: "Medium",
  high: "High",
};

export const PRIORITY_ORDER: Record<Priority, number> = { high: 0, medium: 1, low: 2 };

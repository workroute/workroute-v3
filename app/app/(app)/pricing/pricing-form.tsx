"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Question } from "@/lib/trade-questions";
import type { TradePricingConfig, QuestionPricing, OptionPricing } from "@/lib/trade-pricing";

// One row = one thing the tradie can attach a price/duration adjustment to.
// Every question type collapses down to this same shape (select/multiselect
// options, boolean's two branches, quantity's per-unit rate) — that's what
// lets this one screen drive pricing for any trade without bespoke UI per
// question type (§31). dependsOnQuestionId/dependentValues (§edging-by-size)
// are only used when a row's price should vary by another select question's
// answer (e.g. Edging costing a different amount per Lawn size) instead of
// one flat number regardless of that other answer.
type RowDraft = {
  priceDelta: number;
  durationDelta: number;
  requiresQuote: boolean;
  dependsOnQuestionId: string | null;
  dependentValues: Record<string, { priceDelta: number; durationDelta: number }>;
};
type Row = { key: string; label: string; allowQuote: boolean; allowDependency: boolean };

const ZERO_ROW: RowDraft = {
  priceDelta: 0,
  durationDelta: 0,
  requiresQuote: false,
  dependsOnQuestionId: null,
  dependentValues: {},
};

// Which other select questions in this trade a row is allowed to vary by —
// only plain "select" questions make sense as a dependency (a fixed, known
// set of values to key prices off), and a question can't depend on itself.
function dependencyCandidates(questions: Question[], excludeQuestionId: string): Question[] {
  return questions.filter((q) => q.id !== excludeQuestionId && q.type === "select");
}

function rowsForQuestion(question: Question, questions: Question[]): Row[] {
  const hasDependencyCandidates = dependencyCandidates(questions, question.id).length > 0;
  if (question.type === "select" || question.type === "multiselect") {
    return question.options.map((opt) => ({
      key: opt.value,
      label: opt.label,
      allowQuote: true,
      allowDependency: hasDependencyCandidates,
    }));
  }
  if (question.type === "boolean") {
    return [
      { key: "true", label: "If Yes", allowQuote: true, allowDependency: hasDependencyCandidates },
      { key: "false", label: "If No", allowQuote: true, allowDependency: hasDependencyCandidates },
    ];
  }
  if (question.type === "quantity") {
    return [{ key: "perUnit", label: `Per ${question.unit}`, allowQuote: false, allowDependency: false }];
  }
  return []; // "text" — free-form answers aren't priced
}

function toRowDraft(opt: OptionPricing | undefined): RowDraft {
  if (!opt) return ZERO_ROW;
  if ("requiresQuote" in opt) return { ...ZERO_ROW, requiresQuote: true };
  if ("dependsOnQuestionId" in opt) {
    return { ...ZERO_ROW, dependsOnQuestionId: opt.dependsOnQuestionId, dependentValues: opt.values };
  }
  return { ...ZERO_ROW, priceDelta: opt.priceDelta, durationDelta: opt.durationDelta };
}

function toOptionPricing(row: RowDraft): OptionPricing {
  if (row.requiresQuote) return { requiresQuote: true };
  if (row.dependsOnQuestionId) {
    return { dependsOnQuestionId: row.dependsOnQuestionId, values: row.dependentValues };
  }
  return { priceDelta: row.priceDelta, durationDelta: row.durationDelta };
}

// Reads the saved config (real QuestionPricing shapes, one variant per
// question type) into the flat per-row draft shape the form edits.
function hydrate(
  questions: Question[],
  config: TradePricingConfig | null
): Record<string, Record<string, RowDraft>> {
  const result: Record<string, Record<string, RowDraft>> = {};

  for (const q of questions) {
    const qp = config?.questions[q.id];
    const rows: Record<string, RowDraft> = {};

    if (q.type === "select") {
      for (const opt of q.options) {
        rows[opt.value] = toRowDraft(qp && qp.type === "select" ? qp.options[opt.value] : undefined);
      }
    } else if (q.type === "multiselect") {
      for (const opt of q.options) {
        rows[opt.value] = toRowDraft(qp && qp.type === "multiselect" ? qp.options[opt.value] : undefined);
      }
    } else if (q.type === "boolean") {
      rows["true"] = toRowDraft(qp && qp.type === "boolean" ? qp.onTrue : undefined);
      rows["false"] = toRowDraft(qp && qp.type === "boolean" ? qp.onFalse : undefined);
    } else if (q.type === "quantity") {
      const perUnit = qp && qp.type === "quantity" ? qp.perUnit : undefined;
      rows["perUnit"] = perUnit
        ? { ...ZERO_ROW, priceDelta: perUnit.priceDelta, durationDelta: perUnit.durationDelta }
        : ZERO_ROW;
    }
    // "text" — no rows, nothing to hydrate.

    result[q.id] = rows;
  }

  return result;
}

// Only select/boolean/multiselect are previewed in the live example below —
// this trade's question set has no "quantity" questions, and the example
// exists to demystify the additive select/multiselect/boolean math (the
// thing tradies actually get confused by), not to reproduce every question
// type in miniature.
type ExampleSelections = Record<string, string | string[]>;

function defaultExampleSelections(questions: Question[]): ExampleSelections {
  const selections: ExampleSelections = {};
  for (const q of questions) {
    if (q.type === "select") selections[q.id] = q.options[0]?.value ?? "";
    else if (q.type === "multiselect") selections[q.id] = [];
    else if (q.type === "boolean") selections[q.id] = "false";
  }
  return selections;
}

// The same additive logic as computeEstimate (lib/trade-pricing.ts), but run
// entirely client-side against whatever's currently typed into the form
// (including unsaved changes) — the whole point is to answer "does this
// actually add on top, live," not to hit the server for a preview.
function computeExampleTotal(
  basePrice: number,
  baseDurationMinutes: number,
  questions: Question[],
  rows: Record<string, Record<string, RowDraft>>,
  selections: ExampleSelections
): { price: number; duration: number; quoteRequired: boolean } {
  let price = basePrice;
  let duration = baseDurationMinutes;
  let quoteRequired = false;

  function applyDraft(draft: RowDraft | undefined) {
    if (!draft) return;
    if (draft.requiresQuote) {
      quoteRequired = true;
      return;
    }
    if (draft.dependsOnQuestionId) {
      const dependencyAnswer = selections[draft.dependsOnQuestionId] as string | undefined;
      const adj = (dependencyAnswer && draft.dependentValues[dependencyAnswer]) || { priceDelta: 0, durationDelta: 0 };
      price += adj.priceDelta;
      duration += adj.durationDelta;
      return;
    }
    price += draft.priceDelta;
    duration += draft.durationDelta;
  }

  for (const q of questions) {
    const qRows = rows[q.id];
    if (!qRows) continue;

    if (q.type === "select" || q.type === "boolean") {
      const key = selections[q.id] as string | undefined;
      if (key) applyDraft(qRows[key]);
    } else if (q.type === "multiselect") {
      const keys = (selections[q.id] as string[] | undefined) ?? [];
      for (const key of keys) applyDraft(qRows[key]);
    }
  }

  return { price, duration, quoteRequired };
}

export default function PricingForm({
  businessId,
  trade,
  questions,
  initialConfig,
}: {
  businessId: string;
  trade: string;
  questions: Question[];
  initialConfig: TradePricingConfig | null;
}) {
  const [basePrice, setBasePrice] = useState(initialConfig?.basePrice ?? 0);
  const [baseDurationMinutes, setBaseDurationMinutes] = useState(initialConfig?.baseDurationMinutes ?? 0);
  const [rows, setRows] = useState(() => hydrate(questions, initialConfig));
  const [exampleSelections, setExampleSelections] = useState(() => defaultExampleSelections(questions));
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState("");

  const example = computeExampleTotal(basePrice, baseDurationMinutes, questions, rows, exampleSelections);

  function updateRow(questionId: string, rowKey: string, patch: Partial<RowDraft>) {
    setRows((prev) => ({
      ...prev,
      [questionId]: { ...prev[questionId], [rowKey]: { ...prev[questionId][rowKey], ...patch } },
    }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("saving");
    setErrorMessage("");

    const questionPricing: Record<string, QuestionPricing> = {};
    for (const q of questions) {
      const qRows = rows[q.id];

      if (q.type === "select") {
        const options: Record<string, OptionPricing> = {};
        for (const opt of q.options) options[opt.value] = toOptionPricing(qRows[opt.value]);
        questionPricing[q.id] = { type: "select", options };
      } else if (q.type === "multiselect") {
        const options: Record<string, OptionPricing> = {};
        for (const opt of q.options) options[opt.value] = toOptionPricing(qRows[opt.value]);
        questionPricing[q.id] = { type: "multiselect", options };
      } else if (q.type === "boolean") {
        questionPricing[q.id] = {
          type: "boolean",
          onTrue: toOptionPricing(qRows["true"]),
          onFalse: toOptionPricing(qRows["false"]),
        };
      } else if (q.type === "quantity") {
        const row = qRows["perUnit"];
        questionPricing[q.id] = {
          type: "quantity",
          perUnit: { priceDelta: row.priceDelta, durationDelta: row.durationDelta },
        };
      }
      // "text" questions get no entry — computeEstimate skips missing ids.
    }

    const supabase = createClient();
    const { error } = await supabase.from("trade_pricing_configs").upsert(
      {
        business_id: businessId,
        trade,
        base_price: basePrice,
        base_duration_minutes: baseDurationMinutes,
        question_pricing: questionPricing,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "business_id,trade" }
    );

    if (error) {
      setStatus("error");
      setErrorMessage(error.message);
      return;
    }

    setStatus("saved");
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="field-label">Base price</label>
          <input
            type="number"
            min={0}
            step="0.01"
            value={basePrice}
            onChange={(e) => setBasePrice(Number(e.target.value))}
            className="field-input"
          />
        </div>
        <div>
          <label className="field-label">Base duration (min)</label>
          <input
            type="number"
            min={0}
            value={baseDurationMinutes}
            onChange={(e) => setBaseDurationMinutes(Number(e.target.value))}
            className="field-input"
          />
        </div>
      </div>
      <p className="text-xs text-rig-700/60">
        Every {trade} job starts here — each answer below adds or subtracts from it.
      </p>

      {questions.map((q) => {
        const qRows = rowsForQuestion(q, questions);
        if (qRows.length === 0) return null;
        return (
          <div key={q.id} className="border-t border-rig-900/10 pt-4">
            <p className="font-mono text-xs uppercase tracking-widest text-steel-500">{q.label}</p>
            <div className="mt-3 space-y-3">
              {qRows.map((row) => {
                const draft = rows[q.id]?.[row.key] ?? ZERO_ROW;
                const dependencyQuestion = draft.dependsOnQuestionId
                  ? questions.find((other) => other.id === draft.dependsOnQuestionId)
                  : undefined;
                return (
                  <div key={row.key} className="rounded border border-rig-700/10 p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-sm font-medium text-rig-900">{row.label}</p>
                      <div className="flex items-center gap-3">
                        {row.allowDependency && !draft.requiresQuote && (
                          <label className="flex items-center gap-2 text-xs text-rig-700">
                            Vary by
                            <select
                              value={draft.dependsOnQuestionId ?? ""}
                              onChange={(e) =>
                                updateRow(q.id, row.key, {
                                  dependsOnQuestionId: e.target.value || null,
                                  dependentValues: {},
                                })
                              }
                              className="field-input !w-auto py-1 text-xs"
                            >
                              <option value="">Flat price</option>
                              {dependencyCandidates(questions, q.id).map((dep) => (
                                <option key={dep.id} value={dep.id}>
                                  {dep.label}
                                </option>
                              ))}
                            </select>
                          </label>
                        )}
                        {row.allowQuote && (
                          <label className="flex items-center gap-2 text-xs text-rig-700">
                            <input
                              type="checkbox"
                              checked={draft.requiresQuote}
                              onChange={(e) => updateRow(q.id, row.key, { requiresQuote: e.target.checked })}
                              className="h-4 w-4 rounded border-rig-700/30"
                            />
                            Requires quote
                          </label>
                        )}
                      </div>
                    </div>
                    {!draft.requiresQuote && dependencyQuestion && dependencyQuestion.type === "select" && (
                      <div className="mt-2 space-y-2">
                        {dependencyQuestion.options.map((depOpt) => {
                          const value = draft.dependentValues[depOpt.value] ?? { priceDelta: 0, durationDelta: 0 };
                          return (
                            <div key={depOpt.value} className="grid grid-cols-[auto,1fr,1fr] items-center gap-3">
                              <span className="text-xs font-medium text-rig-700">{depOpt.label}</span>
                              <input
                                type="number"
                                step="0.01"
                                placeholder="Price adj ($)"
                                value={value.priceDelta}
                                onChange={(e) =>
                                  updateRow(q.id, row.key, {
                                    dependentValues: {
                                      ...draft.dependentValues,
                                      [depOpt.value]: { ...value, priceDelta: Number(e.target.value) },
                                    },
                                  })
                                }
                                className="field-input text-xs"
                              />
                              <input
                                type="number"
                                placeholder="Duration adj (min)"
                                value={value.durationDelta}
                                onChange={(e) =>
                                  updateRow(q.id, row.key, {
                                    dependentValues: {
                                      ...draft.dependentValues,
                                      [depOpt.value]: { ...value, durationDelta: Number(e.target.value) },
                                    },
                                  })
                                }
                                className="field-input text-xs"
                              />
                            </div>
                          );
                        })}
                      </div>
                    )}
                    {!draft.requiresQuote && !dependencyQuestion && (
                      <div className="mt-2 grid grid-cols-2 gap-3">
                        <div>
                          <label className="text-xs text-rig-700/70">Price adj ($)</label>
                          <input
                            type="number"
                            step="0.01"
                            value={draft.priceDelta}
                            onChange={(e) => updateRow(q.id, row.key, { priceDelta: Number(e.target.value) })}
                            className="field-input mt-1"
                          />
                        </div>
                        <div>
                          <label className="text-xs text-rig-700/70">Duration adj (min)</label>
                          <input
                            type="number"
                            value={draft.durationDelta}
                            onChange={(e) => updateRow(q.id, row.key, { durationDelta: Number(e.target.value) })}
                            className="field-input mt-1"
                          />
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}

      <div className="rounded-lg border-2 border-steel-500/30 bg-steel-500/5 p-4">
        <p className="font-mono text-xs uppercase tracking-widest text-steel-500">Try an example</p>
        <p className="mt-1 text-xs text-rig-700">
          Pick what a customer might say, and see exactly what Sarah would quote them — using the numbers
          above, even before you save.
        </p>

        <div className="mt-3 space-y-3">
          {questions.map((q) => {
            if (q.type === "select") {
              return (
                <div key={q.id}>
                  <label className="text-xs font-medium text-rig-700">{q.label}</label>
                  <select
                    value={(exampleSelections[q.id] as string) ?? ""}
                    onChange={(e) => setExampleSelections((prev) => ({ ...prev, [q.id]: e.target.value }))}
                    className="field-input mt-1"
                  >
                    {q.options.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>
              );
            }
            if (q.type === "boolean") {
              return (
                <div key={q.id}>
                  <label className="text-xs font-medium text-rig-700">{q.label}</label>
                  <select
                    value={(exampleSelections[q.id] as string) ?? "false"}
                    onChange={(e) => setExampleSelections((prev) => ({ ...prev, [q.id]: e.target.value }))}
                    className="field-input mt-1"
                  >
                    <option value="false">No</option>
                    <option value="true">Yes</option>
                  </select>
                </div>
              );
            }
            if (q.type === "multiselect") {
              const selected = (exampleSelections[q.id] as string[] | undefined) ?? [];
              return (
                <div key={q.id}>
                  <label className="text-xs font-medium text-rig-700">{q.label}</label>
                  <div className="mt-1 flex flex-wrap gap-2">
                    {q.options.map((opt) => {
                      const isOn = selected.includes(opt.value);
                      return (
                        <button
                          key={opt.value}
                          type="button"
                          onClick={() =>
                            setExampleSelections((prev) => {
                              const current = (prev[q.id] as string[] | undefined) ?? [];
                              const next = isOn
                                ? current.filter((v) => v !== opt.value)
                                : [...current, opt.value];
                              return { ...prev, [q.id]: next };
                            })
                          }
                          className={`rounded-full border px-3 py-1 text-xs font-medium ${
                            isOn
                              ? "border-steel-500 bg-steel-500 text-white"
                              : "border-rig-700/20 bg-white text-rig-700"
                          }`}
                        >
                          {opt.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            }
            return null;
          })}
        </div>

        <div className="mt-4 border-t border-steel-500/20 pt-3">
          {example.quoteRequired ? (
            <p className="font-display text-lg font-bold text-amber-600">Would need a manual quote</p>
          ) : (
            <p className="font-display text-lg font-bold text-rig-900">
              ${example.price.toFixed(2)}{" "}
              <span className="text-sm font-normal text-rig-700">(~{example.duration} min)</span>
            </p>
          )}
          <p className="mt-0.5 text-xs text-rig-700/60">
            ${basePrice.toFixed(2)} base, plus whatever's selected above — this is exactly what Sarah would say
            on a real call with these answers.
          </p>
        </div>
      </div>

      {/* §pricing-sticky-save — this form runs long (a section per question,
          each with its own nested "Vary by" sub-rows), so a save button only
          at the natural end of the document meant scrolling the whole way
          down after every single edit. Sticky keeps it reachable without
          losing where you were in the form. bottom-16 clears the fixed
          mobile bottom nav; desktop has no such nav, hence bottom-0 there. */}
      <div className="sticky bottom-16 z-30 -mx-6 -mb-6 space-y-2 border-t border-rig-900/10 bg-white/95 px-6 py-4 backdrop-blur md:bottom-0 md:rounded-b-lg">
        {status === "error" && (
          <p className="rounded bg-rust-500/10 px-3 py-2 text-sm text-rust-500">{errorMessage}</p>
        )}
        {status === "saved" && (
          <p className="rounded bg-moss-500/10 px-3 py-2 text-sm text-moss-500">Saved.</p>
        )}

        <button type="submit" disabled={status === "saving"} className="btn-primary w-full">
          {status === "saving" ? "Saving…" : "Save pricing"}
        </button>
      </div>
    </form>
  );
}

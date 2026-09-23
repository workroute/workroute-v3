"use client";

import type { Question } from "@/lib/trade-questions";

export default function TradeQuestionField({
  question,
  value,
  onChange,
}: {
  question: Question;
  value: any;
  onChange: (id: string, value: any) => void;
}) {
  if (question.type === "text") {
    return (
      <div>
        <label className="field-label">{question.label}</label>
        <input
          value={value ?? ""}
          onChange={(e) => onChange(question.id, e.target.value)}
          className="field-input"
          placeholder={question.placeholder}
        />
      </div>
    );
  }

  if (question.type === "select") {
    return (
      <div>
        <label className="field-label">{question.label}</label>
        <select
          value={value ?? ""}
          onChange={(e) => onChange(question.id, e.target.value)}
          className="field-input"
        >
          <option value="" disabled>
            Select one
          </option>
          {question.options.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>
    );
  }

  if (question.type === "multiselect") {
    const selected: string[] = Array.isArray(value) ? value : [];
    function toggle(optValue: string) {
      const next = selected.includes(optValue)
        ? selected.filter((v) => v !== optValue)
        : [...selected, optValue];
      onChange(question.id, next);
    }
    return (
      <div>
        <label className="field-label">{question.label}</label>
        <div className="flex flex-wrap gap-2">
          {question.options.map((opt) => {
            const active = selected.includes(opt.value);
            return (
              <button
                type="button"
                key={opt.value}
                onClick={() => toggle(opt.value)}
                className={`rounded-full border px-3 py-1.5 text-sm transition ${
                  active
                    ? "border-amber-600 bg-amber-500 text-rig-950"
                    : "border-rig-700/20 bg-white text-rig-700 hover:bg-paper-100"
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

  if (question.type === "quantity") {
    return (
      <div>
        <label className="field-label">{question.label}</label>
        <div className="flex items-center gap-2">
          <input
            type="number"
            min={question.min ?? 0}
            max={question.max}
            value={value ?? ""}
            onChange={(e) => onChange(question.id, e.target.value === "" ? "" : Number(e.target.value))}
            className="field-input"
          />
          <span className="text-sm text-rig-700">{question.unit}</span>
        </div>
      </div>
    );
  }

  if (question.type === "boolean") {
    return (
      <div>
        <label className="field-label">{question.label}</label>
        <div className="flex gap-2">
          {["Yes", "No"].map((opt) => {
            const active = value === (opt === "Yes");
            return (
              <button
                type="button"
                key={opt}
                onClick={() => onChange(question.id, opt === "Yes")}
                className={`rounded border px-4 py-2 text-sm transition ${
                  active
                    ? "border-amber-600 bg-amber-500 text-rig-950"
                    : "border-rig-700/20 bg-white text-rig-700 hover:bg-paper-100"
                }`}
              >
                {opt}
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  return null;
}

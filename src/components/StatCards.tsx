import { memo, useMemo, useState } from "react";
import type { Problem } from "../appTypes";
import { buildRecallPrompts } from "../utils/problemUtils";

export function StatCard({
  label,
  value,
  hint,
  onClick,
  isActive,
}: {
  label: string;
  value: number;
  hint: string;
  onClick?: () => void;
  isActive?: boolean;
}) {
  if (onClick) {
    return (
      <button
        className={`stat-card stat-card-btn${isActive ? " stat-card-active" : ""}`}
        onClick={onClick}
        title={isActive ? `Showing ${label.toLowerCase()} problems` : `Filter by ${label.toLowerCase()}`}
      >
        <span>{label}</span>
        <strong>{value}</strong>
        <p>{hint}</p>
      </button>
    );
  }
  return (
    <article className="stat-card">
      <span>{label}</span>
      <strong>{value}</strong>
      <p>{hint}</p>
    </article>
  );
}

export function SectionBadge({
  icon,
  label,
  tone,
}: {
  icon: string;
  label: string;
  tone: "gold" | "mint" | "sky" | "rose" | "amber" | "purple";
}) {
  return (
    <span className={`section-badge section-badge-${tone}`}>
      <span>{icon}</span>
      {label}
    </span>
  );
}

export const ActiveRecallPanel = memo(function ActiveRecallPanel({ problem }: { problem: Problem }) {
  const [showHints, setShowHints] = useState(false);
  const prompts = useMemo(() => buildRecallPrompts(problem), [problem]);

  return (
    <section className="recall-panel">
      <div className="section-heading">
        <div>
          <p className="panel-label">
            <SectionBadge icon="🎯" label="Quick check" tone="mint" />
          </p>
          <h3>Try once, then peek</h3>
        </div>
        <button className="secondary-btn recall-toggle" onClick={() => setShowHints((value) => !value)}>
          {showHints ? "Hide clues" : "Show clues"}
        </button>
      </div>

      <p className="section-note">
        No pressure. Guess the idea first, then open the clue if your brain says “loading...”.
      </p>

      <div className="recall-grid">
        {prompts.map((prompt, index) => (
          <article key={prompt.question} className="recall-card">
            <div className="recall-card-head">
              <span className="recall-step">{index + 1}</span>
              <strong>{prompt.question}</strong>
            </div>
            <span>{showHints ? prompt.hint : "Tiny guess first. Clue is waiting."}</span>
          </article>
        ))}
      </div>
    </section>
  );
});

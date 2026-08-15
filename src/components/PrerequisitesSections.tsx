import { memo } from "react";
import type { PatternFamilyItem, Prerequisite } from "../api/types";
import { SectionBadge } from "./StatCards";

export const ProblemPrerequisitesSection = memo(function ProblemPrerequisitesSection({
  prerequisites = [],
}: {
  prerequisites?: Prerequisite[];
  onChange?: (nextPrereqs: Prerequisite[]) => void;
  readOnly?: boolean;
}) {
  const getPlatformClass = (platform?: string) => {
    const p = (platform || "").toLowerCase();
    if (p.includes("leetcode")) return "platform-badge-leetcode";
    if (p.includes("gfg") || p.includes("geeks")) return "platform-badge-gfg";
    if (p.includes("codeforces")) return "platform-badge-codeforces";
    return "";
  };

  if (!prerequisites || prerequisites.length === 0) {
    return null;
  }

  const hasWarmup = prerequisites.some(
    (p) => p.kind === "warmup" || p.kind === "stepping_stone"
  );

  return (
    <section className="prerequisites-card">
      <div className="section-heading">
        <div>
          <p className="panel-label">
            <SectionBadge icon="🔗" label={hasWarmup ? "Learning Path & Warmup" : "Prerequisites"} tone="sky" />
          </p>
          <h3>{hasWarmup ? "Prerequisites & Stepping Stones" : "Foundational Problems (Solve First)"}</h3>
        </div>
      </div>

      <p className="section-note">
        {hasWarmup
          ? "Solve strict prerequisites or practice recommended warmups to master the core intuition."
          : "Solving these baseline problems first gives you the core pattern needed for this problem."}
      </p>

      <div className="prerequisites-list">
        {prerequisites.map((req, index) => {
          const isWarmup = req.kind === "warmup" || req.kind === "stepping_stone";
          return (
            <div key={`${req.title}-${index}`} className="prerequisite-item">
              <div className="prerequisite-item-info">
                <div className="prerequisite-title-row" style={{ flexWrap: "wrap", gap: "6px" }}>
                  <strong>{req.title}</strong>
                  {isWarmup ? (
                    <span className="platform-badge platform-badge-warmup">
                      ⚡ Recommended Stepping Stone
                    </span>
                  ) : null}
                  {req.platformName ? (
                    <span className={`platform-badge ${getPlatformClass(req.platformName)}`}>
                      {req.platformName}
                    </span>
                  ) : null}
                </div>
                {req.note ? <p className="prerequisite-note">💡 {req.note}</p> : null}
              </div>

              <div className="prerequisite-actions">
                {req.platformUrl ? (
                  <a
                    href={req.platformUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="link-btn primary"
                    style={{ padding: "6px 12px", fontSize: "0.82rem" }}
                  >
                    Practice ↗
                  </a>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
});

export const PatternFamilySection = memo(function PatternFamilySection({
  patternFamily = [],
  pattern = "",
}: {
  patternFamily?: PatternFamilyItem[];
  pattern?: string;
}) {
  const getPlatformClass = (platform?: string) => {
    const p = (platform || "").toLowerCase();
    if (p.includes("leetcode")) return "platform-badge-leetcode";
    if (p.includes("gfg") || p.includes("geeks")) return "platform-badge-gfg";
    if (p.includes("codeforces")) return "platform-badge-codeforces";
    return "";
  };

  if (!patternFamily || patternFamily.length === 0) {
    return null;
  }

  return (
    <section className="prerequisites-card pattern-family-card">
      <div className="section-heading">
        <div>
          <p className="panel-label">
            <SectionBadge icon="🔥" label="Pattern Multiplier" tone="purple" />
          </p>
          <h3>Same Pattern Family (Solve Together)</h3>
        </div>
      </div>

      <p className="section-note">
        Solving these sibling problems sharing the exact same {pattern ? `"${pattern}"` : "algorithm"} pattern locks in core muscle memory!
      </p>

      <div className="prerequisites-list">
        {patternFamily.map((item, index) => (
          <div key={`${item.title}-${index}`} className="prerequisite-item">
            <div className="prerequisite-item-info">
              <div className="prerequisite-title-row" style={{ flexWrap: "wrap", gap: "6px" }}>
                <strong>{item.title}</strong>
                {item.platformName ? (
                  <span className={`platform-badge ${getPlatformClass(item.platformName)}`}>
                    {item.platformName}
                  </span>
                ) : null}
              </div>
              {item.note ? <p className="prerequisite-note">⚡ {item.note}</p> : null}
            </div>

            <div className="prerequisite-actions">
              {item.platformUrl ? (
                <a
                  href={item.platformUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="link-btn primary"
                  style={{ padding: "6px 12px", fontSize: "0.82rem" }}
                >
                  Practice ↗
                </a>
              ) : null}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
});

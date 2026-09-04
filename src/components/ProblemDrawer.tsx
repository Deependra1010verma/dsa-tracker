import type { Difficulty, Problem, ProblemFormState, RevisionState, Status, Topic } from "../appTypes";
import { ProblemPrerequisitesSection } from "./PrerequisitesSections";
import { EditableCodeBlock } from "./EditableCodeBlock";

export type ProblemDrawerProps = {
  isOpen: boolean;
  mode: "edit" | "notes";
  activeProblem: Problem | null;
  activeRevisionState: RevisionState | null;
  form: ProblemFormState;
  setForm: React.Dispatch<React.SetStateAction<ProblemFormState>>;
  saving: boolean;
  topics: Topic[];
  onClose: () => void;
  onSave: () => void;
  onOpenLink: (problem: Problem) => void;
};

export function ProblemDrawer({
  isOpen,
  mode,
  activeProblem,
  activeRevisionState,
  form,
  setForm,
  saving,
  topics,
  onClose,
  onSave,
  onOpenLink,
}: ProblemDrawerProps) {
  if (!isOpen) return null;

  return (
    <div
      className={`drawer-backdrop ${mode === "notes" ? "notes-backdrop" : ""}`}
      onClick={onClose}
    >
      <aside
        className={`drawer ${mode === "notes" ? "notes-drawer" : ""}`}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="drawer-header">
          <div>
            <p className="panel-label">
              {activeProblem ? (mode === "edit" ? "Edit" : "Notes") : "Add"}
            </p>
            <h3>{activeProblem ? activeProblem.title : "New"}</h3>
          </div>
          <button className="ghost-btn" onClick={onClose}>
            Close
          </button>
        </div>

        {mode === "edit" ? (
          <>
            <div className="drawer-body">
              {activeProblem && activeRevisionState ? (
                <div className={`revision-summary ${activeRevisionState.isOverdue ? "overdue" : activeRevisionState.isDue ? "due" : ""}`}>
                  <div>
                    <p className="panel-label">Spaced repetition</p>
                    <strong>{activeRevisionState.label || "Scheduled"}</strong>
                    <span>{activeRevisionState.subtitle}</span>
                  </div>
                  {!activeRevisionState.isComplete ? (
                    <button className="revision-inline-action" onClick={() => onOpenLink(activeProblem)}>
                      Open
                    </button>
                  ) : (
                    <span className="revision-complete-pill">Completed</span>
                  )}
                </div>
              ) : null}

              <label>
                Title
                <input
                  value={form.title}
                  onChange={(event) => setForm((prev) => ({ ...prev, title: event.target.value }))}
                  placeholder="e.g. Two Sum"
                />
              </label>

              <label>
                Topic
                <select
                  value={form.topicId}
                  onChange={(event) => setForm((prev) => ({ ...prev, topicId: event.target.value }))}
                >
                  <option value="">Select topic</option>
                  {topics.map((topic) => (
                    <option key={topic._id} value={topic._id}>
                      {topic.name}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                Section
                <input
                  value={form.roadmapSection}
                  onChange={(event) => setForm((prev) => ({ ...prev, roadmapSection: event.target.value }))}
                  placeholder="Basic Arrays"
                />
              </label>

              <div className="two-col">
                <label>
                  Platform
                  <input
                    value={form.platformName}
                    onChange={(event) => setForm((prev) => ({ ...prev, platformName: event.target.value }))}
                    placeholder="LeetCode"
                  />
                </label>

                <label>
                  Difficulty
                  <select
                    value={form.difficulty}
                    onChange={(event) =>
                      setForm((prev) => ({ ...prev, difficulty: event.target.value as Difficulty }))
                    }
                  >
                    <option>Easy</option>
                    <option>Medium</option>
                    <option>Hard</option>
                  </select>
                </label>
              </div>

              <div className="two-col">
                <label>
                  Pattern
                  <input
                    value={form.pattern}
                    onChange={(event) => setForm((prev) => ({ ...prev, pattern: event.target.value }))}
                    placeholder="Two Pointers"
                  />
                </label>

                <label>
                  Invariant
                  <input
                    value={form.invariant}
                    onChange={(event) => setForm((prev) => ({ ...prev, invariant: event.target.value }))}
                    placeholder="What must always stay true"
                  />
                </label>
              </div>

              <div className="compare-approaches-block">
                <p className="panel-label">Compare approaches</p>
                <label>
                  Brute force
                  <textarea
                    rows={3}
                    value={form.compareBruteForce}
                    onChange={(event) =>
                      setForm((prev) => ({ ...prev, compareBruteForce: event.target.value }))
                    }
                    placeholder="What the naive solution does"
                  />
                </label>

                <label>
                  Optimized
                  <textarea
                    rows={3}
                    value={form.compareOptimized}
                    onChange={(event) =>
                      setForm((prev) => ({ ...prev, compareOptimized: event.target.value }))
                    }
                    placeholder="What you changed to improve it"
                  />
                </label>

                <label>
                  Why better
                  <textarea
                    rows={3}
                    value={form.compareWhyBetter}
                    onChange={(event) =>
                      setForm((prev) => ({ ...prev, compareWhyBetter: event.target.value }))
                    }
                    placeholder="Why the optimized version wins"
                  />
                </label>
              </div>

              <label>
                Rating
                <input
                  type="number"
                  min={0}
                  max={10}
                  value={form.rating}
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, rating: Number(event.target.value) || 0 }))
                  }
                />
              </label>

              <label>
                Link
                <input
                  value={form.platformUrl}
                  onChange={(event) => setForm((prev) => ({ ...prev, platformUrl: event.target.value }))}
                  placeholder="https://..."
                />
              </label>

              <div className="two-col">
                <label>
                  Status
                  <select
                    value={form.status}
                    onChange={(event) =>
                      setForm((prev) => ({ ...prev, status: event.target.value as Status }))
                    }
                  >
                    <option value="unsolved">Unsolved</option>
                    <option value="shaky">Shaky</option>
                    <option value="solved">Solved</option>
                    <option value="revisit">Revisit</option>
                    <option value="skipped">Skipped</option>
                  </select>
                </label>

                <label>
                  Priority
                  <input
                    type="number"
                    value={form.priority}
                    onChange={(event) =>
                      setForm((prev) => ({ ...prev, priority: Number(event.target.value) || 0 }))
                    }
                  />
                </label>
              </div>

              <label>
                Note
                <input
                  value={form.shortNote}
                  onChange={(event) => setForm((prev) => ({ ...prev, shortNote: event.target.value }))}
                  placeholder="Short note"
                />
              </label>

              <label>
                Notes
                <textarea
                  rows={8}
                  value={form.longNote}
                  onChange={(event) => setForm((prev) => ({ ...prev, longNote: event.target.value }))}
                  placeholder="What you learned"
                />
              </label>

              <div>
                <span className="study-note-label">Code Snippet / Implementation</span>
                <EditableCodeBlock
                  value={form.codeSnippet}
                  onChange={(val) => setForm((prev) => ({ ...prev, codeSnippet: val }))}
                  minHeight={150}
                />
              </div>

              <div className="mistake-log-block">
                <p className="panel-label">Mistake log</p>
                <label>
                  What went wrong
                  <textarea
                    rows={3}
                    value={form.mistakeTrigger}
                    onChange={(event) => setForm((prev) => ({ ...prev, mistakeTrigger: event.target.value }))}
                    placeholder="Where the mistake happened"
                  />
                </label>

                <label>
                  Why it happened
                  <textarea
                    rows={3}
                    value={form.mistakeReason}
                    onChange={(event) => setForm((prev) => ({ ...prev, mistakeReason: event.target.value }))}
                    placeholder="Wrong assumption, edge case, or missed detail"
                  />
                </label>

                <label>
                  Fix / takeaway
                  <textarea
                    rows={3}
                    value={form.mistakeFix}
                    onChange={(event) => setForm((prev) => ({ ...prev, mistakeFix: event.target.value }))}
                    placeholder="What you will do next time"
                  />
                </label>
              </div>

              <ProblemPrerequisitesSection
                prerequisites={form.prerequisites}
                onChange={(nextPrereqs) => setForm((prev) => ({ ...prev, prerequisites: nextPrereqs }))}
              />

              <label>
                Tags
                <input
                  value={form.tags}
                  onChange={(event) => setForm((prev) => ({ ...prev, tags: event.target.value }))}
                  placeholder="dp, revisit"
                />
              </label>

              <label className="checkbox-row">
                <input
                  type="checkbox"
                  checked={form.isPinned}
                  onChange={(event) => setForm((prev) => ({ ...prev, isPinned: event.target.checked }))}
                />
                Pin
              </label>
            </div>

            <div className="drawer-footer">
              <button className="secondary-btn" onClick={onClose}>
                Cancel
              </button>
              <button className="primary-btn" disabled={saving} onClick={onSave}>
                {saving ? "Saving..." : "Save"}
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="drawer-body notes-body">
              <div className="notes-head">
                <button
                  className="link-btn"
                  onClick={() => {
                    if (activeProblem?.platformUrl) {
                      window.open(activeProblem.platformUrl, "_blank", "noopener,noreferrer");
                    }
                  }}
                >
                  Link
                </button>
              </div>

              <div className="pattern-invariant-card">
                <p className="panel-label">Pattern + invariant</p>
                <div className="pattern-invariant-grid">
                  <div>
                    <span className="pattern-invariant-label">Pattern</span>
                    <strong>{activeProblem?.pattern?.trim() || form.pattern.trim() || "Not set yet"}</strong>
                  </div>
                  <div>
                    <span className="pattern-invariant-label">Invariant</span>
                    <strong>
                      {activeProblem?.invariant?.trim() || form.invariant.trim() || "Not set yet"}
                    </strong>
                  </div>
                </div>
              </div>

              <div className="compare-approaches-card">
                <p className="panel-label">Compare approaches</p>
                <div className="compare-approaches-grid">
                  <div>
                    <span className="compare-label">Brute force</span>
                    <strong>{activeProblem?.compareBruteForce?.trim() || form.compareBruteForce.trim() || "Not set yet"}</strong>
                  </div>
                  <div>
                    <span className="compare-label">Optimized</span>
                    <strong>{activeProblem?.compareOptimized?.trim() || form.compareOptimized.trim() || "Not set yet"}</strong>
                  </div>
                  <div>
                    <span className="compare-label">Why better</span>
                    <strong>{activeProblem?.compareWhyBetter?.trim() || form.compareWhyBetter.trim() || "Not set yet"}</strong>
                  </div>
                </div>
              </div>

              <label>
                Note
                <input
                  value={form.shortNote}
                  onChange={(event) => setForm((prev) => ({ ...prev, shortNote: event.target.value }))}
                  placeholder="Short note"
                />
              </label>

              <label>
                Notes
                <textarea
                  rows={10}
                  value={form.longNote}
                  onChange={(event) => setForm((prev) => ({ ...prev, longNote: event.target.value }))}
                  placeholder="What you learned"
                />
              </label>

              <div>
                <span className="study-note-label">Code Snippet / Implementation</span>
                <EditableCodeBlock
                  value={form.codeSnippet}
                  onChange={(val) => setForm((prev) => ({ ...prev, codeSnippet: val }))}
                  minHeight={150}
                />
              </div>

              <div className="mistake-log-block">
                <p className="panel-label">Mistake log</p>
                <label>
                  What went wrong
                  <textarea
                    rows={3}
                    value={form.mistakeTrigger}
                    onChange={(event) => setForm((prev) => ({ ...prev, mistakeTrigger: event.target.value }))}
                    placeholder="Where the mistake happened"
                  />
                </label>

                <label>
                  Why it happened
                  <textarea
                    rows={3}
                    value={form.mistakeReason}
                    onChange={(event) => setForm((prev) => ({ ...prev, mistakeReason: event.target.value }))}
                    placeholder="Wrong assumption, edge case, or missed detail"
                  />
                </label>

                <label>
                  Fix / takeaway
                  <textarea
                    rows={3}
                    value={form.mistakeFix}
                    onChange={(event) => setForm((prev) => ({ ...prev, mistakeFix: event.target.value }))}
                    placeholder="What you will do next time"
                  />
                </label>
              </div>

              {activeProblem ? (
                <p className="muted">Saved: {activeProblem.title}</p>
              ) : null}
            </div>

            <div className="drawer-footer">
              <button className="secondary-btn" onClick={onClose}>
                Close
              </button>
              <button className="primary-btn" disabled={saving} onClick={onSave}>
                {saving ? "Saving..." : "Save"}
              </button>
            </div>
          </>
        )}
      </aside>
    </div>
  );
}

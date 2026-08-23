import type { Problem, ProblemFormState, RevisionState } from "../appTypes";
import { PatternFamilySection, ProblemPrerequisitesSection } from "./PrerequisitesSections";
import { ActiveRecallPanel, SectionBadge } from "./StatCards";
import { EditableCodeBlock } from "./EditableCodeBlock";

export type ProblemWorkspaceViewProps = {
  activeProblem: Problem;
  activeRevisionState: RevisionState | null;
  form: ProblemFormState;
  setForm: React.Dispatch<React.SetStateAction<ProblemFormState>>;
  workspaceSaveState: "idle" | "dirty" | "saving" | "saved" | "error";
  activeWorkspaceIndex: number;
  workspaceProblemIds: string[];
  previousWorkspaceProblem: Problem | null;
  nextWorkspaceProblem: Problem | null;
  saving: boolean;
  completingRevisionIds: Set<string>;
  onOpenStudyView: (problem: Problem) => void;
  onBackToList: () => void;
  onOpenProblemLink: (problem: Problem) => void;
  onCompleteRevision: (problem: Problem) => void;
  onOpenEditDrawer: (problem: Problem) => void;
  onSaveProblem: () => void;
};

export function ProblemWorkspaceView({
  activeProblem,
  activeRevisionState,
  form,
  setForm,
  workspaceSaveState,
  activeWorkspaceIndex,
  workspaceProblemIds,
  previousWorkspaceProblem,
  nextWorkspaceProblem,
  saving,
  completingRevisionIds,
  onOpenStudyView,
  onBackToList,
  onOpenProblemLink,
  onCompleteRevision,
  onOpenEditDrawer,
  onSaveProblem,
}: ProblemWorkspaceViewProps) {
  return (
    <section className="problem-workspace">
      <div className="problem-workspace-head">
        <div>
          <p className="panel-label">
            <SectionBadge icon="🧩" label="Problem workspace" tone="sky" />
          </p>
          <h3>{activeProblem.title}</h3>
          <p className="section-note">
            {activeProblem.topic.name} · {activeProblem.platformName} · {activeProblem.difficulty}
          </p>
          <p className={`workspace-save-indicator workspace-save-${workspaceSaveState}`}>
            {workspaceSaveState === "dirty"
              ? "Unsaved changes"
              : workspaceSaveState === "saving"
              ? "Saving..."
              : workspaceSaveState === "saved"
              ? "Saved"
              : workspaceSaveState === "error"
              ? "Save failed"
              : "Autosave on"}
          </p>
        </div>

        <div className="problem-workspace-actions">
          <span className="workspace-nav-meta">
            {activeWorkspaceIndex >= 0 ? `${activeWorkspaceIndex + 1} / ${workspaceProblemIds.length}` : "Workspace"}
          </span>
          <button
            className="secondary-btn"
            disabled={!previousWorkspaceProblem}
            onClick={() => {
              if (previousWorkspaceProblem) {
                onOpenStudyView(previousWorkspaceProblem);
              }
            }}
          >
            Previous
          </button>
          <button
            className="secondary-btn"
            disabled={!nextWorkspaceProblem}
            onClick={() => {
              if (nextWorkspaceProblem) {
                onOpenStudyView(nextWorkspaceProblem);
              }
            }}
          >
            Next
          </button>
          <button className="secondary-btn" onClick={onBackToList}>
            Back to list
          </button>
          <button className="secondary-btn" onClick={() => onOpenProblemLink(activeProblem)}>
            Practice
          </button>
          {activeRevisionState?.isScheduled && !activeRevisionState.isComplete ? (
            <button
              className="secondary-btn"
              disabled={completingRevisionIds.has(activeProblem._id)}
              onClick={() => void onCompleteRevision(activeProblem)}
            >
              {completingRevisionIds.has(activeProblem._id) ? "Updating..." : "Revision done"}
            </button>
          ) : null}
          <button className="secondary-btn" onClick={() => onOpenEditDrawer(activeProblem)}>
            Full edit
          </button>
          <button className="primary-btn" disabled={saving} onClick={onSaveProblem}>
            {saving ? "Saving..." : "Save changes"}
          </button>
        </div>
      </div>

      <div className="problem-workspace-grid">
        <div className="problem-workspace-main">
          <section className="mistake-log-block">
            <p className="panel-label">
              <SectionBadge icon="📝" label="Notes" tone="amber" />
            </p>
            <div className="workspace-editor-grid">
              <label className="workspace-editor-field">
                <span className="study-note-label">Short note</span>
                <input
                  value={form.shortNote}
                  onChange={(event) => setForm((prev) => ({ ...prev, shortNote: event.target.value }))}
                  placeholder="One-line takeaway"
                />
              </label>
              <label className="workspace-editor-field" style={{ gridColumn: "1 / -1" }}>
                <span className="study-note-label">Detailed notes</span>
                <textarea
                  rows={7}
                  value={form.longNote}
                  onChange={(event) => setForm((prev) => ({ ...prev, longNote: event.target.value }))}
                  placeholder="Write the explanation, key insight, or edge cases here"
                />
              </label>
              <div className="workspace-editor-field" style={{ gridColumn: "1 / -1" }}>
                <span className="study-note-label">Code Snippet / Implementation</span>
                <EditableCodeBlock
                  value={form.codeSnippet}
                  onChange={(val) => setForm((prev) => ({ ...prev, codeSnippet: val }))}
                />
              </div>
            </div>
          </section>

          <section className="mistake-log-block">
            <p className="panel-label">
              <SectionBadge icon="🚧" label="Mistake log" tone="gold" />
            </p>
            <div className="workspace-editor-grid">
              <label className="workspace-editor-field">
                <span className="study-note-label">What went wrong</span>
                <textarea
                  rows={3}
                  value={form.mistakeTrigger}
                  onChange={(event) => setForm((prev) => ({ ...prev, mistakeTrigger: event.target.value }))}
                  placeholder="Where you got stuck or made the mistake"
                />
              </label>
              <label className="workspace-editor-field">
                <span className="study-note-label">Why it happened</span>
                <textarea
                  rows={3}
                  value={form.mistakeReason}
                  onChange={(event) => setForm((prev) => ({ ...prev, mistakeReason: event.target.value }))}
                  placeholder="Wrong assumption, missed condition, or gap in understanding"
                />
              </label>
              <label className="workspace-editor-field">
                <span className="study-note-label">Fix / takeaway</span>
                <textarea
                  rows={3}
                  value={form.mistakeFix}
                  onChange={(event) => setForm((prev) => ({ ...prev, mistakeFix: event.target.value }))}
                  placeholder="What you will do differently next time"
                />
              </label>
            </div>
          </section>
        </div>

        <div className="problem-workspace-side">
          <ActiveRecallPanel problem={activeProblem} />
          <ProblemPrerequisitesSection
            prerequisites={form.prerequisites}
            onChange={(nextPrereqs) => setForm((prev) => ({ ...prev, prerequisites: nextPrereqs }))}
          />
          <PatternFamilySection
            patternFamily={activeProblem.patternFamily}
            pattern={activeProblem.pattern}
          />
        </div>
      </div>
    </section>
  );
}

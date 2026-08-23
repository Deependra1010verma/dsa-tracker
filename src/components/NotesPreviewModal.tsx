import type { Problem } from "../appTypes";
import { formatRating, splitMistakeLog } from "../utils/problemUtils";
import { SyntaxCodeBlock } from "./SyntaxCodeBlock";

export type NotesPreviewModalProps = {
  problem: Problem | null;
  onClose: () => void;
  onOpenWorkspace: (problem: Problem) => void;
  onOpenEdit: (problem: Problem) => void;
  onOpenLink: (problem: Problem) => void;
};

export function NotesPreviewModal({
  problem,
  onClose,
  onOpenWorkspace,
  onOpenEdit,
  onOpenLink,
}: NotesPreviewModalProps) {
  if (!problem) return null;

  const trigger = problem.mistakeTrigger ?? splitMistakeLog(problem.mistakeLog).trigger;
  const reason = problem.mistakeReason ?? splitMistakeLog(problem.mistakeLog).reason;
  const fix = problem.mistakeFix ?? splitMistakeLog(problem.mistakeLog).fix;

  const hasShortNote = Boolean(problem.shortNote?.trim());
  const hasLongNote = Boolean(problem.longNote?.trim());
  const hasTrigger = Boolean(trigger?.trim());
  const hasReason = Boolean(reason?.trim());
  const hasFix = Boolean(fix?.trim());
  const hasMistakes = hasTrigger || hasReason || hasFix || Boolean(problem.mistakeLog?.trim());
  const hasBrute = Boolean(problem.compareBruteForce?.trim());
  const hasOptimized = Boolean(problem.compareOptimized?.trim());
  const hasWhyBetter = Boolean(problem.compareWhyBetter?.trim());
  const hasComparison = hasBrute || hasOptimized || hasWhyBetter;

  const hasCodeSnippet = Boolean(problem.codeSnippet?.trim());

  return (
    <div className="notes-preview-modal-backdrop" onClick={onClose}>
      <div className="notes-preview-modal" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="notes-preview-modal-header">
          <div className="notes-preview-header-main">
            <div className="notes-preview-badges">
              <span className="notes-preview-topic-chip">{problem.topic.name}</span>
              <span className={`difficulty-pill difficulty-${problem.difficulty.toLowerCase()}`}>{problem.difficulty}</span>
              {problem.rating ? <span className="importance-rating-badge">{formatRating(problem.rating)}</span> : null}
              {problem.pattern ? <span className="pattern-chip">{problem.pattern}</span> : null}
            </div>
            <h3 className="notes-preview-title">
              {problem.title}
              <button
                type="button"
                className="notes-preview-link-btn"
                onClick={() => onOpenLink(problem)}
                title={`Open on ${problem.platformName}`}
              >
                ↗
              </button>
            </h3>
          </div>
          <button type="button" className="notes-preview-close-btn" onClick={onClose} aria-label="Close notes preview">
            ✕
          </button>
        </div>

        {/* Body - Only rendered sections */}
        <div className="notes-preview-modal-body">
          {/* Quick Takeaway Banner */}
          {hasShortNote ? (
            <div className="notes-preview-takeaway-banner">
              <span className="takeaway-icon">💡</span>
              <div className="takeaway-content">
                <span className="takeaway-label">Key Takeaway</span>
                <p className="takeaway-text">{problem.shortNote}</p>
              </div>
            </div>
          ) : null}

          {/* Detailed Solution / Notes */}
          {hasLongNote ? (
            <div className="notes-preview-section">
              <div className="notes-preview-section-title">
                <span className="section-title-icon">📝</span> Solution & Notes
              </div>
              <div className="notes-preview-section-body" style={{ whiteSpace: 'pre-wrap', color: 'var(--text)', fontSize: '14px', lineHeight: '1.6' }}>
                {problem.longNote}
              </div>
            </div>
          ) : null}

          {/* Code Snippet */}
          {hasCodeSnippet ? (
            <div className="notes-preview-section">
              <div className="notes-preview-section-title">
                <span className="section-title-icon">💻</span> Code Snippet
              </div>
              <div className="notes-preview-section-body" style={{ padding: 0, overflow: 'hidden', borderRadius: '12px' }}>
                <SyntaxCodeBlock
                  code={problem.codeSnippet ?? ""}
                  language="cpp"
                  title="Implementation"
                />
              </div>
            </div>
          ) : null}

          {/* Mistake Analysis Section */}
          {hasMistakes ? (
            <div className="notes-preview-section">
              <div className="notes-preview-section-title">
                <span className="section-title-icon">🚧</span> Mistake Analysis & Retrospective
              </div>
              <div className="notes-preview-cards-grid">
                {hasTrigger ? (
                  <div className="notes-preview-card mistake-trigger-card">
                    <div className="notes-preview-card-header">
                      <span className="card-badge-icon">🛑</span>
                      <span className="card-badge-title">What Went Wrong</span>
                    </div>
                    <p className="notes-preview-card-text">{trigger}</p>
                  </div>
                ) : null}

                {hasReason ? (
                  <div className="notes-preview-card mistake-reason-card">
                    <div className="notes-preview-card-header">
                      <span className="card-badge-icon">🔍</span>
                      <span className="card-badge-title">Why It Happened</span>
                    </div>
                    <p className="notes-preview-card-text">{reason}</p>
                  </div>
                ) : null}

                {hasFix ? (
                  <div className="notes-preview-card mistake-fix-card">
                    <div className="notes-preview-card-header">
                      <span className="card-badge-icon">🎯</span>
                      <span className="card-badge-title">Fix / Rule For Next Time</span>
                    </div>
                    <p className="notes-preview-card-text">{fix}</p>
                  </div>
                ) : null}

                {!hasTrigger && !hasReason && !hasFix && problem.mistakeLog?.trim() ? (
                  <div className="notes-preview-card mistake-general-card">
                    <div className="notes-preview-card-header">
                      <span className="card-badge-icon">⚠️</span>
                      <span className="card-badge-title">Mistake Log</span>
                    </div>
                    <p className="notes-preview-card-text">{problem.mistakeLog}</p>
                  </div>
                ) : null}
              </div>
            </div>
          ) : null}

          {/* Approach & Complexity Comparison Section */}
          {hasComparison ? (
            <div className="notes-preview-section">
              <div className="notes-preview-section-title">
                <span className="section-title-icon">⚖️</span> Approach & Complexity Comparison
              </div>
              <div className="notes-preview-cards-grid">
                {hasBrute ? (
                  <div className="notes-preview-card compare-brute-card">
                    <div className="notes-preview-card-header">
                      <span className="card-badge-icon">🐢</span>
                      <span className="card-badge-title">Brute Force Approach</span>
                    </div>
                    <p className="notes-preview-card-text">{problem.compareBruteForce}</p>
                  </div>
                ) : null}

                {hasOptimized ? (
                  <div className="notes-preview-card compare-opt-card">
                    <div className="notes-preview-card-header">
                      <span className="card-badge-icon">⚡</span>
                      <span className="card-badge-title">Optimized Approach</span>
                    </div>
                    <p className="notes-preview-card-text">{problem.compareOptimized}</p>
                  </div>
                ) : null}

                {hasWhyBetter ? (
                  <div className="notes-preview-card compare-why-card">
                    <div className="notes-preview-card-header">
                      <span className="card-badge-icon">✨</span>
                      <span className="card-badge-title">Why Optimized Is Better</span>
                    </div>
                    <p className="notes-preview-card-text">{problem.compareWhyBetter}</p>
                  </div>
                ) : null}
              </div>
            </div>
          ) : null}
        </div>

        {/* Footer Actions */}
        <div className="notes-preview-modal-footer">
          <button
            type="button"
            className="notes-preview-btn notes-preview-primary-btn"
            onClick={() => {
              onClose();
              onOpenWorkspace(problem);
            }}
          >
            <svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round">
              <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"></path>
              <path d="M22 3h-6a4 4 0 0 1-4 4v14a3 3 0 0 1 3-3h7z"></path>
            </svg>
            <span>Open Full Workspace</span>
          </button>

          <button
            type="button"
            className="notes-preview-btn notes-preview-secondary-btn"
            onClick={() => {
              onClose();
              onOpenEdit(problem);
            }}
          >
            <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 20h9"></path>
              <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path>
            </svg>
            <span>Edit Notes</span>
          </button>

          <button
            type="button"
            className="notes-preview-btn notes-preview-ghost-btn"
            onClick={() => onOpenLink(problem)}
          >
            <span>Solve on {problem.platformName} ↗</span>
          </button>
        </div>
      </div>
    </div>
  );
}

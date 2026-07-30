import { useState, useMemo } from "react";
import type { GeneralNote, CodeSnippetItem, MistakeItem } from "../api/types";
import { SyntaxCodeBlock } from "./SyntaxCodeBlock";

export type ViewMode = "cards" | "code" | "mistakes";

interface GeneralNotesViewProps {
  notes: GeneralNote[];
  onOpenCreate: () => void;
  onOpenEdit: (note: GeneralNote) => void;
  onDeleteNote: (noteId: string) => void;
  onTogglePinNote: (note: GeneralNote) => void;
  isFocusMode?: boolean;
}

export function GeneralNotesView({
  notes,
  onOpenCreate,
  onOpenEdit,
  onDeleteNote,
  onTogglePinNote,
  isFocusMode = false,
}: GeneralNotesViewProps) {
  const [viewMode, setViewMode] = useState<ViewMode>("cards");
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [selectedTag, setSelectedTag] = useState<string>("all");
  const [inspectingNote, setInspectingNote] = useState<GeneralNote | null>(null);
  const [copiedSnippetId, setCopiedSnippetId] = useState<string | null>(null);

  // Category list
  const categories = useMemo(() => {
    const set = new Set<string>();
    for (const note of notes) {
      if (note.category) set.add(note.category);
    }
    return Array.from(set);
  }, [notes]);

  // Tags list
  const allTags = useMemo(() => {
    const set = new Set<string>();
    for (const note of notes) {
      for (const tag of note.tags || []) {
        set.add(tag);
      }
    }
    return Array.from(set);
  }, [notes]);

  // Filter notes
  const filteredNotes = useMemo(() => {
    return notes.filter((note) => {
      const matchCategory = selectedCategory === "all" || note.category === selectedCategory;
      const matchTag = selectedTag === "all" || (note.tags && note.tags.includes(selectedTag));

      const query = search.trim().toLowerCase();
      if (!query) return matchCategory && matchTag;

      const matchTitle = note.title.toLowerCase().includes(query);
      const matchSummary = note.summary.toLowerCase().includes(query);
      const matchCategoryText = note.category.toLowerCase().includes(query);
      const matchTags = (note.tags || []).some((t) => t.toLowerCase().includes(query));
      const matchSnippets = (note.codeSnippets || []).some(
        (s) => s.name.toLowerCase().includes(query) || s.code.toLowerCase().includes(query)
      );

      return matchCategory && matchTag && (matchTitle || matchSummary || matchCategoryText || matchTags || matchSnippets);
    });
  }, [notes, search, selectedCategory, selectedTag]);

  // Separate pinned vs standard
  const { pinnedNotes, unpinnedNotes } = useMemo(() => {
    const pinned: GeneralNote[] = [];
    const unpinned: GeneralNote[] = [];
    for (const note of filteredNotes) {
      if (note.isPinned) pinned.push(note);
      else unpinned.push(note);
    }
    return { pinnedNotes: pinned, unpinnedNotes: unpinned };
  }, [filteredNotes]);

  // Flat list of all snippets
  const allSnippets = useMemo(() => {
    const list: { noteTitle: string; category: string; snippet: CodeSnippetItem }[] = [];
    for (const note of filteredNotes) {
      for (const snippet of note.codeSnippets || []) {
        list.push({ noteTitle: note.title, category: note.category, snippet });
      }
    }
    return list;
  }, [filteredNotes]);

  // Flat list of all mistakes
  const allMistakes = useMemo(() => {
    const list: { noteTitle: string; category: string; mistake: MistakeItem }[] = [];
    for (const note of filteredNotes) {
      for (const mistake of note.mistakesToAvoid || []) {
        list.push({ noteTitle: note.title, category: note.category, mistake });
      }
    }
    return list;
  }, [filteredNotes]);

  const handleCopyCode = (id: string, code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedSnippetId(id);
    setTimeout(() => setCopiedSnippetId(null), 2000);
  };

  const getCategoryIcon = (category: string) => {
    const cat = category.toLowerCase();
    if (cat.includes("pattern")) return "🧠";
    if (cat.includes("system") || cat.includes("architecture")) return "⚙️";
    if (cat.includes("mistake") || cat.includes("anti")) return "🚫";
    if (cat.includes("cheat") || cat.includes("sheet")) return "⚡";
    if (cat.includes("data") || cat.includes("structure")) return "📦";
    return "💡";
  };

  return (
    <div className={`vnotes-hub ${isFocusMode ? "focus-active" : ""}`}>
      {/* Visual Hero Header */}
      <section className="vnotes-hero">
        <div className="vnotes-hero-left">
          <div className="vnotes-hero-badge">
            <span className="sparkle">✨</span> Visual Developer Hub
          </div>
          <h2>Visual Knowledge & Cheat-Sheets</h2>
          <p className="vnotes-hero-subtitle">
            High-density pattern cards, code boilerplates, and side-by-side anti-pattern mistake matrices.
          </p>
        </div>
        <div className="vnotes-hero-actions">
          <button className="primary-btn vnotes-create-btn" onClick={onOpenCreate}>
            <svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" strokeWidth="2.5" fill="none">
              <line x1="12" y1="5" x2="12" y2="19"></line>
              <line x1="5" y1="12" x2="19" y2="12"></line>
            </svg>
            <span>New Note</span>
          </button>
        </div>
      </section>

      {/* Control Bar: View Switcher Tabs & Search */}
      <section className="vnotes-control-bar">
        <div className="vnotes-view-tabs">
          <button
            className={`vnotes-tab-btn ${viewMode === "cards" ? "active" : ""}`}
            onClick={() => setViewMode("cards")}
          >
            <span className="tab-icon">🎴</span>
            <span>Visual Cards</span>
            <span className="tab-count-pill">{notes.length}</span>
          </button>

          <button
            className={`vnotes-tab-btn ${viewMode === "code" ? "active" : ""}`}
            onClick={() => setViewMode("code")}
          >
            <span className="tab-icon">⚡</span>
            <span>Code Templates</span>
            <span className="tab-count-pill">{allSnippets.length}</span>
          </button>

          <button
            className={`vnotes-tab-btn ${viewMode === "mistakes" ? "active" : ""}`}
            onClick={() => setViewMode("mistakes")}
          >
            <span className="tab-icon">🚫</span>
            <span>Mistake Matrix</span>
            <span className="tab-count-pill">{allMistakes.length}</span>
          </button>
        </div>

        <div className="vnotes-search-box">
          <svg className="search-icon" viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" strokeWidth="2" fill="none">
            <circle cx="11" cy="11" r="8"></circle>
            <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
          </svg>
          <input
            type="text"
            className="vnotes-search-input"
            placeholder="Search notes, tags, snippets..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {search ? (
            <button className="search-clear-btn" onClick={() => setSearch("")}>✕</button>
          ) : null}
        </div>
      </section>

      {/* Category Pills & Tag Chips */}
      <section className="vnotes-filters-row">
        <div className="vnotes-category-pills">
          <button
            className={`vnotes-cat-pill ${selectedCategory === "all" ? "active" : ""}`}
            onClick={() => setSelectedCategory("all")}
          >
            All Categories
          </button>
          {categories.map((cat) => (
            <button
              key={cat}
              className={`vnotes-cat-pill ${selectedCategory === cat ? "active" : ""}`}
              onClick={() => setSelectedCategory(cat)}
            >
              <span>{getCategoryIcon(cat)}</span>
              <span>{cat}</span>
            </button>
          ))}
        </div>

        {allTags.length > 0 ? (
          <div className="vnotes-tag-chips">
            <span className="tag-label">Tags:</span>
            <button
              className={`vnotes-tag-chip ${selectedTag === "all" ? "active" : ""}`}
              onClick={() => setSelectedTag("all")}
            >
              All
            </button>
            {allTags.map((tag) => (
              <button
                key={tag}
                className={`vnotes-tag-chip ${selectedTag === tag ? "active" : ""}`}
                onClick={() => setSelectedTag(selectedTag === tag ? "all" : tag)}
              >
                #{tag}
              </button>
            ))}
          </div>
        ) : null}
      </section>

      {/* Main Content Area based on viewMode */}
      {filteredNotes.length === 0 ? (
        <div className="vnotes-empty-card">
          <div className="empty-sparkle">🔍</div>
          <h3>No matching notes found</h3>
          <p>Try clearing your search query or creating a new general note.</p>
          <button className="primary-btn" onClick={onOpenCreate}>Create Note</button>
        </div>
      ) : viewMode === "cards" ? (
        /* ================= MODE 1: VISUAL CARDS GRID ================= */
        <div className="vnotes-cards-container">
          {pinnedNotes.length > 0 ? (
            <div className="vnotes-section-block">
              <h4 className="vnotes-group-title">
                <span>📌 Pinned Knowledge</span>
                <span className="group-badge">{pinnedNotes.length}</span>
              </h4>
              <div className="vnotes-grid">
                {pinnedNotes.map((note) => (
                  <CompactNoteCard
                    key={note._id}
                    note={note}
                    onInspect={() => setInspectingNote(note)}
                    onEdit={() => onOpenEdit(note)}
                    onDelete={() => onDeleteNote(note._id)}
                    onTogglePin={() => onTogglePinNote(note)}
                    getCategoryIcon={getCategoryIcon}
                  />
                ))}
              </div>
            </div>
          ) : null}

          <div className="vnotes-section-block">
            {pinnedNotes.length > 0 ? (
              <h4 className="vnotes-group-title">
                <span>📓 Knowledge Notes</span>
                <span className="group-badge">{unpinnedNotes.length}</span>
              </h4>
            ) : null}
            <div className="vnotes-grid">
              {unpinnedNotes.map((note) => (
                <CompactNoteCard
                  key={note._id}
                  note={note}
                  onInspect={() => setInspectingNote(note)}
                  onEdit={() => onOpenEdit(note)}
                  onDelete={() => onDeleteNote(note._id)}
                  onTogglePin={() => onTogglePinNote(note)}
                  getCategoryIcon={getCategoryIcon}
                />
              ))}
            </div>
          </div>
        </div>
      ) : viewMode === "code" ? (
        /* ================= MODE 2: CODE TEMPLATES LIBRARY ================= */
        <div className="vnotes-code-library">
          {allSnippets.length === 0 ? (
            <div className="vnotes-empty-card">
              <div className="empty-sparkle">⚡</div>
              <h3>No code templates found</h3>
              <p>Add code snippets to your general notes to see them here.</p>
            </div>
          ) : (
            <div className="vnotes-snippets-grid">
              {allSnippets.map(({ noteTitle, category, snippet }, index) => {
                const snipId = `snip-${index}-${snippet.name}`;
                const isCopied = copiedSnippetId === snipId;
                return (
                  <div key={snipId} className="vnotes-snippet-card">
                    <div className="snippet-card-header">
                      <div className="snippet-meta">
                        <span className="snippet-lang-pill">{snippet.language || "cpp"}</span>
                        <h4 className="snippet-title">{snippet.name}</h4>
                      </div>
                      <button
                        className={`snippet-copy-action ${isCopied ? "copied" : ""}`}
                        onClick={() => handleCopyCode(snipId, snippet.code)}
                      >
                        {isCopied ? "✓ Copied!" : "📋 Copy Code"}
                      </button>
                    </div>
                    <div className="snippet-note-context">
                      <span>{getCategoryIcon(category)} {category}</span>
                      <span className="dot">•</span>
                      <span>{noteTitle}</span>
                    </div>
                    <div className="snippet-code-box-wrapper">
                      <SyntaxCodeBlock code={snippet.code} language={snippet.language} />
                    </div>
                    {snippet.explanation ? (
                      <p className="snippet-note-explanation">💡 {snippet.explanation}</p>
                    ) : null}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ) : (
        /* ================= MODE 3: MISTAKE MATRIX (SIDE-BY-SIDE SPLIT) ================= */
        <div className="vnotes-mistake-matrix">
          {allMistakes.length === 0 ? (
            <div className="vnotes-empty-card">
              <div className="empty-sparkle">🚫</div>
              <h3>No mistake logs logged yet</h3>
              <p>Log anti-patterns and pitfalls in your general notes to display the side-by-side matrix.</p>
            </div>
          ) : (
            <div className="matrix-grid">
              {allMistakes.map(({ noteTitle, category, mistake }, index) => (
                <div key={`mistake-${index}`} className="matrix-split-card">
                  <div className="matrix-card-head">
                    <div className="matrix-title-group">
                      <span className="matrix-warning-badge">⚠️ PITFALL #{index + 1}</span>
                      <h4>{mistake.whatWentWrong}</h4>
                    </div>
                    <span className="matrix-source-tag">{noteTitle}</span>
                  </div>

                  <div className="matrix-columns-row">
                    {/* Left: Anti-Pattern Column */}
                    <div className="matrix-col col-bad">
                      <div className="col-header">
                        <span className="icon">❌</span>
                        <span>ANTI-PATTERN / WHY IT FAILS</span>
                      </div>
                      <p className="col-body">{mistake.whyItFailed || mistake.whatWentWrong}</p>
                    </div>

                    {/* Right: Optimal Fix Column */}
                    <div className="matrix-col col-fix">
                      <div className="col-header">
                        <span className="icon">✅</span>
                        <span>OPTIMAL FIX / TAKEAWAY</span>
                      </div>
                      <p className="col-body">{mistake.correctFix || "Keep invariant strictly enforced."}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Centered Inspection Modal for Deep Reading */}
      {inspectingNote ? (
        <CenteredInspectModal
          note={inspectingNote}
          onClose={() => setInspectingNote(null)}
          onEdit={() => {
            onOpenEdit(inspectingNote);
            setInspectingNote(null);
          }}
          onCopyCode={handleCopyCode}
          copiedSnippetId={copiedSnippetId}
          getCategoryIcon={getCategoryIcon}
        />
      ) : null}
    </div>
  );
}

/* ==========================================================================
   COMPACT VISUAL NOTE CARD (NON-TEXT HEAVY)
   ========================================================================== */
function CompactNoteCard({
  note,
  onInspect,
  onEdit,
  onDelete,
  onTogglePin,
  getCategoryIcon,
}: {
  note: GeneralNote;
  onInspect: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onTogglePin: () => void;
  getCategoryIcon: (cat: string) => string;
}) {
  return (
    <div className={`compact-vcard ${note.isPinned ? "is-pinned" : ""}`} onClick={onInspect}>
      <div className="vcard-top-bar">
        <div className="vcard-cat-badge">
          <span>{getCategoryIcon(note.category)}</span>
          <span>{note.category}</span>
        </div>
        <div className="vcard-top-right">
          <span className={`vcard-importance-pill imp-${note.importance.toLowerCase()}`}>
            {note.importance}
          </span>
          <div className="vcard-header-actions" onClick={(e) => e.stopPropagation()}>
            <button
              className={`vcard-action-btn ${note.isPinned ? "pinned" : ""}`}
              onClick={onTogglePin}
              title={note.isPinned ? "Unpin note" : "Pin note"}
            >
              📌
            </button>
            <button className="vcard-action-btn" onClick={onEdit} title="Edit note">
              ✏️
            </button>
            <button className="vcard-action-btn danger" onClick={onDelete} title="Delete note">
              🗑️
            </button>
          </div>
        </div>
      </div>

      <h3 className="vcard-title">{note.title}</h3>

      {note.summary ? <p className="vcard-summary">{note.summary}</p> : null}

      {/* Tags & Footer */}
      <div className="vcard-footer">
        {note.tags && note.tags.length > 0 ? (
          <div className="vcard-tags-row">
            {note.tags.slice(0, 3).map((tag) => (
              <span key={tag} className="vcard-tag">#{tag}</span>
            ))}
            {note.tags.length > 3 ? (
              <span className="vcard-tag-more">+{note.tags.length - 3}</span>
            ) : null}
          </div>
        ) : <div />}
        <span className="vcard-inspect-link">Inspect Note →</span>
      </div>
    </div>
  );
}

/* ==========================================================================
   CENTERED INSPECTION MODAL (CENTERED ON SCREEN FOR DEEP READING)
   ========================================================================== */
function CenteredInspectModal({
  note,
  onClose,
  onEdit,
  onCopyCode,
  copiedSnippetId,
  getCategoryIcon,
}: {
  note: GeneralNote;
  onClose: () => void;
  onEdit: () => void;
  onCopyCode: (id: string, code: string) => void;
  copiedSnippetId: string | null;
  getCategoryIcon: (cat: string) => string;
}) {
  return (
    <div className="vmodal-backdrop" onClick={onClose}>
      <aside className="vmodal-panel" onClick={(e) => e.stopPropagation()}>
        <div className="vmodal-header">
          <div className="vmodal-head-meta">
            <span className="vmodal-cat">
              {getCategoryIcon(note.category)} {note.category}
            </span>
            <span className={`vcard-importance-pill imp-${note.importance.toLowerCase()}`}>
              {note.importance}
            </span>
          </div>
          <div className="vmodal-head-actions">
            <button className="secondary-btn" onClick={onEdit}>✏️ Edit Note</button>
            <button className="vmodal-close-btn" onClick={onClose}>✕</button>
          </div>
        </div>

        <div className="vmodal-body">
          <h2 className="vmodal-title">{note.title}</h2>
          {note.summary ? <p className="vmodal-summary">{note.summary}</p> : null}

          {/* Core Takeaways Block */}
          {note.keyTakeaways && note.keyTakeaways.length > 0 ? (
            <section className="vmodal-section">
              <h4 className="vmodal-section-title">💡 Core Takeaways & Insights</h4>
              <ul className="vmodal-takeaways-list">
                {note.keyTakeaways.map((item, i) => (
                  <li key={i}>{item}</li>
                ))}
              </ul>
            </section>
          ) : null}

          {/* Full Markdown/Content Block */}
          {note.content ? (
            <section className="vmodal-section">
              <h4 className="vmodal-section-title">📜 Detailed Breakdown</h4>
              <div className="vmodal-content-box">{note.content}</div>
            </section>
          ) : null}

          {/* Mistake Warning Callout Block */}
          {note.mistakesToAvoid && note.mistakesToAvoid.length > 0 ? (
            <section className="vmodal-section">
              <h4 className="vmodal-section-title mistake-title">🚫 Pitfalls & Anti-Patterns To Avoid</h4>
              <div className="vmodal-mistakes-stack">
                {note.mistakesToAvoid.map((m, i) => (
                  <div key={i} className="vmodal-mistake-card">
                    <div className="mistake-head">
                      <span>⚠️ <strong>{m.whatWentWrong}</strong></span>
                    </div>
                    {m.whyItFailed ? (
                      <p className="mistake-fail"><span className="bad-tag">Why it fails:</span> {m.whyItFailed}</p>
                    ) : null}
                    {m.correctFix ? (
                      <p className="mistake-fix"><span className="fix-tag">Correct Fix:</span> {m.correctFix}</p>
                    ) : null}
                  </div>
                ))}
              </div>
            </section>
          ) : null}

          {/* Code Snippets Block */}
          {note.codeSnippets && note.codeSnippets.length > 0 ? (
            <section className="vmodal-section">
              <h4 className="vmodal-section-title snippet-title">⚡ Code Templates & Boilerplates</h4>
              <div className="vmodal-snippets-stack">
                {note.codeSnippets.map((snippet, i) => {
                  const id = `modal-snip-${i}`;
                  const isCopied = copiedSnippetId === id;
                  return (
                    <div key={i} className="vmodal-snippet-box">
                      <div className="snippet-box-head">
                        <span className="snippet-name">
                          <code className="lang-tag">{snippet.language || "cpp"}</code> {snippet.name}
                        </span>
                        <button
                          className={`snippet-copy-btn ${isCopied ? "copied" : ""}`}
                          onClick={() => onCopyCode(id, snippet.code)}
                        >
                          {isCopied ? "✓ Copied" : "📋 Copy"}
                        </button>
                      </div>
                      <div className="snippet-code-box-wrapper">
                        <SyntaxCodeBlock code={snippet.code} language={snippet.language} />
                      </div>
                      {snippet.explanation ? (
                        <p className="snippet-exp">💡 {snippet.explanation}</p>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            </section>
          ) : null}
        </div>
      </aside>
    </div>
  );
}

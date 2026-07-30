import React, { useState, useEffect } from "react";
import type { GeneralNote, GeneralNoteCategory, GeneralNoteImportance, CodeSnippetItem, MistakeItem } from "../api/types";

type GeneralNoteModalProps = {
  isOpen: boolean;
  note: GeneralNote | null;
  onClose: () => void;
  onSave: (noteData: Partial<GeneralNote>) => Promise<void>;
};

export function GeneralNoteModal({ isOpen, note, onClose, onSave }: GeneralNoteModalProps) {
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState<GeneralNoteCategory>("Algorithmic Patterns");
  const [importance, setImportance] = useState<GeneralNoteImportance>("Important");
  const [summary, setSummary] = useState("");
  const [content, setContent] = useState("");
  const [tagsInput, setTagsInput] = useState("");
  const [isPinned, setIsPinned] = useState(false);
  const [keyTakeaways, setKeyTakeaways] = useState<string[]>([""]);
  const [mistakesToAvoid, setMistakesToAvoid] = useState<MistakeItem[]>([]);
  const [codeSnippets, setCodeSnippets] = useState<CodeSnippetItem[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (note) {
      setTitle(note.title || "");
      setCategory(note.category || "Algorithmic Patterns");
      setImportance(note.importance || "Important");
      setSummary(note.summary || "");
      setContent(note.content || "");
      setTagsInput(note.tags ? note.tags.join(", ") : "");
      setIsPinned(Boolean(note.isPinned));
      setKeyTakeaways(note.keyTakeaways && note.keyTakeaways.length > 0 ? note.keyTakeaways : [""]);
      setMistakesToAvoid(note.mistakesToAvoid || []);
      setCodeSnippets(note.codeSnippets || []);
    } else {
      // Reset form
      setTitle("");
      setCategory("Algorithmic Patterns");
      setImportance("Important");
      setSummary("");
      setContent("");
      setTagsInput("");
      setIsPinned(false);
      setKeyTakeaways([""]);
      setMistakesToAvoid([]);
      setCodeSnippets([]);
    }
    setError("");
  }, [note, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setError("Please provide a note title");
      return;
    }

    try {
      setSaving(true);
      setError("");

      const tags = tagsInput
        .split(",")
        .map((t) => t.trim().replace(/^#/, ""))
        .filter(Boolean);

      const cleanedTakeaways = keyTakeaways.map((t) => t.trim()).filter(Boolean);
      const cleanedMistakes = mistakesToAvoid
        .map((m) => ({
          mistake: m.mistake.trim(),
          whyBad: m.whyBad?.trim() || "",
          correctFix: m.correctFix?.trim() || "",
        }))
        .filter((m) => Boolean(m.mistake));

      const cleanedSnippets = codeSnippets
        .map((s) => ({
          title: s.title?.trim() || "",
          language: s.language?.trim() || "cpp",
          code: s.code || "",
          explanation: s.explanation?.trim() || "",
        }))
        .filter((s) => Boolean(s.code.trim()));

      await onSave({
        title: title.trim(),
        category,
        importance,
        summary: summary.trim(),
        content: content.trim(),
        tags,
        isPinned,
        keyTakeaways: cleanedTakeaways,
        mistakesToAvoid: cleanedMistakes,
        codeSnippets: cleanedSnippets,
      });

      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save note");
    } finally {
      setSaving(false);
    }
  };

  // Helper arrays update
  const addTakeaway = () => setKeyTakeaways([...keyTakeaways, ""]);
  const updateTakeaway = (idx: number, val: string) => {
    const copy = [...keyTakeaways];
    copy[idx] = val;
    setKeyTakeaways(copy);
  };
  const removeTakeaway = (idx: number) => {
    setKeyTakeaways(keyTakeaways.filter((_, i) => i !== idx));
  };

  const addMistake = () => {
    setMistakesToAvoid([...mistakesToAvoid, { mistake: "", whyBad: "", correctFix: "" }]);
  };
  const updateMistake = (idx: number, field: keyof MistakeItem, val: string) => {
    const copy = [...mistakesToAvoid];
    copy[idx] = { ...copy[idx], [field]: val };
    setMistakesToAvoid(copy);
  };
  const removeMistake = (idx: number) => {
    setMistakesToAvoid(mistakesToAvoid.filter((_, i) => i !== idx));
  };

  const addSnippet = () => {
    setCodeSnippets([...codeSnippets, { title: "", language: "cpp", code: "", explanation: "" }]);
  };
  const updateSnippet = (idx: number, field: keyof CodeSnippetItem, val: string) => {
    const copy = [...codeSnippets];
    copy[idx] = { ...copy[idx], [field]: val };
    setCodeSnippets(copy);
  };
  const removeSnippet = (idx: number) => {
    setCodeSnippets(codeSnippets.filter((_, i) => i !== idx));
  };

  return (
    <div className="gnote-modal-backdrop" onClick={onClose}>
      <div className="gnote-modal-dialog" onClick={(e) => e.stopPropagation()}>
        <div className="gnote-modal-header">
          <h3>{note ? "✏️ Edit General Note" : "📓 Create General Note"}</h3>
          <button type="button" className="gnote-modal-close" onClick={onClose}>
            ✕
          </button>
        </div>

        {error ? <div className="gnote-modal-error">{error}</div> : null}

        <form onSubmit={handleSubmit} className="gnote-modal-form">
          <div className="form-group">
            <label>Note Title *</label>
            <input
              type="text"
              className="gnote-form-input"
              placeholder="e.g., Sliding Window Pattern Invariants"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
            />
          </div>

          <div className="form-row-2">
            <div className="form-group">
              <label>Category</label>
              <select
                className="gnote-form-select"
                value={category}
                onChange={(e) => setCategory(e.target.value as GeneralNoteCategory)}
              >
                <option value="Algorithmic Patterns">Algorithmic Patterns</option>
                <option value="Data Structures">Data Structures</option>
                <option value="Mistakes & Anti-Patterns">Mistakes & Anti-Patterns</option>
                <option value="Interview Strategy">Interview Strategy</option>
                <option value="Language & Syntax">Language & Syntax</option>
                <option value="System Design">System Design</option>
              </select>
            </div>

            <div className="form-group">
              <label>Importance Level</label>
              <select
                className="gnote-form-select"
                value={importance}
                onChange={(e) => setImportance(e.target.value as GeneralNoteImportance)}
              >
                <option value="Essential">Essential ⭐</option>
                <option value="Important">Important 🔥</option>
                <option value="Good to Know">Good to Know 💡</option>
              </select>
            </div>
          </div>

          <div className="form-group">
            <label>Quick Summary / One-Line Takeaway</label>
            <input
              type="text"
              className="gnote-form-input"
              placeholder="e.g., Converts O(N^2) dynamic search into linear O(N) by reusing overlapping window sums."
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
            />
          </div>

          <div className="form-group">
            <label>Detailed Notes / Explanation (Markdown)</label>
            <textarea
              className="gnote-form-textarea"
              rows={4}
              placeholder="Write core principles, contracts, time/space complexity analysis..."
              value={content}
              onChange={(e) => setContent(e.target.value)}
            />
          </div>

          {/* Key Findings List Section */}
          <div className="form-section-block">
            <div className="section-block-head">
              <label>💡 Key Findings & Rules</label>
              <button type="button" className="add-subitem-btn" onClick={addTakeaway}>
                + Add Rule
              </button>
            </div>
            {keyTakeaways.map((takeaway, idx) => (
              <div key={idx} className="subitem-row">
                <input
                  type="text"
                  className="gnote-form-input"
                  placeholder={`Finding #${idx + 1}`}
                  value={takeaway}
                  onChange={(e) => updateTakeaway(idx, e.target.value)}
                />
                <button type="button" className="remove-subitem-btn" onClick={() => removeTakeaway(idx)}>
                  ✕
                </button>
              </div>
            ))}
          </div>

          {/* Mistakes To Avoid Section */}
          <div className="form-section-block">
            <div className="section-block-head">
              <label>🛑 Mistakes To Avoid ("What NOT To Do")</label>
              <button type="button" className="add-subitem-btn warning-btn" onClick={addMistake}>
                + Add Mistake Log
              </button>
            </div>
            {mistakesToAvoid.map((item, idx) => (
              <div key={idx} className="subitem-card-box mistake-card-box">
                <div className="subitem-card-head">
                  <span>Mistake #{idx + 1}</span>
                  <button type="button" className="remove-subitem-btn" onClick={() => removeMistake(idx)}>
                    ✕ Remove
                  </button>
                </div>
                <input
                  type="text"
                  className="gnote-form-input"
                  placeholder="What mistake/pitfall happens? (e.g. Using low = mid causing infinite loop)"
                  value={item.mistake}
                  onChange={(e) => updateMistake(idx, "mistake", e.target.value)}
                />
                <input
                  type="text"
                  className="gnote-form-input"
                  placeholder="Why is it bad? (e.g. low doesn't advance when low+1==high)"
                  value={item.whyBad}
                  onChange={(e) => updateMistake(idx, "whyBad", e.target.value)}
                />
                <input
                  type="text"
                  className="gnote-form-input"
                  placeholder="What is the correct fix? (e.g. Use right-biased mid formula)"
                  value={item.correctFix}
                  onChange={(e) => updateMistake(idx, "correctFix", e.target.value)}
                />
              </div>
            ))}
          </div>

          {/* Code Snippets Section */}
          <div className="form-section-block">
            <div className="section-block-head">
              <label>💻 Code Snippets & Standard Templates</label>
              <button type="button" className="add-subitem-btn snippet-btn" onClick={addSnippet}>
                + Add Code Snippet
              </button>
            </div>
            {codeSnippets.map((item, idx) => (
              <div key={idx} className="subitem-card-box snippet-card-box">
                <div className="subitem-card-head">
                  <span>Snippet #{idx + 1}</span>
                  <button type="button" className="remove-subitem-btn" onClick={() => removeSnippet(idx)}>
                    ✕ Remove
                  </button>
                </div>
                <div className="form-row-2">
                  <input
                    type="text"
                    className="gnote-form-input"
                    placeholder="Snippet Title (e.g. C++ Dynamic Sliding Window)"
                    value={item.title}
                    onChange={(e) => updateSnippet(idx, "title", e.target.value)}
                  />
                  <select
                    className="gnote-form-select"
                    value={item.language || "cpp"}
                    onChange={(e) => updateSnippet(idx, "language", e.target.value)}
                  >
                    <option value="cpp">C++</option>
                    <option value="java">Java</option>
                    <option value="python">Python</option>
                    <option value="javascript">JavaScript / TS</option>
                    <option value="go">Go</option>
                    <option value="sql">SQL</option>
                    <option value="text">Pseudocode / Text</option>
                  </select>
                </div>
                <textarea
                  className="gnote-form-textarea code-textarea"
                  rows={5}
                  placeholder="Paste snippet code here..."
                  value={item.code}
                  onChange={(e) => updateSnippet(idx, "code", e.target.value)}
                />
              </div>
            ))}
          </div>

          {/* Tags and Pinned */}
          <div className="form-row-2">
            <div className="form-group">
              <label>Tags (comma separated)</label>
              <input
                type="text"
                className="gnote-form-input"
                placeholder="Sliding Window, C++, O(N), Corner Cases"
                value={tagsInput}
                onChange={(e) => setTagsInput(e.target.value)}
              />
            </div>

            <div className="form-group checkbox-group">
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={isPinned}
                  onChange={(e) => setIsPinned(e.target.checked)}
                />
                <span>📌 Pin Note to Top</span>
              </label>
            </div>
          </div>

          {/* Form Actions */}
          <div className="gnote-modal-footer">
            <button type="button" className="secondary-btn" onClick={onClose} disabled={saving}>
              Cancel
            </button>
            <button type="submit" className="primary-btn" disabled={saving}>
              {saving ? "Saving Note..." : note ? "Save Changes" : "Create Note"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

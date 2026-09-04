type AppHeroProps = {
  editMode: boolean;
  exportingData: boolean;
  onAdd: () => void;
  onToggleEditMode: () => void;
  onRefresh: () => void;
  onExport: () => void;
  onLogout: () => void;
};

export function AppHero({
  editMode,
  exportingData,
  onAdd,
  onToggleEditMode,
  onRefresh,
  onExport,
  onLogout,
}: AppHeroProps) {
  return (
    <section className="hero">
      <div>
        <p className="eyebrow">DSA Tracker</p>
        <h2>Track problems. Add notes.</h2>
        <p className="hero-copy">Simple and clean.</p>
      </div>

      <div className="hero-actions">
        <button className="primary-btn" onClick={onAdd}>
          Add
        </button>
        <button className={`secondary-btn ${editMode ? "active" : ""}`} onClick={onToggleEditMode}>
          {editMode ? "Edit on" : "Edit off"}
        </button>
        <button className="secondary-btn" onClick={onRefresh}>
          Refresh
        </button>
        <button className="ghost-btn" onClick={onExport} disabled={exportingData} title="Download full backup as JSON">
          {exportingData ? "Exporting..." : "⬇ Export"}
        </button>
        <button className="ghost-btn" onClick={onLogout}>
          Logout
        </button>
      </div>
    </section>
  );
}

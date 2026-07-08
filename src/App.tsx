import { useEffect, useMemo, useState, type FormEvent } from "react";

type Difficulty = "Easy" | "Medium" | "Hard";
type Status = "unsolved" | "solved" | "revisit" | "skipped";

type Topic = {
  _id: string;
  name: string;
  slug: string;
  order: number;
  targetCount: number;
  description: string;
  accent: string;
  totalProblems?: number;
  solvedCount?: number;
  revisitCount?: number;
};

type Problem = {
  _id: string;
  title: string;
  platformName: string;
  platformUrl: string;
  difficulty: Difficulty;
  status: Status;
  shortNote: string;
  longNote: string;
  revisionCount: number;
  solvedAt?: string;
  revisitAt?: string;
  tags: string[];
  priority: number;
  isPinned: boolean;
  topic: Topic;
  updatedAt: string;
};

type Stats = {
  totalProblems: number;
  solvedProblems: number;
  revisitProblems: number;
  unsolvedProblems: number;
  skippedProblems: number;
};

type ProblemFormState = {
  title: string;
  topicId: string;
  platformName: string;
  platformUrl: string;
  difficulty: Difficulty;
  status: Status;
  shortNote: string;
  longNote: string;
  tags: string;
  priority: number;
  isPinned: boolean;
};

const emptyForm: ProblemFormState = {
  title: "",
  topicId: "",
  platformName: "",
  platformUrl: "",
  difficulty: "Easy",
  status: "unsolved",
  shortNote: "",
  longNote: "",
  tags: "",
  priority: 0,
  isPinned: false,
};

const statusLabels: Record<Status, string> = {
  unsolved: "Unsolved",
  solved: "Solved",
  revisit: "Revisit",
  skipped: "Skipped",
};

const difficultyTone: Record<Difficulty, string> = {
  Easy: "tone-easy",
  Medium: "tone-medium",
  Hard: "tone-hard",
};

declare const __LOGIN_USERNAME__: string;
declare const __LOGIN_PASSWORD__: string;

const AUTH_STORAGE_KEY = "dsa-tracker-authenticated";
const DEFAULT_LOGIN = {
  username: __LOGIN_USERNAME__.trim(),
  password: __LOGIN_PASSWORD__,
};

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
    ...init,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: "Request failed" }));
    throw new Error(error.message || "Request failed");
  }

  return response.json();
}

export default function App() {
  const loginConfigured = Boolean(DEFAULT_LOGIN.username && DEFAULT_LOGIN.password);
  const [isAuthenticated, setIsAuthenticated] = useState(() => {
    if (typeof window === "undefined") {
      return false;
    }

    return window.localStorage.getItem(AUTH_STORAGE_KEY) === "true";
  });
  const [loginForm, setLoginForm] = useState({
    username: "",
    password: "",
  });
  const [loginError, setLoginError] = useState("");
  const [topics, setTopics] = useState<Topic[]>([]);
  const [problems, setProblems] = useState<Problem[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<Status | "all">("all");
  const [difficultyFilter, setDifficultyFilter] = useState<Difficulty | "all">("all");
  const [selectedTopic, setSelectedTopic] = useState<string>("all");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [activeProblem, setActiveProblem] = useState<Problem | null>(null);
  const [form, setForm] = useState<ProblemFormState>(emptyForm);
  const [saving, setSaving] = useState(false);

  const selectedTopicData = useMemo(
    () => topics.find((topic) => topic._id === selectedTopic) ?? null,
    [selectedTopic, topics]
  );

  async function loadData(options?: { silent?: boolean }) {
    try {
      if (!options?.silent) {
        setLoading(true);
      }
      setError("");
      const [topicsRes, problemsRes, statsRes] = await Promise.all([
        api<{ topics: Topic[] }>("/api/topics"),
        api<{ problems: Problem[] }>("/api/problems"),
        api<{ stats: Stats }>("/api/stats"),
      ]);
      setTopics(topicsRes.topics);
      setProblems(problemsRes.problems);
      setStats(statsRes.stats);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!isAuthenticated) {
      return;
    }

    void loadData({
      silent: topics.length > 0 || problems.length > 0 || stats !== null,
    });
  }, [isAuthenticated]);

  function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!loginConfigured) {
      setLoginError("Set USERNAME and PASSWORD in your .env file.");
      return;
    }

    if (
      loginForm.username.trim() === DEFAULT_LOGIN.username &&
      loginForm.password === DEFAULT_LOGIN.password
    ) {
      window.localStorage.setItem(AUTH_STORAGE_KEY, "true");
      setLoginError("");
      setIsAuthenticated(true);
      return;
    }

    setLoginError("Invalid username or password.");
  }

  function handleLogout() {
    window.localStorage.removeItem(AUTH_STORAGE_KEY);
    setIsAuthenticated(false);
    setLoginError("");
    setError("");
    setSearch("");
    setStatusFilter("all");
    setDifficultyFilter("all");
    setSelectedTopic("all");
    setDrawerOpen(false);
    setActiveProblem(null);
    setForm(emptyForm);
  }

  const filteredProblems = useMemo(() => {
    return problems.filter((problem) => {
      const matchesTopic = selectedTopic === "all" || problem.topic._id === selectedTopic;
      const matchesStatus = statusFilter === "all" || problem.status === statusFilter;
      const matchesDifficulty =
        difficultyFilter === "all" || problem.difficulty === difficultyFilter;
      const needle = search.trim().toLowerCase();
      const matchesSearch =
        !needle ||
        [problem.title, problem.platformName, problem.shortNote, problem.longNote, ...problem.tags]
          .join(" ")
          .toLowerCase()
          .includes(needle);

      return matchesTopic && matchesStatus && matchesDifficulty && matchesSearch;
    });
  }, [difficultyFilter, problems, search, selectedTopic, statusFilter]);

  const revisionQueue = useMemo(
    () => problems.filter((problem) => problem.status === "revisit" || problem.revisionCount > 0),
    [problems]
  );

  function openAddDrawer(topicId?: string) {
    setActiveProblem(null);
    setForm({
      ...emptyForm,
      topicId: topicId ?? (selectedTopic !== "all" ? selectedTopic : topics[0]?._id ?? ""),
    });
    setDrawerOpen(true);
  }

  function openEditDrawer(problem: Problem) {
    setActiveProblem(problem);
    setForm({
      title: problem.title,
      topicId: problem.topic._id,
      platformName: problem.platformName,
      platformUrl: problem.platformUrl,
      difficulty: problem.difficulty,
      status: problem.status,
      shortNote: problem.shortNote,
      longNote: problem.longNote,
      tags: problem.tags.join(", "),
      priority: problem.priority,
      isPinned: problem.isPinned,
    });
    setDrawerOpen(true);
  }

  async function saveProblem() {
    if (!form.title.trim() || !form.topicId || !form.platformName.trim() || !form.platformUrl.trim()) {
      setError("Title, topic, platform name, and platform link are required.");
      return;
    }

    try {
      setSaving(true);
      setError("");
      const payload = {
        title: form.title.trim(),
        topicId: form.topicId,
        platformName: form.platformName.trim(),
        platformUrl: form.platformUrl.trim(),
        difficulty: form.difficulty,
        status: form.status,
        shortNote: form.shortNote.trim(),
        longNote: form.longNote.trim(),
        tags: form.tags
          .split(",")
          .map((tag) => tag.trim())
          .filter(Boolean),
        priority: form.priority,
        isPinned: form.isPinned,
      };

      if (activeProblem) {
        await api(`/api/problems/${activeProblem._id}`, {
          method: "PATCH",
          body: JSON.stringify(payload),
        });
      } else {
        await api("/api/problems", {
          method: "POST",
          body: JSON.stringify(payload),
        });
      }

      setDrawerOpen(false);
      setActiveProblem(null);
      setForm(emptyForm);
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save problem");
    } finally {
      setSaving(false);
    }
  }

  async function updateStatus(problem: Problem, nextStatus: Status) {
    try {
      await api(`/api/problems/${problem._id}`, {
        method: "PATCH",
        body: JSON.stringify({ status: nextStatus }),
      });
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update status");
    }
  }

  async function deleteProblem(problemId: string) {
    try {
      await api(`/api/problems/${problemId}`, { method: "DELETE" });
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not delete problem");
    }
  }

  const progress = stats && stats.totalProblems > 0 ? Math.round((stats.solvedProblems / stats.totalProblems) * 100) : 0;

  const authView = (
    <main className="auth-shell">
      <section className="auth-hero">
        <div className="brand auth-brand">
          <div className="brand-mark">DSA</div>
          <div>
            <h1>Tracker</h1>
            <p>Private DSA practice board with a simple login gate.</p>
          </div>
        </div>

        <div className="auth-copy">
          <p className="eyebrow">Welcome back</p>
          <h2>Log in to open your tracker.</h2>
          <p className="hero-copy">
            Use the credentials from your <code>.env</code> file to enter the app. Once inside,
            you can manage topics, problem records, notes, and revision flow.
          </p>
          {!loginConfigured ? (
            <div className="banner error">
              Set <code>USERNAME</code> and <code>PASSWORD</code> in your{" "}
              <code>.env</code> file to enable sign in.
            </div>
          ) : null}
        </div>
      </section>

      <section className="auth-card">
        <p className="panel-label">Secure access</p>
        <h3>Sign in</h3>
        <p className="auth-note">This is a lightweight local login for the personal tracker.</p>

        <form className="auth-form" onSubmit={handleLogin}>
          <label>
            Username
            <input
              value={loginForm.username}
              onChange={(event) => setLoginForm({ ...loginForm, username: event.target.value })}
              autoComplete="username"
              placeholder="name@example.com"
            />
          </label>

          <label>
            Password
            <input
              type="password"
              value={loginForm.password}
              onChange={(event) => setLoginForm({ ...loginForm, password: event.target.value })}
              autoComplete="current-password"
              placeholder="Password"
            />
          </label>

          {loginError ? <div className="banner error">{loginError}</div> : null}

          <button className="primary-btn auth-submit" type="submit">
            Enter Tracker
          </button>
        </form>
      </section>
    </main>
  );

  const dashboardView = (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark">DSA</div>
          <div>
            <h1>Tracker</h1>
            <p>Personal sheet for practice, links, and revision.</p>
          </div>
        </div>

        <button className={`topic-card all-topics ${selectedTopic === "all" ? "active" : ""}`} onClick={() => setSelectedTopic("all")}>
          <div>
            <span className="topic-name">All Topics</span>
            <span className="topic-subtitle">{problems.length} records</span>
          </div>
          <span className="topic-count">{problems.length}</span>
        </button>

        <div className="topic-list">
          {topics.map((topic) => {
            const active = selectedTopic === topic._id;
            const solved = topic.solvedCount ?? 0;
            const total = topic.totalProblems ?? 0;
            return (
              <button
                key={topic._id}
                className={`topic-card ${active ? "active" : ""}`}
                onClick={() => setSelectedTopic(topic._id)}
              >
                <div className="topic-dot" style={{ background: topic.accent }} />
                <div className="topic-copy">
                  <span className="topic-name">{topic.name}</span>
                  <span className="topic-subtitle">
                    {solved}/{total || topic.targetCount} done
                  </span>
                </div>
                <span className="topic-count">{topic.targetCount}</span>
              </button>
            );
          })}
        </div>
      </aside>

      <main className="content">
        <section className="hero">
          <div>
            <p className="eyebrow">Single-user DSA record board</p>
            <h2>Track the work, not the platform.</h2>
            <p className="hero-copy">
              Add a question, store the external solve link, keep short and long notes, and move
              it through solved, unsolved, and revisit without extra product noise.
            </p>
          </div>

          <div className="hero-actions">
            <button className="primary-btn" onClick={() => openAddDrawer()}>
              + Add Problem
            </button>
            <button className="secondary-btn" onClick={loadData}>
              Refresh
            </button>
            <button className="ghost-btn" onClick={handleLogout}>
              Logout
            </button>
          </div>
        </section>

        {error ? <div className="banner error">{error}</div> : null}

        <section className="stats-grid">
          <StatCard label="Total" value={stats?.totalProblems ?? 0} hint="All records" />
          <StatCard label="Solved" value={stats?.solvedProblems ?? 0} hint={`${progress}% complete`} />
          <StatCard label="Revisit" value={stats?.revisitProblems ?? 0} hint="Needs another pass" />
          <StatCard label="Unsolved" value={stats?.unsolvedProblems ?? 0} hint="Still pending" />
        </section>

        <section className="progress-panel">
          <div>
            <p className="panel-label">Overall progress</p>
            <h3>{progress}% solved</h3>
          </div>
          <div className="progress-track">
            <div className="progress-fill" style={{ width: `${progress}%` }} />
          </div>
          <div className="progress-meta">
            <span>{stats?.solvedProblems ?? 0} solved</span>
            <span>{stats?.revisitProblems ?? 0} revisit</span>
            <span>{stats?.unsolvedProblems ?? 0} unsolved</span>
          </div>
        </section>

        <section className="filters">
          <input
            className="search-input"
            placeholder="Search problem, note, platform, or tag..."
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />

          <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as Status | "all")}>
            <option value="all">All status</option>
            <option value="unsolved">Unsolved</option>
            <option value="solved">Solved</option>
            <option value="revisit">Revisit</option>
            <option value="skipped">Skipped</option>
          </select>

          <select
            value={difficultyFilter}
            onChange={(event) => setDifficultyFilter(event.target.value as Difficulty | "all")}
          >
            <option value="all">All difficulty</option>
            <option value="Easy">Easy</option>
            <option value="Medium">Medium</option>
            <option value="Hard">Hard</option>
          </select>

          <button className="ghost-btn" onClick={() => openAddDrawer(selectedTopic !== "all" ? selectedTopic : undefined)}>
            Quick add
          </button>
        </section>

        <section className="queue-panel">
          <div className="section-heading">
            <div>
              <p className="panel-label">Revision queue</p>
              <h3>{revisionQueue.length} items</h3>
            </div>
            <span className="section-note">Problems marked revisit or with past revision count.</span>
          </div>
          <div className="queue-row">
            {revisionQueue.slice(0, 6).map((problem) => (
              <button
                key={problem._id}
                className="queue-chip"
                onClick={() => openEditDrawer(problem)}
              >
                {problem.title}
              </button>
            ))}
          </div>
        </section>

        <section className="problem-list">
          <div className="section-heading">
            <div>
              <p className="panel-label">Problems</p>
              <h3>{filteredProblems.length} records</h3>
            </div>
            <span className="section-note">
              {selectedTopicData ? selectedTopicData.name : "All topics"}
            </span>
          </div>

          {loading ? (
            <div className="empty-state">Loading your tracker...</div>
          ) : filteredProblems.length === 0 ? (
            <div className="empty-state">
              No problems yet. Add your first record and store the external solve link here.
            </div>
          ) : (
            <div className="problem-table">
              {filteredProblems.map((problem, index) => (
                <article key={problem._id} className="problem-row" onClick={() => openEditDrawer(problem)}>
                  <div className="row-index">{index + 1}</div>
                  <div className="row-main">
                    <div className="row-title-line">
                      <h4>{problem.title}</h4>
                      {problem.isPinned ? <span className="pin-badge">Pinned</span> : null}
                    </div>
                    <p className="row-meta">
                      {problem.platformName} · {problem.topic.name}
                    </p>
                    <p className="row-note">{problem.shortNote || "No short note yet."}</p>
                    <div className="tag-row">
                      {problem.tags.slice(0, 3).map((tag) => (
                        <span key={tag} className="tag-chip">
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="row-side">
                    <span className={`difficulty-chip ${difficultyTone[problem.difficulty]}`}>
                      {problem.difficulty}
                    </span>
                    <select
                      value={problem.status}
                      onChange={(event) => {
                        event.stopPropagation();
                        void updateStatus(problem, event.target.value as Status);
                      }}
                      onClick={(event) => event.stopPropagation()}
                    >
                      {Object.entries(statusLabels).map(([value, label]) => (
                        <option key={value} value={value}>
                          {label}
                        </option>
                      ))}
                    </select>
                    <button
                      className="link-btn"
                      onClick={(event) => {
                        event.stopPropagation();
                        window.open(problem.platformUrl, "_blank", "noopener,noreferrer");
                      }}
                    >
                      Open Link
                    </button>
                    <button
                      className="link-btn danger"
                      onClick={(event) => {
                        event.stopPropagation();
                        void deleteProblem(problem._id);
                      }}
                    >
                      Delete
                    </button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      </main>

      {drawerOpen ? (
        <div className="drawer-backdrop" onClick={() => setDrawerOpen(false)}>
          <aside className="drawer" onClick={(event) => event.stopPropagation()}>
            <div className="drawer-header">
              <div>
                <p className="panel-label">{activeProblem ? "Edit problem" : "Add problem"}</p>
                <h3>{activeProblem ? activeProblem.title : "New record"}</h3>
              </div>
              <button className="ghost-btn" onClick={() => setDrawerOpen(false)}>
                Close
              </button>
            </div>

            <div className="drawer-body">
              <label>
                Title
                <input
                  value={form.title}
                  onChange={(event) => setForm({ ...form, title: event.target.value })}
                  placeholder="e.g. Two Sum"
                />
              </label>

              <label>
                Topic
                <select
                  value={form.topicId}
                  onChange={(event) => setForm({ ...form, topicId: event.target.value })}
                >
                  <option value="">Select topic</option>
                  {topics.map((topic) => (
                    <option key={topic._id} value={topic._id}>
                      {topic.name}
                    </option>
                  ))}
                </select>
              </label>

              <div className="two-col">
                <label>
                  Platform name
                  <input
                    value={form.platformName}
                    onChange={(event) => setForm({ ...form, platformName: event.target.value })}
                    placeholder="LeetCode / GFG / Codeforces"
                  />
                </label>

                <label>
                  Difficulty
                  <select
                    value={form.difficulty}
                    onChange={(event) =>
                      setForm({ ...form, difficulty: event.target.value as Difficulty })
                    }
                  >
                    <option>Easy</option>
                    <option>Medium</option>
                    <option>Hard</option>
                  </select>
                </label>
              </div>

              <label>
                Platform link
                <input
                  value={form.platformUrl}
                  onChange={(event) => setForm({ ...form, platformUrl: event.target.value })}
                  placeholder="https://..."
                />
              </label>

              <div className="two-col">
                <label>
                  Status
                  <select
                    value={form.status}
                    onChange={(event) => setForm({ ...form, status: event.target.value as Status })}
                  >
                    <option value="unsolved">Unsolved</option>
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
                      setForm({ ...form, priority: Number(event.target.value) || 0 })
                    }
                  />
                </label>
              </div>

              <label>
                Short note
                <input
                  value={form.shortNote}
                  onChange={(event) => setForm({ ...form, shortNote: event.target.value })}
                  placeholder="One-line reminder"
                />
              </label>

              <label>
                Long note
                <textarea
                  rows={8}
                  value={form.longNote}
                  onChange={(event) => setForm({ ...form, longNote: event.target.value })}
                  placeholder="Approach, edge cases, complexity, or mistakes"
                />
              </label>

              <label>
                Tags
                <input
                  value={form.tags}
                  onChange={(event) => setForm({ ...form, tags: event.target.value })}
                  placeholder="dp, important, revisit"
                />
              </label>

              <label className="checkbox-row">
                <input
                  type="checkbox"
                  checked={form.isPinned}
                  onChange={(event) => setForm({ ...form, isPinned: event.target.checked })}
                />
                Pin this problem
              </label>
            </div>

            {activeProblem ? (
              <div className="drawer-preview">
                <div>
                  <p className="panel-label">Saved details</p>
                  <p>{activeProblem.shortNote || "No short note yet."}</p>
                  <p className="muted">{activeProblem.longNote || "No long note yet."}</p>
                </div>
                <button
                  className="link-btn"
                  onClick={() => window.open(activeProblem.platformUrl, "_blank", "noopener,noreferrer")}
                >
                  Open platform page
                </button>
              </div>
            ) : null}

            <div className="drawer-footer">
              <button className="secondary-btn" onClick={() => setDrawerOpen(false)}>
                Cancel
              </button>
              <button className="primary-btn" disabled={saving} onClick={() => void saveProblem()}>
                {saving ? "Saving..." : activeProblem ? "Update Record" : "Save Record"}
              </button>
            </div>
          </aside>
        </div>
      ) : null}
    </div>
  );

  return isAuthenticated ? dashboardView : authView;
}

function StatCard({ label, value, hint }: { label: string; value: number; hint: string }) {
  return (
    <article className="stat-card">
      <span>{label}</span>
      <strong>{value}</strong>
      <p>{hint}</p>
    </article>
  );
}

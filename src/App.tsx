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
  roadmapSection?: string;
  roadmapSectionOrder?: number;
  roadmapOrder?: number;
  difficulty: Difficulty;
  status: Status;
  pattern?: string;
  rating?: number;
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
  roadmapSection: string;
  platformName: string;
  platformUrl: string;
  difficulty: Difficulty;
  status: Status;
  pattern: string;
  rating: number;
  shortNote: string;
  longNote: string;
  tags: string;
  priority: number;
  isPinned: boolean;
};

const emptyForm: ProblemFormState = {
  title: "",
  topicId: "",
  roadmapSection: "",
  platformName: "",
  platformUrl: "",
  difficulty: "Easy",
  status: "unsolved",
  pattern: "",
  rating: 0,
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

function formatRating(rating?: number) {
  return typeof rating === "number" && rating > 0 ? `${rating}/10` : "";
}

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
  const [drawerMode, setDrawerMode] = useState<"edit" | "notes">("notes");
  const [editMode, setEditMode] = useState(false);
  const [expandedProblems, setExpandedProblems] = useState<Set<string>>(() => new Set());
  const [form, setForm] = useState<ProblemFormState>(emptyForm);
  const [saving, setSaving] = useState(false);

  const selectedTopicData = useMemo(
    () => topics.find((topic) => topic._id === selectedTopic) ?? null,
    [selectedTopic, topics]
  );

  const visibleStats = useMemo(() => {
    if (selectedTopic === "all") {
      return stats;
    }

    const topicProblems = problems.filter((problem) => problem.topic._id === selectedTopic);
    const totalProblems = topicProblems.length;
    const solvedProblems = topicProblems.filter((problem) => problem.status === "solved").length;
    const revisitProblems = topicProblems.filter((problem) => problem.status === "revisit").length;
    const unsolvedProblems = topicProblems.filter((problem) => problem.status === "unsolved").length;
    const skippedProblems = topicProblems.filter((problem) => problem.status === "skipped").length;

    return {
      totalProblems,
      solvedProblems,
      revisitProblems,
      unsolvedProblems,
      skippedProblems,
    };
  }, [problems, selectedTopic, stats]);

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
    setDrawerMode("notes");
    setExpandedProblems(new Set());
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
        [
          problem.title,
          problem.platformName,
          problem.roadmapSection,
          problem.pattern,
          problem.shortNote,
          problem.longNote,
          ...problem.tags,
        ]
          .join(" ")
          .toLowerCase()
          .includes(needle);

      return matchesTopic && matchesStatus && matchesDifficulty && matchesSearch;
    });
  }, [difficultyFilter, problems, search, selectedTopic, statusFilter]);

  const sortedFilteredProblems = useMemo(() => {
    return [...filteredProblems].sort((left, right) => {
      if (selectedTopic === "all") {
        const topicOrderDelta = left.topic.order - right.topic.order;
        if (topicOrderDelta !== 0) {
          return topicOrderDelta;
        }
      }

      const sectionOrderDelta = (left.roadmapSectionOrder ?? 999) - (right.roadmapSectionOrder ?? 999);
      if (sectionOrderDelta !== 0) {
        return sectionOrderDelta;
      }

      const roadmapOrderDelta = (left.roadmapOrder ?? 999) - (right.roadmapOrder ?? 999);
      if (roadmapOrderDelta !== 0) {
        return roadmapOrderDelta;
      }

      const priorityDelta = right.priority - left.priority;
      if (priorityDelta !== 0) {
        return priorityDelta;
      }

      return left.title.localeCompare(right.title);
    });
  }, [filteredProblems, selectedTopic]);

  const groupedFilteredProblems = useMemo(() => {
    const groups: Array<{
      key: string;
      name: string;
      order: number;
      problems: Array<{ problem: Problem; displayIndex: number }>;
    }> = [];
    const groupsByKey = new Map<string, (typeof groups)[number]>();
    let displayIndex = 1;

    for (const problem of sortedFilteredProblems) {
      const sectionName = problem.roadmapSection?.trim() || "General";
      const sectionOrder = problem.roadmapSectionOrder ?? 999;
      const sectionKey =
        selectedTopic === "all"
          ? `${problem.topic._id}:${sectionOrder}:${sectionName}`
          : `${sectionOrder}:${sectionName}`;
      const existingGroup = groupsByKey.get(sectionKey);

      if (existingGroup) {
        existingGroup.problems.push({ problem, displayIndex });
      } else {
        const group = {
          key: sectionKey,
          name: sectionName,
          order: sectionOrder,
          problems: [{ problem, displayIndex }],
        };
        groups.push(group);
        groupsByKey.set(sectionKey, group);
      }
      displayIndex += 1;
    }

    return groups;
  }, [selectedTopic, sortedFilteredProblems]);

  function openAddDrawer(topicId?: string) {
    setActiveProblem(null);
    setDrawerMode("edit");
    setForm({
      ...emptyForm,
      topicId: topicId ?? (selectedTopic !== "all" ? selectedTopic : topics[0]?._id ?? ""),
      roadmapSection: selectedTopicData?.name ?? "",
    });
    setDrawerOpen(true);
  }

  function openEditDrawer(problem: Problem) {
    setActiveProblem(problem);
    setDrawerMode(editMode ? "edit" : "notes");
    setForm({
      title: problem.title,
      topicId: problem.topic._id,
      roadmapSection: problem.roadmapSection ?? "",
      platformName: problem.platformName,
      platformUrl: problem.platformUrl,
      difficulty: problem.difficulty,
      status: problem.status,
      pattern: problem.pattern ?? "",
      rating: problem.rating ?? 0,
      shortNote: problem.shortNote,
      longNote: problem.longNote,
      tags: problem.tags.join(", "),
      priority: problem.priority,
      isPinned: problem.isPinned,
    });
    setDrawerOpen(true);
  }

  function openProblemDrawer(problem: Problem) {
    openEditDrawer(problem);
  }

  function toggleProblemExpanded(problemId: string) {
    setExpandedProblems((current) => {
      const next = new Set(current);
      if (next.has(problemId)) {
        next.delete(problemId);
      } else {
        next.add(problemId);
      }

      return next;
    });
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
        roadmapSection: form.roadmapSection.trim(),
        platformName: form.platformName.trim(),
        platformUrl: form.platformUrl.trim(),
        difficulty: form.difficulty,
        status: form.status,
        pattern: form.pattern.trim(),
        rating: form.rating,
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
  const visibleProgress =
    visibleStats && visibleStats.totalProblems > 0
      ? Math.round((visibleStats.solvedProblems / visibleStats.totalProblems) * 100)
      : 0;

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
          <h2>Log in.</h2>
          <p className="hero-copy">Use your `.env` values.</p>
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
        <p className="auth-note">Local login only.</p>

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
            <p>Problems and notes.</p>
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
            <p className="eyebrow">DSA Tracker</p>
            <h2>Track problems. Add notes.</h2>
            <p className="hero-copy">Simple and clean.</p>
          </div>

          <div className="hero-actions">
            <button className="primary-btn" onClick={() => openAddDrawer()}>
              Add
            </button>
            <button
              className={`secondary-btn ${editMode ? "active" : ""}`}
              onClick={() => setEditMode((value) => !value)}
            >
              {editMode ? "Edit on" : "Edit off"}
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
          <StatCard
            label="Total"
            value={visibleStats?.totalProblems ?? 0}
            hint={selectedTopic === "all" ? "All records" : "Topic records"}
          />
          <StatCard
            label="Solved"
            value={visibleStats?.solvedProblems ?? 0}
            hint={`${visibleProgress}% complete`}
          />
          <StatCard
            label="Revisit"
            value={visibleStats?.revisitProblems ?? 0}
            hint={selectedTopic === "all" ? "Needs another pass" : "Topic revisit"}
          />
          <StatCard
            label="Unsolved"
            value={visibleStats?.unsolvedProblems ?? 0}
            hint={selectedTopic === "all" ? "Still pending" : "Topic pending"}
          />
        </section>

        {selectedTopic === "all" ? (
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
        ) : null}

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

        <section className="problem-list">
          <div className="section-heading">
            <div>
              <p className="panel-label">Problems</p>
              <h3>{filteredProblems.length} records</h3>
            </div>
            <span className="section-note">{selectedTopicData ? selectedTopicData.name : "All"}</span>
          </div>

          {loading ? (
            <div className="empty-state">Loading...</div>
          ) : filteredProblems.length === 0 ? (
            <div className="empty-state">No problems yet.</div>
          ) : (
            <div className="problem-table">
              {groupedFilteredProblems.map((group) => (
                <section key={group.key} className="problem-group">
                  {selectedTopicData && group.name !== "General" ? (
                    <div className="problem-group-heading">{group.name}</div>
                  ) : null}
                  {group.problems.map(({ problem, displayIndex }) => (
                <article
                  key={problem._id}
                  className={`problem-row ${expandedProblems.has(problem._id) ? "expanded" : ""}`}
                  onClick={() => openEditDrawer(problem)}
                >
                  <button
                    className="row-index"
                    onClick={(event) => {
                      event.stopPropagation();
                      toggleProblemExpanded(problem._id);
                    }}
                  >
                    {displayIndex}
                  </button>
                  <div className="row-main">
                    <div className="row-compact">
                      <div className="row-title-line">
                        <h4>{problem.title}</h4>
                        {problem.isPinned ? <span className="pin-badge">Pinned</span> : null}
                        {problem.pattern ? <span className="pattern-chip">{problem.pattern}</span> : null}
                        {problem.rating ? <span className="rating-chip">{formatRating(problem.rating)}</span> : null}
                      </div>
                      <div className="row-inline">
                        <a
                          className="link-chip"
                          href={problem.platformUrl}
                          target="_blank"
                          rel="noreferrer"
                          onClick={(event) => event.stopPropagation()}
                        >
                          Link
                        </a>
                        <span className={`difficulty-chip ${difficultyTone[problem.difficulty]}`}>
                          {problem.difficulty}
                        </span>
                        <span className={`status-chip status-${problem.status}`}>
                          {statusLabels[problem.status]}
                        </span>
                      </div>
                    </div>

                    {expandedProblems.has(problem._id) ? (
                      <div className="problem-more">
                        <div className="problem-meta-grid">
                          <span>{problem.platformName}</span>
                          <span>{problem.topic.name}</span>
                          {problem.pattern ? <span>Pattern: {problem.pattern}</span> : null}
                          {problem.rating ? <span>Rating: {formatRating(problem.rating)}</span> : null}
                          <span>Priority: {problem.priority}</span>
                          <span>Updated: {new Date(problem.updatedAt).toLocaleDateString()}</span>
                          <span>{problem.isPinned ? "Pinned" : "Not pinned"}</span>
                        </div>
                        <p className="row-note">{problem.shortNote || "No note."}</p>
                        {problem.longNote ? (
                          <p className="row-note row-note-2">{problem.longNote}</p>
                        ) : null}
                        <div className="tag-row">
                          {problem.tags.length > 0 ? (
                            problem.tags.map((tag) => (
                              <span key={tag} className="tag-chip">
                                {tag}
                              </span>
                            ))
                          ) : (
                            <span className="tag-chip">No tags</span>
                          )}
                        </div>
                      </div>
                    ) : null}
                  </div>

                  <div className="row-side">
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
                        toggleProblemExpanded(problem._id);
                      }}
                    >
                      {expandedProblems.has(problem._id) ? "Less" : "More"}
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
                </section>
              ))}
            </div>
          )}
        </section>
      </main>

      {drawerOpen ? (
        <div
          className={`drawer-backdrop ${drawerMode === "notes" ? "notes-backdrop" : ""}`}
          onClick={() => setDrawerOpen(false)}
        >
          <aside
            className={`drawer ${drawerMode === "notes" ? "notes-drawer" : ""}`}
            onClick={(event) => event.stopPropagation()}
          >
            <div className="drawer-header">
              <div>
                <p className="panel-label">
                  {activeProblem ? (drawerMode === "edit" ? "Edit" : "Notes") : "Add"}
                </p>
                <h3>{activeProblem ? activeProblem.title : "New"}</h3>
              </div>
              <button className="ghost-btn" onClick={() => setDrawerOpen(false)}>
                Close
              </button>
            </div>

            {drawerMode === "edit" ? (
              <>
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

                  <label>
                    Section
                    <input
                      value={form.roadmapSection}
                      onChange={(event) => setForm({ ...form, roadmapSection: event.target.value })}
                      placeholder="Basic Arrays"
                    />
                  </label>

                  <div className="two-col">
                    <label>
                      Platform
                      <input
                        value={form.platformName}
                        onChange={(event) => setForm({ ...form, platformName: event.target.value })}
                        placeholder="LeetCode"
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

                  <div className="two-col">
                    <label>
                      Pattern
                      <input
                        value={form.pattern}
                        onChange={(event) => setForm({ ...form, pattern: event.target.value })}
                        placeholder="Two Pointers"
                      />
                    </label>

                    <label>
                      Rating
                      <input
                        type="number"
                        min={0}
                        max={10}
                        value={form.rating}
                        onChange={(event) =>
                          setForm({ ...form, rating: Number(event.target.value) || 0 })
                        }
                      />
                    </label>
                  </div>

                  <label>
                    Link
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
                        onChange={(event) =>
                          setForm({ ...form, status: event.target.value as Status })
                        }
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
                    Note
                    <input
                      value={form.shortNote}
                      onChange={(event) => setForm({ ...form, shortNote: event.target.value })}
                      placeholder="Short note"
                    />
                  </label>

                  <label>
                    Notes
                    <textarea
                      rows={8}
                      value={form.longNote}
                      onChange={(event) => setForm({ ...form, longNote: event.target.value })}
                      placeholder="What you learned"
                    />
                  </label>

                  <label>
                    Tags
                    <input
                      value={form.tags}
                      onChange={(event) => setForm({ ...form, tags: event.target.value })}
                      placeholder="dp, revisit"
                    />
                  </label>

                  <label className="checkbox-row">
                    <input
                      type="checkbox"
                      checked={form.isPinned}
                      onChange={(event) => setForm({ ...form, isPinned: event.target.checked })}
                    />
                    Pin
                  </label>
                </div>

                <div className="drawer-footer">
                  <button className="secondary-btn" onClick={() => setDrawerOpen(false)}>
                    Cancel
                  </button>
                  <button className="primary-btn" disabled={saving} onClick={() => void saveProblem()}>
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

                  <label>
                    Note
                    <input
                      value={form.shortNote}
                      onChange={(event) => setForm({ ...form, shortNote: event.target.value })}
                      placeholder="Short note"
                    />
                  </label>

                  <label>
                    Notes
                    <textarea
                      rows={10}
                      value={form.longNote}
                      onChange={(event) => setForm({ ...form, longNote: event.target.value })}
                      placeholder="What you learned"
                    />
                  </label>

                  {activeProblem ? (
                    <p className="muted">Saved: {activeProblem.title}</p>
                  ) : null}
                </div>

                <div className="drawer-footer">
                  <button className="secondary-btn" onClick={() => setDrawerOpen(false)}>
                    Close
                  </button>
                  <button className="primary-btn" disabled={saving} onClick={() => void saveProblem()}>
                    {saving ? "Saving..." : "Save"}
                  </button>
                </div>
              </>
            )}
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

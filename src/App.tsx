import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import type { Prerequisite, PatternFamilyItem, GeneralNote } from "./api/types";
import { GeneralNotesView } from "./components/GeneralNotesView";
import { GeneralNoteModal } from "./components/GeneralNoteModal";
import { addDays, advanceRevisionSchedule, toValidDate, SRS_PRESETS, type SrsPresetKey } from "./revision";

import type {
  Difficulty,
  Status,
  SortByOption,
  Topic,
  Problem,
  ProblemFormState,
  RevisionState,
  ActivityKind,
  ActivityRecord,
  ActivityProblemSnapshot,
  ActivityTopicSnapshot,
  RatingFilterOption,
  PersistedViewState,
  WorkspaceSaveState,
} from "./appTypes";

import {
  toDateKey,
  buildActivityInsights,
} from "./utils/activityUtils";

import {
  composeMistakeLog,
  splitMistakeLog,
  getRevisionState,
  getRevisionQueueMeta,
  getProblemCategories,
  hasNoteContent,
} from "./utils/problemUtils";

import {
  AUTH_STORAGE_KEY,
  APP_VIEW_STATE_KEY,
  readPersistedViewState,
  readLocalProgress,
  saveLocalProgressItem,
  saveLocalProgressForProblem,
  getSavedProgressForProblem,
  applySavedProgress,
  getProblemProgressSnapshot,
  normalizeProblemRevisionDates,
  withStatusSchedule,
  removeLocalProgressItem,
  deduplicateProblems,
  mergeActivityRecords,
  isRevisionActionable,
  getAuthToken,
  setAuthToken,
  clearAuthToken,
  readLocalActivities,
  writeLocalActivities,
  pruneLocalActivities,
  api,
} from "./utils/storageUtils";

import { NotesPreviewModal } from "./components/NotesPreviewModal";
import { ActivityInsightsPanel } from "./components/ActivityInsightsPanel";
import { AnalyticsDashboard } from "./components/AnalyticsDashboard";
import { ProblemWorkspaceView } from "./components/ProblemWorkspaceView";
import { ProblemDrawer } from "./components/ProblemDrawer";
import { AuthView } from "./components/AuthView";
import { DashboardStats } from "./components/DashboardStats";
import { AppSidebar } from "./components/AppSidebar";
import { AppHero } from "./components/AppHero";
import { ProblemListView, type ProblemTopicGroup } from "./components/ProblemListView";
import { RevisionDashboard } from "./components/RevisionDashboard";
import { useProblemKeyboardNavigation } from "./hooks/useProblemKeyboardNavigation";

const emptyForm: ProblemFormState = {
  title: "",
  topicId: "",
  roadmapSection: "",
  platformName: "",
  platformUrl: "",
  difficulty: "Easy",
  status: "unsolved",
  pattern: "",
  invariant: "",
  compareBruteForce: "",
  compareOptimized: "",
  compareWhyBetter: "",
  prerequisites: [],
  rating: 0,
  shortNote: "",
  longNote: "",
  codeSnippet: "",
  codeSnippetLang: "cpp",
  mistakeLog: "",
  mistakeTrigger: "",
  mistakeReason: "",
  mistakeFix: "",
  tags: "",
  priority: 0,
  isPinned: false,
};


export default function App() {
  const [loginConfigured, setLoginConfigured] = useState(true);
  const persistedViewState = useMemo(() => readPersistedViewState(), []);
  const [isAuthenticated, setIsAuthenticated] = useState(() => {
    if (typeof window === "undefined") {
      return false;
    }
    return Boolean(getAuthToken() || window.localStorage.getItem(AUTH_STORAGE_KEY) === "true");
  });
  const [loginForm, setLoginForm] = useState({
    username: "",
    password: "",
  });
  const [loginError, setLoginError] = useState("");
  // Rate-limit: after 5 wrong attempts, lock for 15 minutes
  const [loginAttempts, setLoginAttempts] = useState(() => {
    const saved = localStorage.getItem("dsa_login_attempts");
    if (!saved) return { count: 0, lockedUntil: 0 };
    try { return JSON.parse(saved) as { count: number; lockedUntil: number }; } catch { return { count: 0, lockedUntil: 0 }; }
  });
  const [exportingData, setExportingData] = useState(false);
  const [topics, setTopics] = useState<Topic[]>([]);
  const [problems, setProblems] = useState<Problem[]>([]);
  const [activities, setActivities] = useState<ActivityRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState(persistedViewState.search ?? "");
  const [statusFilter, setStatusFilter] = useState<Status | "all" | "revisit">(persistedViewState.statusFilter ?? "all");
  const [difficultyFilter, setDifficultyFilter] = useState<Difficulty | "all">(persistedViewState.difficultyFilter ?? "all");
  const [ratingFilter, setRatingFilter] = useState<RatingFilterOption>(persistedViewState.ratingFilter ?? "all");
  const [sortByFilter, setSortByFilter] = useState<SortByOption>("optimal");
  const [selectedTopic, setSelectedTopic] = useState<string>(persistedViewState.selectedTopic ?? "all");
  const [selectedProblemSet, setSelectedProblemSet] = useState<string>(persistedViewState.selectedProblemSet ?? "set1");
  const [drawerOpen, setDrawerOpen] = useState(Boolean(persistedViewState.activeProblemId && persistedViewState.drawerOpen));
  const [activeProblem, setActiveProblem] = useState<Problem | null>(null);
  const [previewNoteProblem, setPreviewNoteProblem] = useState<Problem | null>(null);
  const [generalNotes, setGeneralNotes] = useState<GeneralNote[]>([]);
  const [generalNoteModalOpen, setGeneralNoteModalOpen] = useState(false);
  const [editingGeneralNote, setEditingGeneralNote] = useState<GeneralNote | null>(null);

  const loadGeneralNotes = useCallback(async () => {
    try {
      const res = await api<{ notes: GeneralNote[] }>("/api/general-notes");
      if (res.notes && Array.isArray(res.notes)) {
        setGeneralNotes(res.notes);
        if (typeof window !== "undefined") {
          window.localStorage.setItem("dsa-tracker-general-notes", JSON.stringify(res.notes));
        }
        return;
      }
    } catch {
      // fallback to localStorage
    }
    if (typeof window !== "undefined") {
      const cached = window.localStorage.getItem("dsa-tracker-general-notes");
      if (cached) {
        try {
          setGeneralNotes(JSON.parse(cached));
        } catch {}
      }
    }
  }, []);

  const handleSaveGeneralNote = useCallback(async (noteData: Partial<GeneralNote>) => {
    if (editingGeneralNote) {
      try {
        const res = await api<{ note: GeneralNote }>(`/api/general-notes/${editingGeneralNote._id}`, {
          method: "PATCH",
          body: JSON.stringify(noteData),
        });
        if (res.note) {
          setGeneralNotes((prev) => prev.map((n) => (n._id === res.note._id ? res.note : n)));
          return;
        }
      } catch {}
      // Optimistic local update if API failed for edit (safe — note already has a real _id)
      setGeneralNotes((prev) =>
        prev.map((n) =>
          n._id === editingGeneralNote._id ? ({ ...n, ...noteData, updatedAt: new Date() } as GeneralNote) : n
        )
      );
    } else {
      // For CREATE: do NOT fall back to a temp fake _id.
      // A note with a fake _id would silently fail all future edits (PATCH to a non-existent id).
      try {
        const res = await api<{ note: GeneralNote }>("/api/general-notes", {
          method: "POST",
          body: JSON.stringify(noteData),
        });
        if (res.note) {
          setGeneralNotes((prev) => [res.note, ...prev]);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not create note. Check your connection and try again.");
      }
    }
  }, [editingGeneralNote]);

  const handleDeleteGeneralNote = async (noteId: string) => {
    try {
      await api(`/api/general-notes/${noteId}`, { method: "DELETE" });
      setGeneralNotes((prev) => prev.filter((n) => n._id !== noteId));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not delete note");
    }
  };

  const handleTogglePinGeneralNote = useCallback(async (note: GeneralNote) => {
    const nextPinned = !note.isPinned;
    try {
      const res = await api<{ note: GeneralNote }>(`/api/general-notes/${note._id}`, {
        method: "PATCH",
        body: JSON.stringify({ isPinned: nextPinned }),
      });
      if (res.note) {
        setGeneralNotes((prev) => prev.map((n) => (n._id === res.note._id ? res.note : n)));
        return;
      }
    } catch {}
    setGeneralNotes((prev) =>
      prev.map((n) => (n._id === note._id ? { ...n, isPinned: nextPinned } : n))
    );
  }, []);


  useEffect(() => {
    if (!previewNoteProblem) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setPreviewNoteProblem(null);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [previewNoteProblem]);

  useEffect(() => {
    api<{ isConfigured: boolean }>("/api/auth/status")
      .then((res) => {
        setLoginConfigured(res.isConfigured);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    const handleUnauthorized = () => {
      setIsAuthenticated(false);
      setLoginError("Session expired or invalid. Please sign in again.");
    };
    window.addEventListener("dsa-unauthorized", handleUnauthorized);
    return () => window.removeEventListener("dsa-unauthorized", handleUnauthorized);
  }, []);

  useEffect(() => {
    if (didInitialLoadRef.current) {
      void loadData({ silent: false });
    }
    setSelectedTopic("all");
    setDrawerOpen(false);
    setActiveProblem(null);
    // Reset revision filters when switching problem sets so they don't carry over
    setRevisionSearch("");
    setRevisionDifficulty("all");
  // loadData is stable via useCallback — safe to include
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedProblemSet]);

  const [drawerMode, setDrawerMode] = useState<"edit" | "notes">(persistedViewState.drawerMode ?? "notes");
  const [editMode, setEditMode] = useState(false);
  const [expandedProblems, setExpandedProblems] = useState<Set<string>>(() => new Set());
  const [expandedTopics, setExpandedTopics] = useState<Set<string>>(() => new Set());
  const [form, setForm] = useState<ProblemFormState>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [workspaceSaveState, setWorkspaceSaveState] = useState<WorkspaceSaveState>("idle");
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  // justSolvedIds: IDs of problems that just turned "solved" — triggers flash animation, auto-clears after 1.8s
  const [justSolvedIds, setJustSolvedIds] = useState<Set<string>>(() => new Set());
  // kbFocusedId: problem ID currently focused via keyboard (j/k navigation)
  const [kbFocusedId, setKbFocusedId] = useState<string | null>(null);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [completingRevisionIds, setCompletingRevisionIds] = useState<Set<string>>(() => new Set());
  const [snoozingRevisionIds, setSnoozingRevisionIds] = useState<Set<string>>(() => new Set());
  const [now, setNow] = useState(() => Date.now());
  const [revisitSubTab, setRevisitSubTab] = useState<"queue" | "heatmap" | "all">("queue");
  const [revisionSearch, setRevisionSearch] = useState("");
  const [revisionDifficulty, setRevisionDifficulty] = useState<Difficulty | "all">("all");
  const [srsPresetKey, setSrsPresetKey] = useState<SrsPresetKey>(() => {
    if (typeof window === "undefined") return "standard";
    const saved = localStorage.getItem("dsa_srs_preset");
    if (saved && saved in SRS_PRESETS) return saved as SrsPresetKey;
    return "standard";
  });
  const [dueLaneExpanded, setDueLaneExpanded] = useState(false);
  const [comingUpLaneExpanded, setComingUpLaneExpanded] = useState(false);
  const [revisedTodayLaneExpanded, setRevisedTodayLaneExpanded] = useState(false);

  const activeSrsPreset = SRS_PRESETS[srsPresetKey] ?? SRS_PRESETS.standard;

  const handleSrsPresetChange = (newKey: SrsPresetKey) => {
    setSrsPresetKey(newKey);
    if (typeof window !== "undefined") {
      localStorage.setItem("dsa_srs_preset", newKey);
    }
    // Fire-and-forget: reschedule all active problems with new intervals
    const newIntervals = SRS_PRESETS[newKey]?.intervals;
    if (newIntervals) {
      void api<{ rescheduled: number }>("/api/problems/reschedule-all", {
        method: "POST",
        body: JSON.stringify({ srsIntervals: newIntervals }),
      }).then(() => {
        // Refresh problems to reflect new nextRevisionAt dates
        void loadData({ silent: true });
      }).catch(() => {
        // Preset change is saved locally; reschedule failure is non-critical
      });
    }
  };
  const [sectionRowLimit, setSectionRowLimit] = useState(20);

  // Warn user before closing tab if there are unsaved workspace changes
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (workspaceSaveTimerRef.current !== null) {
        e.preventDefault();
      }
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, []);

  const didInitialLoadRef = useRef(false);
  const restoredViewRef = useRef(false);
  const skipWorkspaceAutosaveRef = useRef(false);
  const workspaceSaveTimerRef = useRef<number | null>(null);
  const mutationSeqRef = useRef(new Map<string, number>());
  const deferredSearch = useDeferredValue(search);
  const nowDate = useMemo(() => new Date(now), [now]);

  const selectedTopicData = useMemo(
    () => topics.find((topic) => topic._id === selectedTopic) ?? null,
    [selectedTopic, topics]
  );
  const activeRevisionState = useMemo(
    () => (activeProblem ? getRevisionState(activeProblem, nowDate) : null),
    [activeProblem, nowDate]
  );

  const stats = useMemo(() => {
    const totalProblems = problems.length;
    const solvedProblems = problems.filter((problem) => problem.status === "solved").length;
    // revisitProblems = isPinned (starred) problems. Shown in "Revision" stat card.
    // Star click → isPinned toggles → this count updates instantly.
    const revisitProblems = problems.filter((problem) => problem.isPinned).length;
    // revisitStatusCount = problems explicitly set to status "revisit".
    // Shown in sidebar "Revisit" button — separate concept from starred/revision.
    const revisitStatusCount = problems.filter((problem) => problem.status === "revisit").length;
    const unsolvedProblems = problems.filter((problem) => problem.status === "unsolved").length;
    const skippedProblems = problems.filter((problem) => problem.status === "skipped").length;

    return {
      totalProblems,
      solvedProblems,
      revisitProblems,
      revisitStatusCount,
      unsolvedProblems,
      skippedProblems,
    };
  }, [problems]);

  const visibleStats = useMemo(() => {
    if (selectedTopic === "all") {
      return stats;
    }

    const topicProblems = problems.filter((problem) => problem.topic._id === selectedTopic);
    return {
      totalProblems: topicProblems.length,
      solvedProblems: topicProblems.filter((problem) => problem.status === "solved").length,
      revisitProblems: topicProblems.filter((problem) => problem.isPinned).length,
      unsolvedProblems: topicProblems.filter((problem) => problem.status === "unsolved").length,
      skippedProblems: topicProblems.filter((problem) => problem.status === "skipped").length,
    };
  }, [problems, selectedTopic, stats]);

  const activityScopeRecords = useMemo(() => {
    if (selectedTopic === "all") {
      return activities;
    }

    return activities.filter((activity) => activity.topic._id === selectedTopic);
  }, [activities, selectedTopic]);

  const activityInsights = useMemo(
    () => buildActivityInsights(activityScopeRecords, nowDate),
    [activityScopeRecords, nowDate]
  );

  const problemCategoryMap = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const problem of problems) {
      map.set(problem._id, getProblemCategories(problem));
    }
    return map;
  }, [problems]);

  // Stable O(1) lookup map — memoized to prevent re-renders in child components
  // that receive it as a prop (e.g. ActivityInsightsPanel).
  const problemLookup = useMemo(
    () => new Map(problems.map((problem) => [problem._id, problem])),
    [problems]
  );

  // Compute per-topic solved/revisit/total counts directly from the live problems state.
  // This is the ONLY source of truth for sidebar counts — using topic.solvedCount
  // from the server aggregation causes inconsistency because local-progress overrides
  // are applied to problems[] but not reflected in the stale topics[] from the API.
  const topicStatsMap = useMemo(() => {
    const map = new Map<string, { solved: number; revisit: number; total: number }>();
    for (const problem of problems) {
      const topicId = problem.topic._id;
      const entry = map.get(topicId) ?? { solved: 0, revisit: 0, total: 0 };
      entry.total += 1;
      if (problem.status === "solved") entry.solved += 1;
      // Use isPinned (starred) for revisit count — matches what the Revisit filter shows.
      if (problem.isPinned) entry.revisit += 1;
      map.set(topicId, entry);
    }
    return map;
  }, [problems]);

  const revisionStateMap = useMemo(() => {
    const map = new Map<string, RevisionState>();
    for (const problem of problems) {
      map.set(problem._id, getRevisionState(problem, nowDate, activeSrsPreset.intervals));
    }
    return map;
  }, [activeSrsPreset.intervals, nowDate, problems]);

  const handleSilentRefresh = useCallback(async () => {
    try {
      const [topicsRes, problemsRes, activitiesRes] = await Promise.all([
        api<{ topics: Topic[] }>(`/api/topics?set=${selectedProblemSet}`),
        api<{ problems: Problem[] }>(`/api/problems?brief=1&set=${selectedProblemSet}`),
        api<{ activities: ActivityRecord[] }>(`/api/activity?limit=5000&set=${selectedProblemSet}`),
      ]);

      const localProgress = readLocalProgress();
      const patchedProblems = problemsRes.problems.map((problem) => {
        const saved = getSavedProgressForProblem(problem, localProgress);
        if (!saved) return problem;

        const serverUpdatedAt = problem.updatedAt ? new Date(problem.updatedAt).getTime() : 0;
        const localUpdatedAt = saved.updatedAt ?? 0;

        // If server version is newer or equal, remove stale local progress override
        if (serverUpdatedAt >= localUpdatedAt) {
          removeLocalProgressItem(problem.title);
          removeLocalProgressItem(problem._id);
          return problem;
        }

        const patchedProblem = applySavedProgress(problem, saved);
        const modified =
          patchedProblem.status !== problem.status ||
          patchedProblem.isPinned !== problem.isPinned ||
          patchedProblem.solvedAt !== problem.solvedAt ||
          patchedProblem.revisitAt !== problem.revisitAt ||
          patchedProblem.lastRevisionAt !== problem.lastRevisionAt ||
          patchedProblem.nextRevisionAt !== problem.nextRevisionAt ||
          patchedProblem.revisionCompletedAt !== problem.revisionCompletedAt ||
          patchedProblem.revisionCount !== problem.revisionCount ||
          patchedProblem.revisionStage !== problem.revisionStage;

        if (modified) {
          void api(`/api/problems/${problem._id}`, {
            method: "PATCH",
            body: JSON.stringify(getProblemProgressSnapshot(patchedProblem)),
          }).catch(() => {});
          return patchedProblem;
        }

        return problem;
      });

      const mergedActivities = mergeActivityRecords(activitiesRes.activities, readLocalActivities(selectedProblemSet));
      // Prune ghost local-* records older than 24h that were never confirmed
      const prunedActivities = pruneLocalActivities(mergedActivities);
      setTopics(topicsRes.topics);
      setProblems(deduplicateProblems(patchedProblems));
      setActivities(prunedActivities);
      writeLocalActivities(selectedProblemSet, prunedActivities);
      void loadGeneralNotes();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    }
  }, [loadGeneralNotes, selectedProblemSet]);

  const loadData = useCallback(async (options?: { silent?: boolean }) => {
    try {
      if (!options?.silent) {
        setLoading(true);
      }
      setError("");
      await handleSilentRefresh();
      // Reset backoff counter on success
      refreshFailCountRef.current = 0;
    } catch (err) {
      refreshFailCountRef.current += 1;
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }, [handleSilentRefresh]);

  // Exponential backoff for automatic silent refresh
  const refreshFailCountRef = useRef(0);
  useEffect(() => {
    const BASE_MS = 30_000; // 30s
    const MAX_MS = 5 * 60_000; // 5 min cap
    let timeoutId: ReturnType<typeof setTimeout>;

    function scheduleNext() {
      const failures = refreshFailCountRef.current;
      const delay = Math.min(BASE_MS * Math.pow(2, failures), MAX_MS);
      timeoutId = setTimeout(async () => {
        await loadData({ silent: true });
        scheduleNext();
      }, delay);
    }

    scheduleNext();
    return () => clearTimeout(timeoutId);
  }, [loadData]);

  const handleExportData = useCallback(async () => {
    setExportingData(true);
    try {
      const [problemsRes, activitiesRes, notesRes] = await Promise.all([
        api<{ problems: Problem[] }>(`/api/problems?set=${selectedProblemSet}&limit=9999`),
        api<{ activities: ActivityRecord[] }>(`/api/activity?set=${selectedProblemSet}&limit=9999`),
        api<{ notes: GeneralNote[] }>("/api/general-notes"),
      ]);
      const exportPayload = {
        exportedAt: new Date().toISOString(),
        problemSet: selectedProblemSet,
        problems: problemsRes.problems ?? [],
        activities: activitiesRes.activities ?? [],
        generalNotes: notesRes.notes ?? [],
      };
      const blob = new Blob([JSON.stringify(exportPayload, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `dsa-tracker-backup-${selectedProblemSet}-${new Date().toISOString().split("T")[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Export failed");
    } finally {
      setExportingData(false);
    }
  }, [selectedProblemSet, setError]);


  const upsertProblem = useCallback((updatedProblem: Problem) => {
    setProblems((current) =>
      deduplicateProblems(
        current.map((problem) => {
          if (problem._id !== updatedProblem._id) {
            return problem;
          }

          const saved = getSavedProgressForProblem(updatedProblem);
          if (!saved) {
            return updatedProblem;
          }

          const serverUpdatedAt = updatedProblem.updatedAt ? new Date(updatedProblem.updatedAt).getTime() : 0;
          return serverUpdatedAt >= saved.updatedAt ? updatedProblem : applySavedProgress(updatedProblem, saved);
        })
      )
    );
  }, []);

  const appendProblem = useCallback((updatedProblem: Problem) => {
    setProblems((current) => deduplicateProblems([updatedProblem, ...current.filter((problem) => problem._id !== updatedProblem._id)]));
  }, []);

  const removeProblem = useCallback((problemId: string) => {
    setProblems((current) => current.filter((problem) => problem._id !== problemId));
  }, []);

  const appendActivityRecord = useCallback(
    (
      kind: ActivityKind,
      problem: ActivityProblemSnapshot,
      topic: ActivityTopicSnapshot,
      occurredAt = new Date()
    ) => {
      setActivities((current) => {
        const nextActivity: ActivityRecord = {
          _id: `local-${problem._id}-${kind}-${occurredAt.getTime()}`,
          kind,
          occurredAt: occurredAt.toISOString(),
          problem,
          topic,
        };
        const nextActivities = mergeActivityRecords([nextActivity], current);
        writeLocalActivities(selectedProblemSet, nextActivities);

        // Fire-and-forget: confirm this record to the server. On success,
        // replace the local-* placeholder with the real server ID so that
        // future merges with server data don't produce duplicates.
        void api<{ activity: ActivityRecord | null }>("/api/activity", {
          method: "POST",
          body: JSON.stringify({
            problemId: problem._id,
            topicId: topic._id,
            kind,
            occurredAt: occurredAt.toISOString(),
          }),
        })
          .then(({ activity: confirmed }) => {
            if (!confirmed) return;
            setActivities((prev) => {
              // Swap out the local-* record for the server-confirmed one.
              // mergeActivityRecords will dedup by (problemId:kind:day) so
              // the local placeholder gets replaced cleanly.
              const updated = mergeActivityRecords([confirmed], prev.filter(
                (entry) => entry._id !== nextActivity._id
              ));
              writeLocalActivities(selectedProblemSet, updated);
              return updated;
            });
          })
          .catch(() => {
            // Network failure — the local-* record stays in localStorage
            // and will be pruned after 24 hours on the next full refresh.
          });

        return nextActivities;
      });
    },
    [selectedProblemSet]
  );

  const nextMutationSeq = useCallback((problemId: string) => {
    const nextSeq = (mutationSeqRef.current.get(problemId) ?? 0) + 1;
    mutationSeqRef.current.set(problemId, nextSeq);
    return nextSeq;
  }, []);

  const isLatestMutation = useCallback((problemId: string, seq: number) => {
    return mutationSeqRef.current.get(problemId) === seq;
  }, []);

  const openProblemLink = useCallback((problem: Problem) => {
    window.open(problem.platformUrl, "_blank", "noopener,noreferrer");
  }, []);

  const hydrateProblemDetails = useCallback(async (problem: Problem) => {
    if (problem.longNote !== undefined && problem.codeSnippet !== undefined && problem.tags.length > 0) {
      return problem;
    }

    const response = await api<{ problem: Problem }>(`/api/problems/${problem._id}`);
    upsertProblem(response.problem);
    return response.problem;
  }, [upsertProblem]);

  const syncFormFromProblem = useCallback((problem: Problem) => {
    skipWorkspaceAutosaveRef.current = true;
    setForm({
      title: problem.title,
      topicId: problem.topic._id,
      roadmapSection: problem.roadmapSection ?? "",
      platformName: problem.platformName,
      platformUrl: problem.platformUrl,
      difficulty: problem.difficulty,
      status: problem.status,
      pattern: problem.pattern ?? "",
      invariant: problem.invariant ?? "",
      compareBruteForce: problem.compareBruteForce ?? "",
      compareOptimized: problem.compareOptimized ?? "",
      compareWhyBetter: problem.compareWhyBetter ?? "",
      prerequisites: problem.prerequisites ? [...problem.prerequisites] : [],
      rating: problem.rating ?? 0,
      shortNote: problem.shortNote,
      longNote: problem.longNote ?? "",
      codeSnippet: problem.codeSnippet ?? "",
      codeSnippetLang: problem.codeSnippetLang ?? "cpp",
      mistakeLog: problem.mistakeLog ?? composeMistakeLog(problem.mistakeTrigger ?? "", problem.mistakeReason ?? "", problem.mistakeFix ?? ""),
      mistakeTrigger: problem.mistakeTrigger ?? splitMistakeLog(problem.mistakeLog).trigger,
      mistakeReason: problem.mistakeReason ?? splitMistakeLog(problem.mistakeLog).reason,
      mistakeFix: problem.mistakeFix ?? splitMistakeLog(problem.mistakeLog).fix,
      tags: problem.tags.join(", "),
      priority: problem.priority,
      isPinned: problem.isPinned,
    });
    setWorkspaceSaveState("idle");
  }, []);

  const openStudyView = useCallback((problem: Problem) => {
    setPreviewNoteProblem(null);
    setDrawerOpen(false);
    setActiveProblem(problem);
    syncFormFromProblem(problem);
    void hydrateProblemDetails(problem).then((nextProblem) => {
      setActiveProblem(nextProblem);
      syncFormFromProblem(nextProblem);
    }).catch((err) => {
      setError(err instanceof Error ? err.message : "Could not load problem details");
    });
    setTimeout(() => {
      const workspaceEl = document.querySelector(".problem-workspace");
      if (workspaceEl) {
        workspaceEl.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    }, 100);
  }, [hydrateProblemDetails, syncFormFromProblem]);

  const handleWorkspaceClick = useCallback((problem: Problem) => {
    if (hasNoteContent(problem)) {
      setPreviewNoteProblem(problem);
      void hydrateProblemDetails(problem).then((nextProblem) => {
        if (hasNoteContent(nextProblem)) {
          // Only update if the preview is still open.
          // If the user clicked "Open Full Workspace" before hydration finished,
          // previewNoteProblem will already be null — don't re-open it.
          setPreviewNoteProblem((current) => (current !== null ? nextProblem : null));
        }
      }).catch(() => {});
    } else {
      openStudyView(problem);
    }
  }, [hydrateProblemDetails, openStudyView]);

  const openProblemById = useCallback(async (problemId: string) => {
    let matchedProblem = problems.find(
      (problem) => problem._id === problemId || problem.title.toLowerCase() === problemId.toLowerCase()
    );
    if (!matchedProblem) {
      try {
        const response = await api<{ problem: Problem }>(`/api/problems/${problemId}`);
        upsertProblem(response.problem);
        matchedProblem = response.problem;
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not open problem details");
        return;
      }
    }

    if (matchedProblem && matchedProblem.platformUrl) {
      openProblemLink(matchedProblem);
    }
  }, [openProblemLink, problems, setError, upsertProblem]);

  useEffect(() => {
    if (!isAuthenticated) {
      didInitialLoadRef.current = false;
      return;
    }

    if (didInitialLoadRef.current) {
      return;
    }

    didInitialLoadRef.current = true;

    void loadData({
      silent: topics.length > 0 || problems.length > 0,
    });
  }, [isAuthenticated, loadData]);

  useEffect(() => {
    let timer: number | undefined;

    const scheduleNextUpdate = () => {
      const now = new Date();
      const nextMidnight = new Date(now);
      nextMidnight.setHours(24, 0, 0, 0);
      timer = window.setTimeout(() => {
        setNow(Date.now());
        scheduleNextUpdate();
      }, nextMidnight.getTime() - now.getTime());
    };

    scheduleNextUpdate();

    return () => {
      if (timer !== undefined) {
        window.clearTimeout(timer);
      }
    };
  }, []);

  useEffect(() => {
    if (!isAuthenticated || typeof window === "undefined") {
      return;
    }

    const nextState: PersistedViewState = {
      search,
      statusFilter,
      difficultyFilter,
      ratingFilter,
      selectedTopic,
      selectedProblemSet,
      activeProblemId: activeProblem?._id ?? null,
      drawerOpen,
      drawerMode,
    };

    window.localStorage.setItem(APP_VIEW_STATE_KEY, JSON.stringify(nextState));
  }, [activeProblem?._id, difficultyFilter, drawerMode, drawerOpen, isAuthenticated, ratingFilter, search, selectedTopic, selectedProblemSet, statusFilter]);

  async function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const now = Date.now();
    if (loginAttempts.lockedUntil > now) {
      const secsLeft = Math.ceil((loginAttempts.lockedUntil - now) / 1000);
      const minsLeft = Math.ceil(secsLeft / 60);
      setLoginError(`Too many attempts. Try again in ${minsLeft} minute${minsLeft !== 1 ? "s" : ""}.`);
      return;
    }

    try {
      const res = await api<{ success: boolean; token?: string; message?: string }>("/api/auth/login", {
        method: "POST",
        body: JSON.stringify({
          username: loginForm.username,
          password: loginForm.password,
        }),
      });

      if (res.success && res.token) {
        setAuthToken(res.token);
        window.localStorage.setItem(AUTH_STORAGE_KEY, "true");
        const cleared = { count: 0, lockedUntil: 0 };
        setLoginAttempts(cleared);
        localStorage.setItem("dsa_login_attempts", JSON.stringify(cleared));
        setLoginError("");
        setIsAuthenticated(true);
        return;
      } else {
        throw new Error(res.message || "Invalid username or password");
      }
    } catch (err) {
      const newCount = loginAttempts.count + 1;
      const LOCK_AFTER = 5;
      const LOCK_DURATION_MS = 15 * 60 * 1000;
      const newLocked = newCount >= LOCK_AFTER ? now + LOCK_DURATION_MS : loginAttempts.lockedUntil;
      const nextAttempts = { count: newCount, lockedUntil: newLocked };
      setLoginAttempts(nextAttempts);
      localStorage.setItem("dsa_login_attempts", JSON.stringify(nextAttempts));

      if (newCount >= LOCK_AFTER) {
        setLoginError("Too many failed attempts. Locked for 15 minutes.");
      } else {
        const errMsg = err instanceof Error ? err.message : "Invalid username or password";
        setLoginError(`${errMsg}. ${LOCK_AFTER - newCount} attempt${LOCK_AFTER - newCount !== 1 ? "s" : ""} left.`);
      }
    }
  }

  function handleLogout() {
    clearAuthToken();
    setIsAuthenticated(false);
    setLoginError("");
    setError("");
    setSearch("");
    setStatusFilter("all");
    setDifficultyFilter("all");
    setRatingFilter("all");
    setSelectedTopic("all");
    setDrawerOpen(false);
    setActiveProblem(null);
    setDrawerMode("notes");
    setExpandedProblems(new Set());
    setExpandedTopics(new Set());
    setForm(emptyForm);
    setSectionRowLimit(30);
    if (typeof window !== "undefined") {
      window.localStorage.removeItem(APP_VIEW_STATE_KEY);
    }
  }

  const filteredProblems = useMemo(() => {
    const needle = deferredSearch.trim().toLowerCase();
    return problems.filter((problem) => {
      const categories = problemCategoryMap.get(problem._id) ?? getProblemCategories(problem);
      const matchesTopic = selectedTopic === "all" || problem.topic._id === selectedTopic;
      const matchesStatus =
        statusFilter === "all"
          ? true
          : statusFilter === "revisit"
          ? problem.isPinned
          : problem.status === statusFilter;
      const matchesDifficulty =
        difficultyFilter === "all" || problem.difficulty === difficultyFilter;
      const ratingVal = problem.rating ?? 0;
      const matchesRating =
        ratingFilter === "all"
          ? true
          : ratingFilter === "10"
          ? ratingVal === 10
          : ratingFilter === "8-9"
          ? ratingVal >= 8 && ratingVal <= 9
          : ratingFilter === "5-7"
          ? ratingVal >= 5 && ratingVal <= 7
          : true;
      const matchesSearch =
        !needle ||
        [
          problem.title,
          problem.platformName,
          problem.roadmapSection,
          problem.pattern,
          problem.shortNote,
          problem.longNote,
          // Full-text: search inside code snippets and mistake log fields
          problem.codeSnippet,
          problem.mistakeTrigger,
          problem.mistakeReason,
          problem.mistakeFix,
          ...problem.tags,
          ...categories,
        ]
          .join(" ")
          .toLowerCase()
          .includes(needle);

      return matchesTopic && matchesStatus && matchesDifficulty && matchesRating && matchesSearch;
    });
  }, [deferredSearch, difficultyFilter, problemCategoryMap, problems, ratingFilter, selectedTopic, statusFilter]);

  const sortedFilteredProblems = useMemo(() => {
    return [...filteredProblems].sort((left, right) => {
      const effectiveSortBy = statusFilter === "revisit" && sortByFilter === "status" ? "optimal" : sortByFilter;

      if (effectiveSortBy === "status") {
        const statusMap: Record<Status, number> = { unsolved: 1, revisit: 2, solved: 3, skipped: 4 };
        const statusDelta = statusMap[left.status] - statusMap[right.status];
        if (statusDelta !== 0) return statusDelta;
      } else if (effectiveSortBy === "difficulty") {
        const diffMap: Record<Difficulty, number> = { Easy: 1, Medium: 2, Hard: 3 };
        const diffDelta = diffMap[left.difficulty] - diffMap[right.difficulty];
        if (diffDelta !== 0) return diffDelta;
      } else if (effectiveSortBy === "rating") {
        const ratingDelta = (right.rating ?? 0) - (left.rating ?? 0);
        if (ratingDelta !== 0) return ratingDelta;
      } else if (effectiveSortBy === "title") {
        const titleDelta = left.title.localeCompare(right.title);
        if (titleDelta !== 0) return titleDelta;
      }

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

      const diffMap: Record<Difficulty, number> = { Easy: 1, Medium: 2, Hard: 3 };
      const diffDelta = diffMap[left.difficulty] - diffMap[right.difficulty];
      if (diffDelta !== 0) return diffDelta;

      const priorityDelta = right.priority - left.priority;
      if (priorityDelta !== 0) {
        return priorityDelta;
      }

      return left.title.localeCompare(right.title);
    });
  }, [filteredProblems, selectedTopic, sortByFilter, statusFilter]);

  const groupedByTopicAndSection = useMemo(() => {
    const topicGroups: ProblemTopicGroup[] = [];
    const topicGroupsByKey = new Map<string, typeof topicGroups[number]>();
    let displayIndex = 1;

    for (const problem of sortedFilteredProblems) {
      const topicId = problem.topic._id;
      const topicName = problem.topic.name;
      const accent = problem.topic.accent;

      let topicGroup = topicGroupsByKey.get(topicId);
      if (!topicGroup) {
        topicGroup = {
          topicId,
          topicName,
          accent,
          solvedCount: 0,
          totalCount: 0,
          sections: [],
        };
        topicGroups.push(topicGroup);
        topicGroupsByKey.set(topicId, topicGroup);
      }

      const sectionName = problem.roadmapSection?.trim() || "General";
      const sectionOrder = problem.roadmapSectionOrder ?? 999;
      // sectionKey is unique across the app using topicId and section name
      const sectionKey = `${topicId}:${sectionOrder}:${sectionName}`;

      let sectionGroup = topicGroup.sections.find((s) => s.sectionKey === sectionKey);
      if (!sectionGroup) {
        sectionGroup = {
          sectionKey,
          sectionName,
          solvedCount: 0,
          totalCount: 0,
          problems: [],
        };
        topicGroup.sections.push(sectionGroup);
      }

      sectionGroup.problems.push({ problem, displayIndex });
      sectionGroup.totalCount += 1;
      topicGroup.totalCount += 1;
      if (problem.status === "solved") {
        sectionGroup.solvedCount += 1;
        topicGroup.solvedCount += 1;
      }
      displayIndex += 1;
    }

    return topicGroups;
  }, [sortedFilteredProblems]);

  const workspaceProblemIds = useMemo(
    () => sortedFilteredProblems.map((problem) => problem._id),
    [sortedFilteredProblems]
  );

  const activeWorkspaceIndex = useMemo(() => {
    if (!activeProblem) {
      return -1;
    }

    return workspaceProblemIds.indexOf(activeProblem._id);
  }, [activeProblem, workspaceProblemIds]);

  const previousWorkspaceProblem = useMemo(() => {
    if (activeWorkspaceIndex <= 0) {
      return null;
    }

    return sortedFilteredProblems[activeWorkspaceIndex - 1] ?? null;
  }, [activeWorkspaceIndex, sortedFilteredProblems]);

  const nextWorkspaceProblem = useMemo(() => {
    if (activeWorkspaceIndex < 0 || activeWorkspaceIndex >= sortedFilteredProblems.length - 1) {
      return null;
    }

    return sortedFilteredProblems[activeWorkspaceIndex + 1] ?? null;
  }, [activeWorkspaceIndex, sortedFilteredProblems]);

  const hasWorkspaceDraftChanges = useMemo(() => {
    if (!activeProblem || drawerOpen) {
      return false;
    }

    const baselineTrigger = activeProblem.mistakeTrigger ?? splitMistakeLog(activeProblem.mistakeLog).trigger;
    const baselineReason = activeProblem.mistakeReason ?? splitMistakeLog(activeProblem.mistakeLog).reason;
    const baselineFix = activeProblem.mistakeFix ?? splitMistakeLog(activeProblem.mistakeLog).fix;

    return (
      form.pattern !== (activeProblem.pattern ?? "") ||
      form.compareOptimized !== (activeProblem.compareOptimized ?? "") ||
      form.compareWhyBetter !== (activeProblem.compareWhyBetter ?? "") ||
      form.shortNote !== (activeProblem.shortNote ?? "") ||
      form.longNote !== (activeProblem.longNote ?? "") ||
      form.codeSnippet !== (activeProblem.codeSnippet ?? "") ||
      form.codeSnippetLang !== (activeProblem.codeSnippetLang ?? "cpp") ||
      form.mistakeTrigger !== baselineTrigger ||
      form.mistakeReason !== baselineReason ||
      form.mistakeFix !== baselineFix
    );
  }, [
    activeProblem,
    drawerOpen,
    form.codeSnippet,
    form.codeSnippetLang,
    form.compareOptimized,
    form.compareWhyBetter,
    form.longNote,
    form.mistakeFix,
    form.mistakeReason,
    form.mistakeTrigger,
    form.pattern,
    form.shortNote,
  ]);

  const revisionProblems = useMemo(() => {
    const seenTitles = new Set<string>();
    const deduplicated: Problem[] = [];

    for (const problem of problems) {
      const state = revisionStateMap.get(problem._id) ?? getRevisionState(problem, nowDate);
      if (state.isScheduled && !state.isComplete) {
        const normalizedTitle = problem.title.trim().toLowerCase();
        if (!seenTitles.has(normalizedTitle)) {
          seenTitles.add(normalizedTitle);
          deduplicated.push(problem);
        }
      }
    }
    return deduplicated;
  }, [nowDate, problems, revisionStateMap]);

  const revisedTodayIds = useMemo(() => {
    const todayKey = toDateKey(nowDate);
    return new Set(
      activities
        .filter((activity) => activity.kind === "revision" && toDateKey(new Date(activity.occurredAt)) === todayKey)
        .map((activity) => activity.problem._id)
    );
  }, [activities, nowDate]);

  // Due lane: problems that are due/overdue, excluding any already revised today
  const dueRevisionProblems = useMemo(() => {
    return [...revisionProblems]
      .map((problem) => ({ problem, state: revisionStateMap.get(problem._id) ?? getRevisionState(problem, nowDate) }))
      .filter(({ state, problem }) => (state.isDue || state.isOverdue) && !revisedTodayIds.has(problem._id))
      .sort((left, right) => {
        const leftMeta = getRevisionQueueMeta(left.problem, left.state);
        const rightMeta = getRevisionQueueMeta(right.problem, right.state);
        if (rightMeta.score !== leftMeta.score) {
          return rightMeta.score - leftMeta.score;
        }

        const leftTime = left.state.dueDate?.getTime() ?? Number.POSITIVE_INFINITY;
        const rightTime = right.state.dueDate?.getTime() ?? Number.POSITIVE_INFINITY;
        return leftTime - rightTime;
      });
  }, [nowDate, revisedTodayIds, revisionProblems, revisionStateMap]);


  // Problems NOT yet due but coming up — excludes anything already revised today
  const sidebarRevisionProblems = useMemo(() => {
    return [...revisionProblems]
      .map((problem) => ({ problem, state: revisionStateMap.get(problem._id) ?? getRevisionState(problem, nowDate) }))
      .filter(({ state }) => !state.isDue && !state.isOverdue && !state.isComplete && state.dueDate)
      .sort((left, right) => {
        const leftMeta = getRevisionQueueMeta(left.problem, left.state);
        const rightMeta = getRevisionQueueMeta(right.problem, right.state);
        if (rightMeta.score !== leftMeta.score) {
          return rightMeta.score - leftMeta.score;
        }

        const leftTime = left.state.dueDate?.getTime() ?? Number.POSITIVE_INFINITY;
        const rightTime = right.state.dueDate?.getTime() ?? Number.POSITIVE_INFINITY;
        return leftTime - rightTime;
      });
  }, [nowDate, revisionProblems, revisionStateMap]);

  const revisedTodayProblems = useMemo(() => {
    const todayKey = toDateKey(nowDate);
    const seenTitles = new Set<string>();

    return activities
      .filter((activity) => activity.kind === "revision" && toDateKey(new Date(activity.occurredAt)) === todayKey)
      .sort((left, right) => new Date(right.occurredAt).getTime() - new Date(left.occurredAt).getTime())
      .map((activity) => problemLookup.get(activity.problem._id))
      .filter((problem): problem is Problem => Boolean(problem))
      .filter((problem) => {
        const normalizedTitle = problem.title.trim().toLowerCase();
        if (seenTitles.has(normalizedTitle)) {
          return false;
        }
        seenTitles.add(normalizedTitle);
        return true;
      })
      .map((problem) => ({ problem, state: revisionStateMap.get(problem._id) ?? getRevisionState(problem, nowDate) }));
  }, [activities, nowDate, problemLookup, revisionStateMap]);

  const filteredDueRevisionProblems = useMemo(() => {
    const query = revisionSearch.trim().toLowerCase();
    return dueRevisionProblems.filter(({ problem }) => {
      const matchesDiff = revisionDifficulty === "all" || problem.difficulty === revisionDifficulty;
      const matchesQuery =
        !query ||
        problem.title.toLowerCase().includes(query) ||
        problem.topic.name.toLowerCase().includes(query) ||
        problem.platformName.toLowerCase().includes(query);
      return matchesDiff && matchesQuery;
    });
  }, [dueRevisionProblems, revisionDifficulty, revisionSearch]);

  const filteredSidebarRevisionProblems = useMemo(() => {
    const query = revisionSearch.trim().toLowerCase();
    return sidebarRevisionProblems.filter(({ problem }) => {
      const matchesDiff = revisionDifficulty === "all" || problem.difficulty === revisionDifficulty;
      const matchesQuery =
        !query ||
        problem.title.toLowerCase().includes(query) ||
        problem.topic.name.toLowerCase().includes(query) ||
        problem.platformName.toLowerCase().includes(query);
      return matchesDiff && matchesQuery;
    });
  }, [revisionDifficulty, revisionSearch, sidebarRevisionProblems]);

  const filteredRevisedTodayProblems = useMemo(() => {
    const query = revisionSearch.trim().toLowerCase();
    return revisedTodayProblems.filter(({ problem }) => {
      const matchesDiff = revisionDifficulty === "all" || problem.difficulty === revisionDifficulty;
      const matchesQuery =
        !query ||
        problem.title.toLowerCase().includes(query) ||
        problem.topic.name.toLowerCase().includes(query) ||
        problem.platformName.toLowerCase().includes(query);
      return matchesDiff && matchesQuery;
    });
  }, [revisedTodayProblems, revisionDifficulty, revisionSearch]);

  const nextRevisionCandidate = dueRevisionProblems[0]?.problem ?? sidebarRevisionProblems[0]?.problem ?? null;
  // Always show dashboard when on revision tab — empty states inside each lane handle the zero case
  const showRevisionDashboard = selectedTopic === "revision";

  const toggleTopicExpanded = useCallback((topicId: string) => {
    setExpandedTopics((prev) => {
      const next = new Set(prev);
      if (next.has(topicId)) {
        next.delete(topicId);
      } else {
        next.add(topicId);
      }
      return next;
    });
  }, []);

  const focusTopicList = useCallback((topicId: string, nextStatus: Status | "all" | "revisit") => {
    setActiveProblem(null);
    setDrawerOpen(false);
    setSelectedTopic(topicId);
    setStatusFilter(nextStatus);
    setMobileSidebarOpen(false);
  }, []);

  const openAddDrawer = useCallback((topicId?: string) => {
    setActiveProblem(null);
    setDrawerMode("edit");
    setForm({
      ...emptyForm,
      topicId: topicId ?? (selectedTopic !== "all" ? selectedTopic : topics[0]?._id ?? ""),
      roadmapSection: selectedTopicData?.name ?? "",
    });
    setDrawerOpen(true);
  }, [selectedTopic, selectedTopicData?.name, topics]);





  const startRevisionPractice = useCallback((problem: Problem) => {
    // Open the study workspace so the user can see their notes and recall prompts
    openStudyView(problem);
  }, [openStudyView]);

  const openEditDrawer = useCallback((problem: Problem) => {
    setActiveProblem(problem);
    setDrawerMode("edit");
    syncFormFromProblem(problem);
    setDrawerOpen(true);
    void hydrateProblemDetails(problem).then((nextProblem) => {
      setActiveProblem(nextProblem);
      syncFormFromProblem(nextProblem);
    }).catch((err) => {
      setError(err instanceof Error ? err.message : "Could not load problem details");
    });
  }, [hydrateProblemDetails, syncFormFromProblem]);

  const openProblemDrawer = useCallback((problem: Problem) => {
    openStudyView(problem);
  }, [openStudyView]);

  const saveProblem = useCallback(async (options?: { keepWorkspaceOpen?: boolean }) => {
    if (!form.title.trim() || !form.topicId || !form.platformName.trim() || !form.platformUrl.trim()) {
      setError("Title, topic, platform name, and platform link are required.");
      setWorkspaceSaveState("error");
      return;
    }

    try {
      setSaving(true);
      setWorkspaceSaveState("saving");
      setError("");
      const payload = {
        title: form.title.trim(),
        topicId: form.topicId,
        roadmapSection: form.roadmapSection.trim(),
        platformName: form.platformName.trim(),
        platformUrl: form.platformUrl.trim(),
        difficulty: form.difficulty,
        status: form.status,
        pattern: form.pattern,
        invariant: form.invariant,
        compareBruteForce: form.compareBruteForce,
        compareOptimized: form.compareOptimized,
        compareWhyBetter: form.compareWhyBetter,
        prerequisites: form.prerequisites,
        rating: form.rating,
        shortNote: form.shortNote,
        longNote: form.longNote,
        codeSnippet: form.codeSnippet,
        codeSnippetLang: form.codeSnippetLang,
        mistakeTrigger: form.mistakeTrigger,
        mistakeReason: form.mistakeReason,
        mistakeFix: form.mistakeFix,
        mistakeLog: composeMistakeLog(form.mistakeTrigger, form.mistakeReason, form.mistakeFix),
        tags: form.tags
          .split(",")
          .map((tag) => tag.trim())
          .filter(Boolean),
        priority: form.priority,
        isPinned: form.isPinned,
      };

      saveLocalProgressItem(payload.title, { status: payload.status, isPinned: payload.isPinned });

      if (activeProblem) {
        saveLocalProgressItem(activeProblem._id, { status: payload.status, isPinned: payload.isPinned });
        const response = await api<{ problem: Problem }>(`/api/problems/${activeProblem._id}`, {
          method: "PATCH",
          body: JSON.stringify(payload),
        });
        upsertProblem(response.problem);
        setActiveProblem(response.problem);
        if (!options?.keepWorkspaceOpen) {
          syncFormFromProblem(response.problem);
        }
      } else {
        const response = await api<{ problem: Problem }>("/api/problems", {
          method: "POST",
          body: JSON.stringify(payload),
        });
        saveLocalProgressItem(response.problem._id, { status: response.problem.status, isPinned: response.problem.isPinned });
        appendProblem(response.problem);
        setActiveProblem(response.problem);
        if (!options?.keepWorkspaceOpen) {
          syncFormFromProblem(response.problem);
        }
      }

      if (drawerOpen) {
        setDrawerOpen(false);
      }

      if (!activeProblem && !options?.keepWorkspaceOpen) {
        setForm(emptyForm);
      }
      // Only do a full silent refresh on manual saves (drawer/form), not on every workspace autosave
      if (!options?.keepWorkspaceOpen) {
        void loadData({ silent: true });
      }
      setWorkspaceSaveState("saved");
      setLastSavedAt(new Date());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save problem");
      setWorkspaceSaveState("error");
    } finally {
      setSaving(false);
    }
  }, [activeProblem, appendProblem, drawerOpen, form, loadData, setError, setSaving, setDrawerOpen, setActiveProblem, setForm, syncFormFromProblem, upsertProblem]);

  useEffect(() => {
    if (!activeProblem || drawerOpen) {
      if (workspaceSaveTimerRef.current !== null) {
        window.clearTimeout(workspaceSaveTimerRef.current);
        workspaceSaveTimerRef.current = null;
      }
      return;
    }

    if (skipWorkspaceAutosaveRef.current) {
      skipWorkspaceAutosaveRef.current = false;
      return;
    }

    const baselineShortNote = activeProblem.shortNote ?? "";
    const baselineLongNote = activeProblem.longNote ?? "";
    const baselineTrigger = activeProblem.mistakeTrigger ?? splitMistakeLog(activeProblem.mistakeLog).trigger;
    const baselineReason = activeProblem.mistakeReason ?? splitMistakeLog(activeProblem.mistakeLog).reason;
    const baselineFix = activeProblem.mistakeFix ?? splitMistakeLog(activeProblem.mistakeLog).fix;

    const hasWorkspaceChanges =
      form.pattern !== (activeProblem.pattern ?? "") ||
      form.compareOptimized !== (activeProblem.compareOptimized ?? "") ||
      form.compareWhyBetter !== (activeProblem.compareWhyBetter ?? "") ||
      form.shortNote !== baselineShortNote ||
      form.longNote !== baselineLongNote ||
      form.codeSnippet !== (activeProblem.codeSnippet ?? "") ||
      form.mistakeTrigger !== baselineTrigger ||
      form.mistakeReason !== baselineReason ||
      form.mistakeFix !== baselineFix ||
      JSON.stringify(form.prerequisites) !== JSON.stringify(activeProblem.prerequisites ?? []);

    if (!hasWorkspaceChanges) {
      setWorkspaceSaveState((current) => (current === "saving" ? current : "idle"));
      if (workspaceSaveTimerRef.current !== null) {
        window.clearTimeout(workspaceSaveTimerRef.current);
        workspaceSaveTimerRef.current = null;
      }
      return;
    }

    setWorkspaceSaveState("dirty");
    if (workspaceSaveTimerRef.current !== null) {
      window.clearTimeout(workspaceSaveTimerRef.current);
    }

    workspaceSaveTimerRef.current = window.setTimeout(() => {
      void saveProblem({ keepWorkspaceOpen: true });
      workspaceSaveTimerRef.current = null;
    }, 900);

    return () => {
      if (workspaceSaveTimerRef.current !== null) {
        window.clearTimeout(workspaceSaveTimerRef.current);
        workspaceSaveTimerRef.current = null;
      }
    };
  }, [
    activeProblem,
    drawerOpen,
    form.codeSnippet,
    form.codeSnippetLang,
    form.compareOptimized,
    form.compareWhyBetter,
    form.longNote,
    form.mistakeFix,
    form.mistakeReason,
    form.mistakeTrigger,
    form.pattern,
    form.shortNote,
    saveProblem,
  ]);

  useEffect(() => {
    if (workspaceSaveState !== "saved") {
      return;
    }

    const timer = window.setTimeout(() => {
      setWorkspaceSaveState("idle");
    }, 1400);

    return () => window.clearTimeout(timer);
  }, [workspaceSaveState]);

  useEffect(() => {
    if (!isAuthenticated || restoredViewRef.current || problems.length === 0) {
      return;
    }

    restoredViewRef.current = true;
    const activeProblemId = persistedViewState.activeProblemId;
    if (!activeProblemId) {
      return;
    }

    const matchedProblem = problems.find((problem) => problem._id === activeProblemId);
    if (!matchedProblem) {
      return;
    }

    if (persistedViewState.drawerOpen) {
      if (persistedViewState.drawerMode === "edit") {
        openEditDrawer(matchedProblem);
      } else {
        setActiveProblem(matchedProblem);
        setDrawerMode("notes");
        setDrawerOpen(true);
        syncFormFromProblem(matchedProblem);
        void hydrateProblemDetails(matchedProblem).then((nextProblem) => {
          setActiveProblem(nextProblem);
          syncFormFromProblem(nextProblem);
        }).catch((err) => {
          setError(err instanceof Error ? err.message : "Could not load problem details");
        });
      }
      return;
    }

    openStudyView(matchedProblem);
  }, [
    hydrateProblemDetails,
    isAuthenticated,
    openEditDrawer,
    openStudyView,
    persistedViewState.activeProblemId,
    persistedViewState.drawerMode,
    persistedViewState.drawerOpen,
    problems,
    syncFormFromProblem,
  ]);

  const toggleProblemExpanded = useCallback((problemId: string) => {

    setExpandedProblems((current) => {
      const next = new Set(current);
      if (next.has(problemId)) {
        next.delete(problemId);
      } else {
        next.add(problemId);
      }

      return next;
    });
  }, []);

  const updateStatus = useCallback(async (problem: Problem, nextStatus: Status) => {
    const seq = nextMutationSeq(problem._id);
    const optimisticProblem = withStatusSchedule(problem, nextStatus, new Date(), activeSrsPreset.intervals);
    saveLocalProgressForProblem(optimisticProblem, getProblemProgressSnapshot(optimisticProblem));
    upsertProblem(optimisticProblem);
    if (activeProblem?._id === problem._id) {
      setActiveProblem(optimisticProblem);
      syncFormFromProblem(optimisticProblem);
    }
    if (problem.status !== "solved" && nextStatus === "solved") {
      appendActivityRecord("solved", optimisticProblem, optimisticProblem.topic);
      // Trigger solve flash animation; auto-clear after animation completes
      setJustSolvedIds((prev) => new Set(prev).add(problem._id));
      setTimeout(() => {
        setJustSolvedIds((prev) => { const next = new Set(prev); next.delete(problem._id); return next; });
      }, 1800);
    } else if (problem.status !== "revisit" && nextStatus === "revisit") {
      appendActivityRecord("revisit", optimisticProblem, optimisticProblem.topic);
    }
    setNow(Date.now());

    try {
      const response = await api<{ problem: Problem }>(`/api/problems/${problem._id}`, {
        method: "PATCH",
        body: JSON.stringify({ status: nextStatus }),
      });
      if (!isLatestMutation(problem._id, seq)) {
        return;
      }
      upsertProblem(response.problem);
      if (activeProblem?._id === problem._id) {
        setActiveProblem(response.problem);
        syncFormFromProblem(response.problem);
      }
      setNow(Date.now());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update status");
    }
  }, [activeProblem, activeSrsPreset.intervals, appendActivityRecord, isLatestMutation, nextMutationSeq, setError, setActiveProblem, syncFormFromProblem, upsertProblem]);

  useProblemKeyboardNavigation({
    sortedFilteredProblems,
    focusedProblemId: kbFocusedId,
    setFocusedProblemId: setKbFocusedId,
    updateStatus,
    openStudyView,
    openEditDrawer,
    openProblemLink,
  });

  const completeRevision = useCallback(async (problem: Problem) => {
    // Guard: prevent double-tap (race between click and completingRevisionIds set)
    if (completingRevisionIds.has(problem._id)) {
      return;
    }
    const seq = nextMutationSeq(problem._id);
    const completedAt = new Date();
    const optimisticProblem = normalizeProblemRevisionDates({ ...problem, updatedAt: completedAt.toISOString() });
    if (optimisticProblem.status === "unsolved") {
      optimisticProblem.status = "solved";
      optimisticProblem.solvedAt = optimisticProblem.solvedAt ?? completedAt.toISOString();
    }
    advanceRevisionSchedule(optimisticProblem, completedAt, activeSrsPreset.intervals);
    saveLocalProgressForProblem(optimisticProblem, getProblemProgressSnapshot(optimisticProblem));
    // Set completingRevisionIds BEFORE the async work to block any second click
    setCompletingRevisionIds((prev) => new Set(prev).add(problem._id));
    upsertProblem(optimisticProblem);
    if (activeProblem?._id === problem._id) {
      setActiveProblem(optimisticProblem);
      syncFormFromProblem(optimisticProblem);
    }
    appendActivityRecord("revision", optimisticProblem, optimisticProblem.topic, completedAt);
    setNow(Date.now());

    try {
      const response = await api<{ problem: Problem }>(`/api/problems/${problem._id}/revision`, {
        method: "POST",
        body: JSON.stringify({ srsIntervals: activeSrsPreset.intervals }),
      });
      if (!isLatestMutation(problem._id, seq)) {
        return;
      }
      upsertProblem(response.problem);
      saveLocalProgressForProblem(response.problem, getProblemProgressSnapshot(response.problem));

      if (activeProblem?._id === problem._id) {
        setActiveProblem(response.problem);
        syncFormFromProblem(response.problem);
      }
      setNow(Date.now());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update revision schedule");
    } finally {
      setCompletingRevisionIds((prev) => {
        const next = new Set(prev);
        next.delete(problem._id);
        return next;
      });
    }
  }, [activeProblem, activeSrsPreset.intervals, appendActivityRecord, completingRevisionIds, isLatestMutation, nextMutationSeq, setError, setActiveProblem, syncFormFromProblem, upsertProblem]);

  const snoozeRevision = useCallback(async (problem: Problem, days = 1) => {
    if (snoozingRevisionIds.has(problem._id)) return;
    setSnoozingRevisionIds((prev) => new Set(prev).add(problem._id));
    // Optimistic update: push nextRevisionAt forward
    const base = toValidDate(problem.nextRevisionAt) ?? new Date();
    const optimisticProblem = {
      ...problem,
      nextRevisionAt: addDays(base, days).toISOString(),
      updatedAt: new Date().toISOString(),
    };
    upsertProblem(optimisticProblem);
    try {
      const response = await api<{ problem: Problem }>(`/api/problems/${problem._id}/snooze`, {
        method: "POST",
        body: JSON.stringify({ days }),
      });
      upsertProblem(response.problem);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not snooze revision");
      upsertProblem(problem); // revert on failure
    } finally {
      setSnoozingRevisionIds((prev) => { const next = new Set(prev); next.delete(problem._id); return next; });
    }
    setNow(Date.now());
  }, [snoozingRevisionIds, upsertProblem, setError]);

  const deleteProblem = useCallback(async (problemId: string) => {
    try {
      const target = problems.find((p) => p._id === problemId);
      if (target) {
        removeLocalProgressItem(target.title);
      }
      removeLocalProgressItem(problemId);

      await api(`/api/problems/${problemId}`, { method: "DELETE" });
      // Only remove from UI after confirmed server deletion.
      // Removing before the await would permanently lose the problem on network failure.
      removeProblem(problemId);
      if (activeProblem?._id === problemId) {
        setDrawerOpen(false);
        setActiveProblem(null);
      }
      void loadData({ silent: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not delete problem");
    }
  }, [activeProblem, loadData, problems, removeProblem, setDrawerOpen, setActiveProblem, setError]);

  const togglePin = useCallback(async (problem: Problem) => {
    const seq = nextMutationSeq(problem._id);
    const nextPinned = !problem.isPinned;
    const optimisticProblem = { ...problem, isPinned: nextPinned, updatedAt: new Date().toISOString() };
    saveLocalProgressForProblem(optimisticProblem, getProblemProgressSnapshot(optimisticProblem));
    upsertProblem(optimisticProblem);
    if (activeProblem?._id === problem._id) {
      setActiveProblem(optimisticProblem);
      syncFormFromProblem(optimisticProblem);
    }

    try {
      const response = await api<{ problem: Problem }>(`/api/problems/${problem._id}`, {
        method: "PATCH",
        body: JSON.stringify({ isPinned: nextPinned }),
      });
      if (!isLatestMutation(problem._id, seq)) {
        return;
      }
      upsertProblem(response.problem);
      if (activeProblem?._id === problem._id) {
        setActiveProblem(response.problem);
        syncFormFromProblem(response.problem);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not toggle pin");
    }
  }, [activeProblem, isLatestMutation, nextMutationSeq, setError, syncFormFromProblem, upsertProblem]);

  const progress = stats && stats.totalProblems > 0 ? Math.round((stats.solvedProblems / stats.totalProblems) * 100) : 0;
  const visibleProgress =
    visibleStats && visibleStats.totalProblems > 0
      ? Math.round((visibleStats.solvedProblems / visibleStats.totalProblems) * 100)
      : 0;

  const authView = (
    <AuthView
      loginConfigured={loginConfigured}
      loginForm={loginForm}
      loginError={loginError}
      onLogin={handleLogin}
      onLoginFormChange={setLoginForm}
    />
  );

  const dashboardView = (
    <div className="app-shell focus-mode">
      <AppSidebar
        isOpen={mobileSidebarOpen}
        selectedTopic={selectedTopic}
        selectedProblemSet={selectedProblemSet}
        topics={topics}
        problemCount={problems.length}
        generalNotesCount={generalNotes.length}
        dueRevisionCount={dueRevisionProblems.length}
        topicStatsMap={topicStatsMap}
        onOpen={() => setMobileSidebarOpen(true)}
        onClose={() => setMobileSidebarOpen(false)}
        onRefresh={() => void loadData()}
        onProblemSetChange={setSelectedProblemSet}
        onFocusTopic={focusTopicList}
        onOpenRevision={() => {
          setSelectedTopic("revision");
          setStatusFilter("revisit");
          setMobileSidebarOpen(false);
        }}
        onOpenGeneralNotes={() => {
          setSelectedTopic("general_notes");
          setStatusFilter("all");
          setMobileSidebarOpen(false);
        }}
      />

      <main className="content">
        <AppHero
          editMode={editMode}
          exportingData={exportingData}
          onAdd={() => openAddDrawer()}
          onToggleEditMode={() => setEditMode((value) => !value)}
          onRefresh={() => void loadData()}
          onExport={() => void handleExportData()}
          onLogout={handleLogout}
        />

        {error ? <div className="banner error">{error}</div> : null}

        {selectedTopic === "general_notes" ? (
          <GeneralNotesView
            notes={generalNotes}
            onOpenCreate={() => {
              setEditingGeneralNote(null);
              setGeneralNoteModalOpen(true);
            }}
            onOpenEdit={(note) => {
              setEditingGeneralNote(note);
              setGeneralNoteModalOpen(true);
            }}
            onDeleteNote={handleDeleteGeneralNote}
            onTogglePinNote={handleTogglePinGeneralNote}
            isFocusMode={true}
          />
        ) : (
          <>
            <DashboardStats
              selectedTopic={selectedTopic}
              stats={stats}
              visibleStats={visibleStats}
              progress={progress}
              visibleProgress={visibleProgress}
              statusFilter={statusFilter}
              setStatusFilter={setStatusFilter}
            />

        {selectedTopic === "revision" ? (
          <div className="revisit-subtabs-bar">
            <div className="revisit-segmented-control">
              <button
                type="button"
                className={`revisit-tab-btn ${revisitSubTab === "queue" ? "active" : ""}`}
                onClick={() => setRevisitSubTab("queue")}
              >
                <span>🎯 Revision Queue</span>
                <span className="revisit-tab-count">{dueRevisionProblems.length + sidebarRevisionProblems.length}</span>
              </button>
              <button
                type="button"
                className={`revisit-tab-btn ${revisitSubTab === "heatmap" ? "active" : ""}`}
                onClick={() => setRevisitSubTab("heatmap")}
              >
                <span>📊 Activity</span>
                {activityInsights.currentStreak > 0 ? (
                  <span className="revisit-streak-badge">🔥 {activityInsights.currentStreak}d</span>
                ) : null}
              </button>
              <button
                type="button"
                className={`revisit-tab-btn ${revisitSubTab === "all" ? "active" : ""}`}
                onClick={() => setRevisitSubTab("all")}
              >
                <span>📈 Analytics</span>
              </button>
            </div>
            {/* Inline streak badge on Queue tab too */}
            {revisitSubTab === "queue" && activityInsights.currentStreak > 0 ? (
              <div className="revision-streak-inline">
                🔥 {activityInsights.currentStreak} day streak
              </div>
            ) : null}

            {revisitSubTab === "queue" || revisitSubTab === "all" ? (
              <div className="revisit-toolbar">
                <div className="srs-preset-control" title={activeSrsPreset.desc}>
                  <span className="srs-preset-label">Schedule:</span>
                  <select
                    className="srs-preset-select"
                    value={srsPresetKey}
                    onChange={(e) => handleSrsPresetChange(e.target.value as SrsPresetKey)}
                  >
                    {Object.values(SRS_PRESETS).map((preset) => (
                      <option key={preset.key} value={preset.key}>
                        {preset.name} ({preset.badge})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="revisit-search-box">
                  <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="11" cy="11" r="8"></circle>
                    <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                  </svg>
                  <input
                    type="text"
                    placeholder="Search revision..."
                    value={revisionSearch}
                    onChange={(e) => setRevisionSearch(e.target.value)}
                  />
                  {revisionSearch ? (
                    <button type="button" className="clear-search-btn" onClick={() => setRevisionSearch("")}>×</button>
                  ) : null}
                </div>

                <div className="revisit-diff-pills">
                  {(["all", "Easy", "Medium", "Hard"] as const).map((diff) => (
                    <button
                      key={diff}
                      type="button"
                      className={`diff-filter-pill ${diff.toLowerCase()} ${revisionDifficulty === diff ? "active" : ""}`}
                      onClick={() => setRevisionDifficulty(diff)}
                    >
                      {diff === "all" ? "All Diff" : diff}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        ) : null}

        {selectedTopic === "revision" && revisitSubTab === "heatmap" ? (
          <ActivityInsightsPanel
            insights={activityInsights}
            scopeLabel={selectedTopicData?.name ?? "All topics"}
            problemLookup={problemLookup}
            nowDate={nowDate}
            onOpenProblem={(problemId) => {
              void openProblemById(problemId);
            }}
            onCompleteRevision={(problemId) => {
              const matchedProblem = problemLookup.get(problemId);
              if (matchedProblem && isRevisionActionable(matchedProblem, nowDate)) {
                void completeRevision(matchedProblem);
              }
            }}
            onFilterTopic={(topicId) => focusTopicList(topicId, "all")}
          />
        ) : null}

        {selectedTopic === "revision" && revisitSubTab === "all" ? (
          <AnalyticsDashboard
            problems={problems}
            activities={activities}
            nowDate={nowDate}
          />
        ) : null}


        {selectedTopic === "revision" && revisitSubTab === "queue" && showRevisionDashboard ? (
          <RevisionDashboard
            presetName={activeSrsPreset.name}
            presetDesc={activeSrsPreset.desc}
            intervalCount={activeSrsPreset.intervals.length}
            revisionCount={revisionProblems.length}
            dueItems={filteredDueRevisionProblems}
            upcomingItems={filteredSidebarRevisionProblems}
            revisedTodayItems={filteredRevisedTodayProblems}
            allUpcomingItems={sidebarRevisionProblems}
            nextRevisionCandidate={nextRevisionCandidate}
            completingRevisionIds={completingRevisionIds}
            snoozingRevisionIds={snoozingRevisionIds}
            currentStreak={activityInsights.currentStreak}
            dueLaneExpanded={dueLaneExpanded}
            comingUpLaneExpanded={comingUpLaneExpanded}
            revisedTodayLaneExpanded={revisedTodayLaneExpanded}
            setDueLaneExpanded={setDueLaneExpanded}
            setComingUpLaneExpanded={setComingUpLaneExpanded}
            setRevisedTodayLaneExpanded={setRevisedTodayLaneExpanded}
            onStartRevision={startRevisionPractice}
            onOpenWorkspace={handleWorkspaceClick}
            onCompleteRevision={(problem) => void completeRevision(problem)}
            onSnoozeRevision={(problem, days) => void snoozeRevision(problem, days)}
            onOpenLink={openProblemLink}
          />
        ) : null}

        {activeProblem && !drawerOpen ? (
          <ProblemWorkspaceView
            activeProblem={activeProblem}
            activeRevisionState={activeRevisionState}
            form={form}
            setForm={setForm}
            workspaceSaveState={workspaceSaveState}
            lastSavedAt={lastSavedAt}
            activeWorkspaceIndex={activeWorkspaceIndex}
            workspaceProblemIds={workspaceProblemIds}
            previousWorkspaceProblem={previousWorkspaceProblem}
            nextWorkspaceProblem={nextWorkspaceProblem}
            saving={saving}
            completingRevisionIds={completingRevisionIds}
            onOpenStudyView={openStudyView}
            onBackToList={() => setActiveProblem(null)}
            onOpenProblemLink={openProblemLink}
            onCompleteRevision={(prob) => void completeRevision(prob)}
            onOpenEditDrawer={openEditDrawer}
            onSaveProblem={() => void saveProblem()}
          />
        ) : (
          <>
            <ProblemListView
              search={search}
              sortByFilter={sortByFilter}
              difficultyFilter={difficultyFilter}
              ratingFilter={ratingFilter}
              selectedTopic={selectedTopic}
              selectedTopicName={selectedTopicData?.name ?? null}
              statusFilter={statusFilter}
              filteredProblemCount={filteredProblems.length}
              groupedByTopicAndSection={groupedByTopicAndSection}
              loading={loading}
              editMode={editMode}
              expandedTopics={expandedTopics}
              deferredSearch={deferredSearch}
              revisionStateMap={revisionStateMap}
              problemCategoryMap={problemCategoryMap}
              nowDate={nowDate}
              justSolvedIds={justSolvedIds}
              kbFocusedId={kbFocusedId}
              sectionRowLimit={sectionRowLimit}
              setSearch={setSearch}
              setSortByFilter={setSortByFilter}
              setDifficultyFilter={setDifficultyFilter}
              setRatingFilter={setRatingFilter}
              setSectionRowLimit={setSectionRowLimit}
              onQuickAdd={() => openAddDrawer(selectedTopic !== "all" ? selectedTopic : undefined)}
              onToggleTopicExpanded={toggleTopicExpanded}
              onOpenStudy={handleWorkspaceClick}
              onToggleStatus={updateStatus}
              onOpenEdit={openEditDrawer}
              onTogglePin={togglePin}
              onOpenLink={openProblemLink}
              onDelete={deleteProblem}
            />
          </>
        )}
          </>
        )}
      </main>

      <ProblemDrawer
        isOpen={drawerOpen}
        mode={drawerMode}
        activeProblem={activeProblem}
        activeRevisionState={activeRevisionState}
        form={form}
        setForm={setForm}
        saving={saving}
        topics={topics}
        onClose={() => setDrawerOpen(false)}
        onSave={() => void saveProblem()}
        onOpenLink={openProblemLink}
      />

      {previewNoteProblem ? (
        <NotesPreviewModal
          problem={previewNoteProblem}
          onClose={() => setPreviewNoteProblem(null)}
          onOpenWorkspace={(prob) => openStudyView(prob)}
          onOpenEdit={(prob) => openEditDrawer(prob)}
          onOpenLink={(prob) => openProblemLink(prob)}
        />
      ) : null}

      <GeneralNoteModal
        isOpen={generalNoteModalOpen}
        note={editingGeneralNote}
        onClose={() => setGeneralNoteModalOpen(false)}
        onSave={handleSaveGeneralNote}
      />
    </div>
  );

  return isAuthenticated ? dashboardView : authView;
}

import { memo, useCallback, useDeferredValue, useEffect, useMemo, useRef, useState, Fragment, type FormEvent } from "react";
import { topicSubCategories } from "./data/categories";
import type { Prerequisite, PatternFamilyItem, GeneralNote } from "./api/types";
import { GeneralNotesView } from "./components/GeneralNotesView";
import { GeneralNoteModal } from "./components/GeneralNoteModal";
import { addDays, advanceRevisionSchedule, clearRevisionSchedule, deriveRevisionState, initializeRevisionSchedule, startOfDay, toValidDate, SRS_PRESETS, type SrsPresetKey } from "./revision";

import type {
  Difficulty,
  Status,
  SortByOption,
  Topic,
  Problem,
  Stats,
  ProblemFormState,
  RevisionState,
  RevisionQueueMeta,
  ActivityKind,
  ActivityRecord,
  ActivityProblemSnapshot,
  ActivityTopicSnapshot,
  ActivityEntry,
  ActivityDayBucket,
  ActivityWeek,
  ActivityInsights,
  RecallPrompt,
  RatingFilterOption,
  PersistedViewState,
  WorkspaceSaveState,
  SavedProblemProgress,
  LocalProgressMap,
} from "./appTypes";

import {
  toDateKey,
  fromDateKey,
  getWeekdayIndex,
  daysBetween,
  formatActivityDate,
  formatActivityLevel,
  createEmptyInsights,
  buildActivityInsights,
} from "./utils/activityUtils";

import {
  formatRating,
  composeMistakeLog,
  splitMistakeLog,
  buildRecallPrompts,
  formatRevisionDueText,
  getRevisionState,
  getRevisionQueueMeta,
  getProblemCategories,
  hasNoteContent,
} from "./utils/problemUtils";

import {
  AUTH_STORAGE_KEY,
  APP_VIEW_STATE_KEY,
  LOCAL_PROGRESS_STORAGE_KEY,
  LOCAL_ACTIVITY_STORAGE_PREFIX,
  readPersistedViewState,
  readLocalProgress,
  saveLocalProgressItem,
  saveLocalProgressForProblem,
  getSavedProgressForProblem,
  applySavedProgress,
  getProblemProgressSnapshot,
  toIsoStringOrUndefined,
  normalizeProblemRevisionDates,
  withStatusSchedule,
  removeLocalProgressItem,
  deduplicateProblems,
  activityStorageKey,
  getActivityDedupeKey,
  mergeActivityRecords,
  isRevisionActionable,
  readLocalActivities,
  writeLocalActivities,
  api,
} from "./utils/storageUtils";

import { ProblemRow } from "./components/ProblemRow";
import { SectionBlock } from "./components/SectionBlock";
import { NotesPreviewModal } from "./components/NotesPreviewModal";
import { ActivityInsightsPanel } from "./components/ActivityInsightsPanel";
import { StatCard, SectionBadge, ActiveRecallPanel } from "./components/StatCards";
import { ProblemPrerequisitesSection, PatternFamilySection } from "./components/PrerequisitesSections";
import { ProblemWorkspaceView } from "./components/ProblemWorkspaceView";
import { ProblemDrawer } from "./components/ProblemDrawer";

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
  mistakeLog: "",
  mistakeTrigger: "",
  mistakeReason: "",
  mistakeFix: "",
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

const DEFAULT_LOGIN = {
  username: __LOGIN_USERNAME__.trim(),
  password: __LOGIN_PASSWORD__,
};


export default function App() {
  const loginConfigured = Boolean(DEFAULT_LOGIN.username && DEFAULT_LOGIN.password);
  const persistedViewState = useMemo(() => readPersistedViewState(), []);
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

  const handleSaveGeneralNote = async (noteData: Partial<GeneralNote>) => {
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
      setGeneralNotes((prev) =>
        prev.map((n) =>
          n._id === editingGeneralNote._id ? ({ ...n, ...noteData, updatedAt: new Date() } as GeneralNote) : n
        )
      );
    } else {
      try {
        const res = await api<{ note: GeneralNote }>("/api/general-notes", {
          method: "POST",
          body: JSON.stringify(noteData),
        });
        if (res.note) {
          setGeneralNotes((prev) => [res.note, ...prev]);
          return;
        }
      } catch {}
      const newNote: GeneralNote = {
        _id: `note:${Date.now()}`,
        title: noteData.title || "Untitled Note",
        category: noteData.category || "Algorithmic Patterns",
        summary: noteData.summary || "",
        content: noteData.content || "",
        keyTakeaways: noteData.keyTakeaways || [],
        mistakesToAvoid: noteData.mistakesToAvoid || [],
        codeSnippets: noteData.codeSnippets || [],
        tags: noteData.tags || [],
        importance: noteData.importance || "Important",
        isPinned: Boolean(noteData.isPinned),
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      setGeneralNotes((prev) => [newNote, ...prev]);
    }
  };

  const handleDeleteGeneralNote = async (noteId: string) => {
    try {
      await api(`/api/general-notes/${noteId}`, { method: "DELETE" });
    } catch {}
    setGeneralNotes((prev) => prev.filter((n) => n._id !== noteId));
  };

  const handleTogglePinGeneralNote = async (note: GeneralNote) => {
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
  };


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
    if (didInitialLoadRef.current) {
      void loadData({ silent: false });
    }
    setSelectedTopic("all");
    setDrawerOpen(false);
    setActiveProblem(null);
  }, [selectedProblemSet]);

  const [drawerMode, setDrawerMode] = useState<"edit" | "notes">(persistedViewState.drawerMode ?? "notes");
  const [editMode, setEditMode] = useState(false);
  const [expandedProblems, setExpandedProblems] = useState<Set<string>>(() => new Set());
  const [expandedTopics, setExpandedTopics] = useState<Set<string>>(() => new Set());
  const [form, setForm] = useState<ProblemFormState>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [workspaceSaveState, setWorkspaceSaveState] = useState<WorkspaceSaveState>("idle");
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [completingRevisionIds, setCompletingRevisionIds] = useState<Set<string>>(() => new Set());
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
  };
  const [sectionRowLimit, setSectionRowLimit] = useState(20);
  const [isFocusMode, setIsFocusMode] = useState<boolean>(() => {
    if (typeof window === "undefined") {
      return false;
    }
    return window.localStorage.getItem("dsa_focus_mode") === "true";
  });

  useEffect(() => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem("dsa_focus_mode", String(isFocusMode));
    }
  }, [isFocusMode]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.altKey && (e.key === "f" || e.key === "F")) {
        e.preventDefault();
        setIsFocusMode((prev) => !prev);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
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
    const revisitProblems = problems.filter((problem) => problem.status === "revisit").length;
    const unsolvedProblems = problems.filter((problem) => problem.status === "unsolved").length;
    const skippedProblems = problems.filter((problem) => problem.status === "skipped").length;

    return {
      totalProblems,
      solvedProblems,
      revisitProblems,
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
      revisitProblems: topicProblems.filter((problem) => problem.status === "revisit").length,
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
      setTopics(topicsRes.topics);
      setProblems(deduplicateProblems(patchedProblems));
      setActivities(mergedActivities);
      writeLocalActivities(selectedProblemSet, mergedActivities);
      void loadGeneralNotes();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    }
  }, [loadGeneralNotes, selectedProblemSet]);

  async function loadData(options?: { silent?: boolean }) {
    try {
      if (!options?.silent) {
        setLoading(true);
      }
      setError("");
      await handleSilentRefresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

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
          setPreviewNoteProblem(nextProblem);
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
  }, [isAuthenticated]);

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
    const topicGroups: Array<{
      topicId: string;
      topicName: string;
      accent: string;
      solvedCount: number;
      totalCount: number;
      sections: Array<{
        sectionKey: string;
        sectionName: string;
        solvedCount: number;
        totalCount: number;
        problems: Array<{ problem: Problem; displayIndex: number }>;
      }>;
    }> = [];
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
      form.mistakeTrigger !== baselineTrigger ||
      form.mistakeReason !== baselineReason ||
      form.mistakeFix !== baselineFix
    );
  }, [
    activeProblem,
    drawerOpen,
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

  const dueRevisionProblems = useMemo(() => {
    return [...revisionProblems]
      .map((problem) => ({ problem, state: revisionStateMap.get(problem._id) ?? getRevisionState(problem, nowDate) }))
      .filter(({ state }) => state.isDue || state.isOverdue)
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
    const problemsById = new Map(problems.map((problem) => [problem._id, problem]));
    const todayKey = toDateKey(nowDate);
    const seenTitles = new Set<string>();

    return activities
      .filter((activity) => activity.kind === "revision" && toDateKey(new Date(activity.occurredAt)) === todayKey)
      .sort((left, right) => new Date(right.occurredAt).getTime() - new Date(left.occurredAt).getTime())
      .map((activity) => problemsById.get(activity.problem._id))
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
  }, [activities, nowDate, problems, revisionStateMap]);

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
  const showRevisionDashboard =
    statusFilter === "revisit" && (revisionProblems.length > 0 || revisedTodayProblems.length > 0);

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
    openProblemLink(problem);
  }, [openProblemLink]);

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
      void loadData({ silent: true });
      setWorkspaceSaveState("saved");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save problem");
      setWorkspaceSaveState("error");
    } finally {
      setSaving(false);
    }
  }, [activeProblem, appendProblem, drawerOpen, form, setError, setSaving, setDrawerOpen, setActiveProblem, setForm, syncFormFromProblem, upsertProblem]);

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

  const completeRevision = useCallback(async (problem: Problem) => {
    const seq = nextMutationSeq(problem._id);
    const completedAt = new Date();
    const optimisticProblem = normalizeProblemRevisionDates({ ...problem, updatedAt: completedAt.toISOString() });
    if (optimisticProblem.status === "unsolved") {
      optimisticProblem.status = "solved";
      optimisticProblem.solvedAt = optimisticProblem.solvedAt ?? completedAt.toISOString();
    }
    advanceRevisionSchedule(optimisticProblem, completedAt, activeSrsPreset.intervals);
    saveLocalProgressForProblem(optimisticProblem, getProblemProgressSnapshot(optimisticProblem));
    upsertProblem(optimisticProblem);
    if (activeProblem?._id === problem._id) {
      setActiveProblem(optimisticProblem);
      syncFormFromProblem(optimisticProblem);
    }
    appendActivityRecord("revision", optimisticProblem, optimisticProblem.topic, completedAt);
    setNow(Date.now());

    try {
      setCompletingRevisionIds((prev) => new Set(prev).add(problem._id));
      const response = await api<{ problem: Problem }>(`/api/problems/${problem._id}/revision`, {
        method: "POST",
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
  }, [activeProblem, activeSrsPreset.intervals, appendActivityRecord, isLatestMutation, nextMutationSeq, setError, setActiveProblem, syncFormFromProblem, upsertProblem]);

  const deleteProblem = useCallback(async (problemId: string) => {
    try {
      const target = problems.find((p) => p._id === problemId);
      if (target) {
        removeLocalProgressItem(target.title);
      }
      removeLocalProgressItem(problemId);

      await api(`/api/problems/${problemId}`, { method: "DELETE" });
      removeProblem(problemId);
      if (activeProblem?._id === problemId) {
        setDrawerOpen(false);
        setActiveProblem(null);
      }
      void loadData({ silent: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not delete problem");
    }
  }, [activeProblem, problems, removeProblem, setDrawerOpen, setActiveProblem, setError]);

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
    <div className={`app-shell ${isFocusMode ? "focus-mode" : ""}`}>
      {/* Sticky Mobile Top Bar */}
      <header className="mobile-header">
        <button className="menu-btn" onClick={() => setMobileSidebarOpen(true)} aria-label="Open menu">
          <svg viewBox="0 0 24 24" width="24" height="24" stroke="currentColor" strokeWidth="2.5" fill="none" strokeLinecap="round" strokeLinejoin="round">
            <line x1="3" y1="12" x2="21" y2="12"></line>
            <line x1="3" y1="6" x2="21" y2="6"></line>
            <line x1="3" y1="18" x2="21" y2="18"></line>
          </svg>
        </button>
        <span className="mobile-title">DSA Tracker</span>
        <div className="mobile-header-actions">
          <button
            className={`icon-btn ${isFocusMode ? "active" : ""}`}
            onClick={() => setIsFocusMode((prev) => !prev)}
            title="Toggle Focus Mode (Alt+F)"
          >
            🎯
          </button>
          <button className="icon-btn" onClick={() => void loadData()} title="Refresh">
            <svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" strokeWidth="2.5" fill="none" strokeLinecap="round" strokeLinejoin="round">
              <path d="M23 4v6h-6M1 20v-6h6"></path>
              <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path>
            </svg>
          </button>
        </div>
      </header>

      {/* Sidebar Backdrop Overlay on Mobile */}
      {mobileSidebarOpen ? (
        <div className="sidebar-backdrop" onClick={() => setMobileSidebarOpen(false)} />
      ) : null}

      <aside className={`sidebar ${mobileSidebarOpen ? "open" : ""}`}>
        <div className="sidebar-header-mobile">
          <span className="sidebar-mobile-title">Topics</span>
          <button className="close-btn" onClick={() => setMobileSidebarOpen(false)} aria-label="Close menu">
            <svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" strokeWidth="2.5" fill="none" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>

        <div className="brand">
          <div className="brand-mark">DSA</div>
          <div>
            <h1>Tracker</h1>
            <p>Problems and notes.</p>
          </div>
        </div>

        <div style={{ padding: "0 1rem", marginBottom: "1rem", marginTop: "-0.5rem" }}>
            <select
              value={selectedProblemSet}
              onChange={(e) => setSelectedProblemSet(e.target.value)}
              style={{
                width: "100%",
                padding: "0.5rem 0.75rem",
                borderRadius: "0.5rem",
                backgroundColor: "rgba(255,255,255,0.05)",
                border: "1px solid rgba(255,255,255,0.1)",
                color: "var(--text)",
                outline: "none",
                fontSize: "0.85rem",
                cursor: "pointer",
              }}
            >
              <option value="set1" style={{ backgroundColor: "var(--bg)", color: "var(--text)" }}>Main List (Set 1)</option>
              <option value="set2" style={{ backgroundColor: "var(--bg)", color: "var(--text)" }}>Problem Set 2</option>
              <option value="set3" style={{ backgroundColor: "var(--bg)", color: "var(--text)" }}>Problem Set 3</option>
            </select>
          </div>

        <button
          className={`topic-card all-topics ${selectedTopic === "all" ? "active" : ""}`}
          onClick={() => focusTopicList("all", "all")}
        >
          <div>
            <span className="topic-name">All Topics</span>
            <span className="topic-subtitle">{problems.length} records</span>
          </div>
          <span className="topic-count">{problems.length}</span>
        </button>

        <button
          className={`topic-card ${statusFilter === "revisit" && selectedTopic !== "general_notes" ? "active" : ""}`}
          onClick={() => focusTopicList("all", "revisit")}
        >
          <div className="topic-dot revision-dot" />
          <div className="topic-copy">
            <span className="topic-name">Revisit</span>
            <span className="topic-subtitle">{revisionProblems.length} scheduled</span>
          </div>
          <span className="topic-count">{revisionProblems.length}</span>
        </button>

        <button
          className={`topic-card ${selectedTopic === "general_notes" ? "active" : ""}`}
          onClick={() => {
            setSelectedTopic("general_notes");
            setStatusFilter("all");
            setMobileSidebarOpen(false);
          }}
          style={{
            borderLeft: selectedTopic === "general_notes" ? "3px solid #38bdf8" : undefined,
          }}
        >
          <div className="topic-dot" style={{ background: "#38bdf8" }} />
          <div className="topic-copy">
            <span className="topic-name">📓 General Notes</span>
            <span className="topic-subtitle">Findings & Cheat-sheets</span>
          </div>
          <span className="topic-count" style={{ background: "rgba(56, 189, 248, 0.18)", color: "#38bdf8" }}>
            {generalNotes.length}
          </span>
        </button>


        <div className="topic-list">
          {topics.map((topic) => {
            const active = selectedTopic === topic._id;
            const solved = topic.solvedCount ?? 0;
            const total = topic.totalProblems ?? 0;
            const slug = topic.slug;
            const subCategories = topicSubCategories[slug] ?? [];
            return (
              <div key={topic._id} className="sidebar-topic-group">
                <button
                  className={`topic-card ${active ? "active" : ""}`}
                  onClick={() => focusTopicList(topic._id, "all")}
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
                {subCategories.length > 0 ? (
                  <div className="topic-subcategory-list" aria-label={`${topic.name} subtopics`}>
                    {subCategories.map((sub) => (
                      <div key={sub.id} className="topic-subcategory-item">
                        {sub.label}
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>
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
            <button
              className={`secondary-btn focus-toggle-btn ${isFocusMode ? "active" : ""}`}
              onClick={() => setIsFocusMode((value) => !value)}
              title="Toggle Focus Mode (Alt+F)"
            >
              {isFocusMode ? "✨ Focus ON" : "🎯 Focus Mode"}
            </button>
            <button className="primary-btn" onClick={() => openAddDrawer()}>
              Add
            </button>
            <button
              className={`secondary-btn ${editMode ? "active" : ""}`}
              onClick={() => setEditMode((value) => !value)}
            >
              {editMode ? "Edit on" : "Edit off"}
            </button>
            <button className="secondary-btn" onClick={() => void loadData()}>
              Refresh
            </button>
            <button className="ghost-btn" onClick={handleLogout}>
              Logout
            </button>
          </div>
        </section>


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
            isFocusMode={isFocusMode}
          />
        ) : (
          <>
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

        {statusFilter === "revisit" ? (
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
                <span>📊 Activity & Heatmap</span>
              </button>
              <button
                type="button"
                className={`revisit-tab-btn ${revisitSubTab === "all" ? "active" : ""}`}
                onClick={() => setRevisitSubTab("all")}
              >
                <span>📚 All Revisit View</span>
              </button>
            </div>

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

        {statusFilter === "revisit" && (revisitSubTab === "heatmap" || revisitSubTab === "all") ? (
          <ActivityInsightsPanel
            insights={activityInsights}
            scopeLabel={selectedTopicData?.name ?? "All topics"}
            problemLookup={new Map(problems.map((problem) => [problem._id, problem]))}
            nowDate={nowDate}
            onOpenProblem={(problemId) => {
              void openProblemById(problemId);
            }}
            onCompleteRevision={(problemId) => {
              const matchedProblem = problems.find((problem) => problem._id === problemId);
              if (matchedProblem && isRevisionActionable(matchedProblem, nowDate)) {
                void completeRevision(matchedProblem);
              }
            }}
            onFilterTopic={(topicId) => focusTopicList(topicId, "all")}
          />
        ) : null}

        {statusFilter === "revisit" && (revisitSubTab === "queue" || revisitSubTab === "all") && showRevisionDashboard ? (
          <section className="revision-panel revision-dashboard">
            <div className="revision-dashboard-head">
              <div>
                <p className="panel-label">Spaced repetition ({activeSrsPreset.name})</p>
                <h3>Revision queue</h3>
                <p className="section-note">{revisionProblems.length} unique items scheduled · Pace: {activeSrsPreset.desc}</p>
              </div>
              <div className="revision-head-actions">
                <button
                  className="revision-action"
                  disabled={!nextRevisionCandidate}
                  onClick={() => {
                    if (nextRevisionCandidate) {
                      startRevisionPractice(nextRevisionCandidate);
                    }
                  }}
                >
                  Start next
                </button>
              </div>
            </div>

            <div className="revision-metrics">
              <div className="revision-metric-card urgent">
                <span>Due</span>
                <strong>{filteredDueRevisionProblems.length}</strong>
              </div>
              <div className="revision-metric-card">
                <span>Coming up</span>
                <strong>{filteredSidebarRevisionProblems.length}</strong>
              </div>
              <div className="revision-metric-card done">
                <span>Revised today</span>
                <strong>{filteredRevisedTodayProblems.length}</strong>
              </div>
            </div>

            <div className="revision-board">
              <div className="revision-lane due-lane">
                <div className="revision-lane-head">
                  <span className="revision-lane-kicker">Now</span>
                  <strong>Due to revise ({filteredDueRevisionProblems.length})</strong>
                </div>
                <div className="revision-list">
                  {filteredDueRevisionProblems.length > 0 ? (
                    (dueLaneExpanded ? filteredDueRevisionProblems : filteredDueRevisionProblems.slice(0, 5)).map(({ problem, state }) => {
                      const isChecked = state.isComplete || completingRevisionIds.has(problem._id);
                      return (
                        <article key={problem._id} className={`revision-card ${state.isOverdue ? "overdue" : "due"}`}>
                          <button
                            className={`revision-check ${isChecked ? "checked" : ""}`}
                            onClick={(event) => {
                              event.stopPropagation();
                              void completeRevision(problem);
                            }}
                            aria-label="Mark revision complete"
                            title="Mark done"
                            disabled={completingRevisionIds.has(problem._id)}
                          >
                            {isChecked ? "✓" : ""}
                          </button>
                          <div className="revision-card-copy">
                            <div className="revision-title-row">
                              <strong>{problem.title}</strong>
                              <button
                                type="button"
                                className="table-workspace-btn revision-workspace-btn"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  handleWorkspaceClick(problem);
                                }}
                                title="Open Problem Overview"
                              >
                                <svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" className="workspace-icon">
                                  <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"></path>
                                  <path d="M22 3h-6a4 4 0 0 1-4 4v14a3 3 0 0 1 3-3h7z"></path>
                                </svg>
                              </button>
                            </div>
                            <div className="revision-meta-row">
                              <span>{state.subtitle}</span>
                              <span>{problem.topic.name}</span>
                              <span>{problem.difficulty}</span>
                            </div>
                          </div>
                          <div className="revision-card-actions">
                            <span className="revision-priority-pill">{getRevisionQueueMeta(problem, state).label}</span>
                            <button className="revision-action" onClick={() => openProblemLink(problem)}>
                              Open
                            </button>
                          </div>
                        </article>
                      );
                    })
                  ) : (
                    <div className="revision-empty">No revision is due right now.</div>
                  )}

                  {filteredDueRevisionProblems.length > 5 ? (
                    <button
                      type="button"
                      className="lane-show-more-btn"
                      onClick={() => setDueLaneExpanded(!dueLaneExpanded)}
                    >
                      {dueLaneExpanded ? "Show Less" : `Show ${filteredDueRevisionProblems.length - 5} more...`}
                    </button>
                  ) : null}
                </div>
              </div>

              <div className="revision-lane">
                <div className="revision-lane-head">
                  <span className="revision-lane-kicker">Later</span>
                  <strong>Coming up ({filteredSidebarRevisionProblems.length})</strong>
                </div>
                <div className="revision-list">
                  {filteredSidebarRevisionProblems.length > 0 ? (
                    (comingUpLaneExpanded ? filteredSidebarRevisionProblems : filteredSidebarRevisionProblems.slice(0, 5)).map(({ problem, state }) => {
                      const isChecked = completingRevisionIds.has(problem._id);
                      return (
                        <article key={problem._id} className="revision-card upcoming">
                          <button
                            className={`revision-check ${isChecked ? "checked" : ""}`}
                            onClick={(event) => {
                              event.stopPropagation();
                              void completeRevision(problem);
                            }}
                            aria-label="Mark revision complete"
                            title="Mark done"
                            disabled={completingRevisionIds.has(problem._id)}
                          >
                            {isChecked ? "✓" : ""}
                          </button>
                          <div className="revision-card-copy">
                            <div className="revision-title-row">
                              <strong>{problem.title}</strong>
                              <button
                                type="button"
                                className="table-workspace-btn revision-workspace-btn"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  handleWorkspaceClick(problem);
                                }}
                                title="Open Problem Overview"
                              >
                                <svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" className="workspace-icon">
                                  <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"></path>
                                  <path d="M22 3h-6a4 4 0 0 1-4 4v14a3 3 0 0 1 3-3h7z"></path>
                                </svg>
                              </button>
                            </div>
                            <div className="revision-meta-row">
                              <span>{state.subtitle}</span>
                              <span>{problem.topic.name}</span>
                              <span>{problem.difficulty}</span>
                            </div>
                          </div>
                          <div className="revision-card-actions">
                            <span className="revision-priority-pill subtle">{getRevisionQueueMeta(problem, state).label}</span>
                            <button className="revision-action ghost" onClick={() => openProblemLink(problem)}>
                              Open
                            </button>
                          </div>
                        </article>
                      );
                    })
                  ) : (
                    <div className="revision-empty">No upcoming revisions scheduled.</div>
                  )}

                  {filteredSidebarRevisionProblems.length > 5 ? (
                    <button
                      type="button"
                      className="lane-show-more-btn"
                      onClick={() => setComingUpLaneExpanded(!comingUpLaneExpanded)}
                    >
                      {comingUpLaneExpanded ? "Show Less" : `Show ${filteredSidebarRevisionProblems.length - 5} more...`}
                    </button>
                  ) : null}
                </div>
              </div>

              <div className="revision-lane revised-lane">
                <div className="revision-lane-head">
                  <span className="revision-lane-kicker">Session</span>
                  <strong>Revised today ({filteredRevisedTodayProblems.length})</strong>
                </div>
                <div className="revision-list">
                  {filteredRevisedTodayProblems.length > 0 ? (
                    (revisedTodayLaneExpanded ? filteredRevisedTodayProblems : filteredRevisedTodayProblems.slice(0, 5)).map(({ problem, state }) => (
                      <article key={problem._id} className="revision-card revised">
                        <button className="revision-check checked" disabled aria-label="Revision completed">
                          ✓
                        </button>
                        <div className="revision-card-copy">
                          <div className="revision-title-row">
                            <strong>{problem.title}</strong>
                            <button
                              type="button"
                              className="table-workspace-btn revision-workspace-btn"
                              onClick={(event) => {
                                event.stopPropagation();
                                handleWorkspaceClick(problem);
                              }}
                              title="Open Problem Overview"
                            >
                              <svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" className="workspace-icon">
                                <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"></path>
                                <path d="M22 3h-6a4 4 0 0 1-4 4v14a3 3 0 0 1 3-3h7z"></path>
                              </svg>
                            </button>
                          </div>
                          <div className="revision-meta-row">
                            <span>{toValidDate(problem.lastRevisionAt) ? `Revised on ${formatActivityDate(toValidDate(problem.lastRevisionAt) ?? nowDate)}` : "Revised today"}</span>
                            <span>{problem.topic.name}</span>
                          </div>
                        </div>
                        <div className="revision-card-actions">
                          <span className="revision-priority-pill complete">Revised</span>
                          <button className="revision-action ghost" onClick={() => openProblemLink(problem)}>
                            Open
                          </button>
                        </div>
                      </article>
                    ))
                  ) : (
                    <div className="revision-empty">Today's completed revisions will appear here.</div>
                  )}

                  {filteredRevisedTodayProblems.length > 5 ? (
                    <button
                      type="button"
                      className="lane-show-more-btn"
                      onClick={() => setRevisedTodayLaneExpanded(!revisedTodayLaneExpanded)}
                    >
                      {revisedTodayLaneExpanded ? "Show Less" : `Show ${filteredRevisedTodayProblems.length - 5} more...`}
                    </button>
                  ) : null}
                </div>
              </div>
            </div>
          </section>
        ) : null}

        {activeProblem && !drawerOpen ? (
          <ProblemWorkspaceView
            activeProblem={activeProblem}
            activeRevisionState={activeRevisionState}
            form={form}
            setForm={setForm}
            workspaceSaveState={workspaceSaveState}
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
        <section className="filters">
          <input
            className="search-input"
            placeholder="Search problem, note, platform, or tag..."
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />

          <select
            value={sortByFilter}
            onChange={(event) => setSortByFilter(event.target.value as SortByOption)}
            title="Sort solving order"
          >
            <option value="optimal">🎯 Optimal Order (Best Sequence)</option>
            <option value="status">📌 Unsolved First</option>
            <option value="difficulty">⚡ Difficulty (Easy → Hard)</option>
            <option value="rating">⭐ Highest Importance</option>
            <option value="title">🔤 Title (A-Z)</option>
          </select>

          <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as Status | "all" | "revisit")}>
            <option value="all">All status</option>
            <option value="unsolved">Unsolved</option>
            <option value="solved">Solved</option>
            <option value="revisit">Revisit</option>
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

          <select
            value={ratingFilter}
            onChange={(event) => setRatingFilter(event.target.value as RatingFilterOption)}
            title="Filter problems by rating"
          >
            <option value="all">All ratings ⭐</option>
            <option value="10">10 ⭐ (Top Priority)</option>
            <option value="8–9">8–9 ⭐ (High Priority)</option>
            <option value="5–7">5–7 ⭐ (Medium)</option>
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
            <div className="problem-table-container">
              <table className="dsa-table">
                <thead>
                  <tr>
                    <th style={{ width: "90px" }}>Status</th>
                    <th>Problem</th>
                    <th style={{ width: "120px" }}>Importance</th>
                    <th style={{ width: "100px" }}>Workspace</th>
                    <th style={{ width: "80px" }}>Note</th>
                    <th style={{ width: "90px" }}>Revision</th>
                    <th style={{ width: "120px" }}>Difficulty</th>
                    <th style={{ width: "125px" }}>Focus</th>
                    <th style={{ width: "200px" }}>Meaning</th>
                    {editMode ? <th style={{ width: "90px" }}>Actions</th> : null}
                  </tr>
                </thead>
                <tbody>
                  {selectedTopic === "all"
                    ? groupedByTopicAndSection.map((group) => {
                        const isExpanded = expandedTopics.has(group.topicId) || Boolean(deferredSearch.trim());
                        return (
                          <Fragment key={group.topicId}>
                            <tr
                              className="table-topic-header-row"
                              onClick={() => toggleTopicExpanded(group.topicId)}
                              style={{ cursor: "pointer" }}
                            >
                              <td colSpan={editMode ? 10 : 9} className="table-topic-header-cell">
                                <div className="topic-header-content">
                                  <span className="expand-arrow" style={{ color: group.accent }}>
                                    {isExpanded ? "▼" : "▶"}
                                  </span>
                                  <span className="topic-name">{group.topicName}</span>
                                  <span className="topic-stats-badge">
                                    {statusFilter === "revisit"
                                      ? `${group.totalCount} Revision items`
                                      : `${group.solvedCount} / ${group.totalCount} Solved`}
                                  </span>
                                </div>
                              </td>
                            </tr>

                            {isExpanded
                              ? group.sections.map((sectionGroup) => (
                                  <SectionBlock
                                    key={sectionGroup.sectionKey}
                                    group={sectionGroup}
                                    accent={group.accent}
                                    canEdit={editMode}
                                    revisionStateMap={revisionStateMap}
                                    problemCategoryMap={problemCategoryMap}
                                    nowDate={nowDate}
                                    onOpenStudy={handleWorkspaceClick}
                                    onToggleStatus={updateStatus}
                                    onOpenEdit={openEditDrawer}
                                    onTogglePin={togglePin}
                                    onOpenLink={openProblemLink}
                                    onDelete={deleteProblem}
                                    rowLimit={sectionRowLimit}
                                    onLoadMore={() => setSectionRowLimit((value) => value + 30)}
                                    isRevisitView={statusFilter === "revisit"}
                                  />
                                ))
                              : null}
                          </Fragment>
                        );
                      })
                    : groupedByTopicAndSection.flatMap((group) =>
                        group.sections.map((sectionGroup) => (
                          <SectionBlock
                            key={sectionGroup.sectionKey}
                            group={sectionGroup}
                            accent={group.accent}
                            canEdit={editMode}
                            revisionStateMap={revisionStateMap}
                            problemCategoryMap={problemCategoryMap}
                            nowDate={nowDate}
                            onOpenStudy={handleWorkspaceClick}
                            onToggleStatus={updateStatus}
                            onOpenEdit={openEditDrawer}
                            onTogglePin={togglePin}
                            onOpenLink={openProblemLink}
                            onDelete={deleteProblem}
                            rowLimit={sectionRowLimit}
                            onLoadMore={() => setSectionRowLimit((value) => value + 30)}
                            isRevisitView={statusFilter === "revisit"}
                          />
                        ))
                      )}
                </tbody>
              </table>
            </div>
          )}
        </section>
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

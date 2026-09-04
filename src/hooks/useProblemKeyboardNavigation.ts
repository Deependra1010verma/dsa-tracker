import { useEffect, useRef } from "react";
import type { Problem, Status } from "../appTypes";

type ProblemKeyboardNavigationOptions = {
  sortedFilteredProblems: Problem[];
  focusedProblemId: string | null;
  setFocusedProblemId: (problemId: string | null) => void;
  updateStatus: (problem: Problem, nextStatus: Status) => void | Promise<void>;
  openStudyView: (problem: Problem) => void;
  openEditDrawer: (problem: Problem) => void;
  openProblemLink: (problem: Problem) => void;
};

function isInputFocused() {
  const el = document.activeElement;
  if (!el) return false;
  const tag = el.tagName.toLowerCase();
  return tag === "input" || tag === "textarea" || tag === "select" || (el as HTMLElement).isContentEditable;
}

function cycleStatus(current: Status): Status {
  if (current === "unsolved") return "shaky";
  if (current === "shaky") return "solved";
  if (current === "solved") return "unsolved";
  return "solved";
}

export function useProblemKeyboardNavigation(options: ProblemKeyboardNavigationOptions) {
  const navRef = useRef(options);

  useEffect(() => {
    navRef.current = options;
  });

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.ctrlKey || e.metaKey || e.altKey || isInputFocused()) return;

      const {
        sortedFilteredProblems: problems,
        focusedProblemId,
        setFocusedProblemId,
        updateStatus,
        openStudyView,
        openEditDrawer,
        openProblemLink,
      } = navRef.current;

      if (problems.length === 0) return;

      const currentIdx = focusedProblemId ? problems.findIndex((problem) => problem._id === focusedProblemId) : -1;

      if (e.key === "j" || e.key === "ArrowDown") {
        e.preventDefault();
        const next = currentIdx < problems.length - 1 ? currentIdx + 1 : 0;
        setFocusedProblemId(problems[next]._id);
        return;
      }

      if (e.key === "k" || e.key === "ArrowUp") {
        e.preventDefault();
        const prev = currentIdx > 0 ? currentIdx - 1 : problems.length - 1;
        setFocusedProblemId(problems[prev]._id);
        return;
      }

      if (e.key === "Escape") {
        setFocusedProblemId(null);
        return;
      }

      if (!focusedProblemId) return;

      const problem = problems.find((item) => item._id === focusedProblemId);
      if (!problem) return;

      if (e.key === "Enter") {
        e.preventDefault();
        openStudyView(problem);
      } else if (e.key === "s") {
        e.preventDefault();
        void updateStatus(problem, cycleStatus(problem.status));
      } else if (e.key === "n") {
        e.preventDefault();
        openEditDrawer(problem);
      } else if (e.key === "o") {
        e.preventDefault();
        openProblemLink(problem);
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  useEffect(() => {
    if (!options.focusedProblemId) return;
    const el = document.querySelector(`[data-pid="${options.focusedProblemId}"]`);
    el?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [options.focusedProblemId]);
}

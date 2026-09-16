import type { Dispatch, SetStateAction } from "react";
import type { Status } from "../appTypes";
import { StatCard } from "./StatCards";

export type DashboardStatsValue = {
  totalProblems: number;
  solvedProblems: number;
  revisitProblems: number;
  unsolvedProblems: number;
  skippedProblems?: number;
};

type DashboardStatsProps = {
  selectedTopic: string;
  stats: DashboardStatsValue | null;
  visibleStats: DashboardStatsValue | null;
  progress: number;
  visibleProgress: number;
  statusFilter: Status | "all" | "revisit";
  setStatusFilter: Dispatch<SetStateAction<Status | "all" | "revisit">>;
};

export function DashboardStats({
  selectedTopic,
  stats,
  visibleStats,
  progress,
  visibleProgress,
  statusFilter,
  setStatusFilter,
}: DashboardStatsProps) {
  return (
    <>
      <section className="stats-grid">
        <StatCard
          label="Total"
          value={visibleStats?.totalProblems ?? 0}
          hint={selectedTopic === "all" ? "All records" : "Topic records"}
          onClick={() => setStatusFilter("all")}
          isActive={statusFilter === "all"}
        />
        <StatCard
          label="Solved"
          value={visibleStats?.solvedProblems ?? 0}
          hint={`${visibleProgress}% complete`}
          onClick={() => setStatusFilter((prev) => (prev === "solved" ? "all" : "solved"))}
          isActive={statusFilter === "solved"}
        />
        <StatCard
          label="Revisit"
          value={visibleStats?.revisitProblems ?? 0}
          hint={selectedTopic === "all" ? "Starred for revisit" : "Topic starred"}
          onClick={() => setStatusFilter((prev) => (prev === "revisit" ? "all" : "revisit"))}
          isActive={statusFilter === "revisit"}
        />
        <StatCard
          label="Unsolved"
          value={visibleStats?.unsolvedProblems ?? 0}
          hint={selectedTopic === "all" ? "Still pending" : "Topic pending"}
          onClick={() => setStatusFilter((prev) => (prev === "unsolved" ? "all" : "unsolved"))}
          isActive={statusFilter === "unsolved"}
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
    </>
  );
}

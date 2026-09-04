import { useMemo } from "react";
import type { Problem, ActivityRecord, Difficulty } from "../appTypes";

// ─── helpers ─────────────────────────────────────────────────────────────────

function toLocalMonthKey(dateStr: string | null | undefined): string {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return "";
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function formatMonth(key: string): string {
  const [year, month] = key.split("-");
  const d = new Date(Number(year), Number(month) - 1, 1);
  return d.toLocaleString("default", { month: "short", year: "2-digit" });
}

function daysUntil(dateStr: string | null | undefined, now: Date): number {
  if (!dateStr) return Infinity;
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return Infinity;
  return Math.ceil((d.getTime() - now.getTime()) / 86_400_000);
}

// ─── Platform Stats ──────────────────────────────────────────────────────────

type PlatformStat = {
  platform: string;
  total: number;
  solved: number;
  shaky: number;
  easy: number;
  medium: number;
  hard: number;
};

function PlatformStatsChart({ problems }: { problems: Problem[] }) {
  const stats = useMemo(() => {
    const map = new Map<string, PlatformStat>();
    for (const p of problems) {
      const key = p.platformName || "Other";
      let entry = map.get(key);
      if (!entry) {
        entry = { platform: key, total: 0, solved: 0, shaky: 0, easy: 0, medium: 0, hard: 0 };
        map.set(key, entry);
      }
      entry.total++;
      if (p.status === "solved") entry.solved++;
      if (p.status === "shaky") entry.shaky++;
      if (p.difficulty === "Easy") entry.easy++;
      else if (p.difficulty === "Medium") entry.medium++;
      else if (p.difficulty === "Hard") entry.hard++;
    }
    return [...map.values()].sort((a, b) => b.total - a.total).slice(0, 8);
  }, [problems]);

  if (stats.length === 0) {
    return <div className="analytics-empty">No problems yet.</div>;
  }

  const maxTotal = Math.max(...stats.map((s) => s.total), 1);

  return (
    <div className="platform-stats-chart">
      {stats.map((s) => {
        const solvedPct = Math.round(((s.solved + s.shaky) / s.total) * 100);
        const solvedWidth = ((s.solved / s.total) * 100).toFixed(1);
        const shakyWidth = ((s.shaky / s.total) * 100).toFixed(1);
        const barWidth = ((s.total / maxTotal) * 100).toFixed(1);
        return (
          <div key={s.platform} className="platform-stat-row">
            <div className="platform-stat-label">
              <span className="platform-stat-name">{s.platform}</span>
              <span className="platform-stat-meta">{s.solved + s.shaky}/{s.total} · {solvedPct}%</span>
            </div>
            <div className="platform-stat-bar-shell" title={`${s.total} problems`}>
              <div className="platform-stat-bar-track" style={{ width: `${barWidth}%` }}>
                <div className="platform-stat-bar solved" style={{ width: `${solvedWidth}%` }} />
                <div className="platform-stat-bar shaky" style={{ width: `${shakyWidth}%` }} />
              </div>
            </div>
            <div className="platform-diff-chips">
              {s.easy > 0 && <span className="pdiff-chip easy">{s.easy}E</span>}
              {s.medium > 0 && <span className="pdiff-chip medium">{s.medium}M</span>}
              {s.hard > 0 && <span className="pdiff-chip hard">{s.hard}H</span>}
            </div>
          </div>
        );
      })}
      <div className="platform-stat-legend">
        <span className="legend-dot solved" /> Solved
        <span className="legend-dot shaky" /> Shaky
        <span className="legend-dot unsolved" /> Unsolved
      </div>
    </div>
  );
}

// ─── Revision Load Chart ─────────────────────────────────────────────────────

const BUCKETS = [
  { label: "Due", max: 0 },
  { label: "1-3d", max: 3 },
  { label: "4-7d", max: 7 },
  { label: "8-14d", max: 14 },
  { label: "15-30d", max: 30 },
  { label: "30d+", max: Infinity },
];

function RevisionLoadChart({ problems, nowDate }: { problems: Problem[]; nowDate: Date }) {
  const buckets = useMemo(() => {
    const counts = BUCKETS.map(() => 0);
    for (const p of problems) {
      if (!p.nextRevisionAt || p.status === "unsolved" || p.status === "skipped") continue;
      const days = daysUntil(p.nextRevisionAt, nowDate);
      if (days <= 0) {
        counts[0]++;
        continue;
      }
      for (let i = 0; i < BUCKETS.length; i++) {
        if (days <= BUCKETS[i].max) { counts[i]++; break; }
      }
    }
    return BUCKETS.map((b, i) => ({ label: b.label, count: counts[i] }));
  }, [problems, nowDate]);

  const max = Math.max(...buckets.map((b) => b.count), 1);

  return (
    <div className="revision-load-chart">
      {buckets.map((b) => (
        <div key={b.label} className="load-bar-col">
          <span className="load-bar-count">{b.count > 0 ? b.count : ""}</span>
          <div className="load-bar-track">
            <div
              className="load-bar-fill"
              style={{ height: `${(b.count / max) * 100}%` }}
              title={`${b.count} problems due in ${b.label}`}
            />
          </div>
          <span className="load-bar-label">{b.label}</span>
        </div>
      ))}
    </div>
  );
}

// ─── Difficulty Progression Chart ────────────────────────────────────────────

function DifficultyProgressionChart({ activities }: { activities: ActivityRecord[] }) {
  const { months, data } = useMemo(() => {
    const monthSet = new Set<string>();
    const map = new Map<string, { Easy: number; Medium: number; Hard: number }>();

    for (const a of activities) {
      if (a.kind !== "solved") continue;
      const key = toLocalMonthKey(a.occurredAt as unknown as string);
      if (!key) continue;
      monthSet.add(key);
      const entry = map.get(key) ?? { Easy: 0, Medium: 0, Hard: 0 };
      const diff = a.problem.difficulty as Difficulty;
      if (diff === "Easy" || diff === "Medium" || diff === "Hard") entry[diff]++;
      map.set(key, entry);
    }

    const months = [...monthSet].sort().slice(-8); // last 8 months
    const data = months.map((m) => map.get(m) ?? { Easy: 0, Medium: 0, Hard: 0 });
    return { months, data };
  }, [activities]);

  if (months.length === 0) {
    return <div className="analytics-empty">No solve activity yet — start solving to see progression!</div>;
  }

  const maxTotal = Math.max(...data.map((d) => d.Easy + d.Medium + d.Hard), 1);

  return (
    <div className="difficulty-chart">
      {months.map((m, i) => {
        const d = data[i];
        const total = d.Easy + d.Medium + d.Hard;
        const easyH = ((d.Easy / maxTotal) * 100).toFixed(1);
        const medH  = ((d.Medium / maxTotal) * 100).toFixed(1);
        const hardH = ((d.Hard / maxTotal) * 100).toFixed(1);
        return (
          <div key={m} className="diff-bar-col">
            <span className="diff-bar-count">{total > 0 ? total : ""}</span>
            <div className="diff-bar-stack">
              <div className="diff-bar hard"  style={{ height: `${hardH}%` }}  title={`${d.Hard} Hard`} />
              <div className="diff-bar medium" style={{ height: `${medH}%` }}  title={`${d.Medium} Medium`} />
              <div className="diff-bar easy"   style={{ height: `${easyH}%` }} title={`${d.Easy} Easy`} />
            </div>
            <span className="diff-bar-label">{formatMonth(m)}</span>
          </div>
        );
      })}
      <div className="diff-legend">
        <span className="legend-dot easy" /> Easy
        <span className="legend-dot medium" /> Medium
        <span className="legend-dot hard" /> Hard
      </div>
    </div>
  );
}

// ─── Main dashboard ──────────────────────────────────────────────────────────

export function AnalyticsDashboard({
  problems,
  activities,
  nowDate,
}: {
  problems: Problem[];
  activities: ActivityRecord[];
  nowDate: Date;
}) {
  return (
    <div className="analytics-dashboard">
      <section className="analytics-card">
        <div className="analytics-card-head">
          <span className="analytics-card-icon">🏆</span>
          <div>
            <h4>Platform Breakdown</h4>
            <p className="analytics-card-sub">Progress by platform where you solved problems</p>
          </div>
        </div>
        <PlatformStatsChart problems={problems} />
      </section>

      <section className="analytics-card">
        <div className="analytics-card-head">
          <span className="analytics-card-icon">📅</span>
          <div>
            <h4>Revision Load</h4>
            <p className="analytics-card-sub">How many revisions are due in each time window</p>
          </div>
        </div>
        <RevisionLoadChart problems={problems} nowDate={nowDate} />
      </section>

      <section className="analytics-card">
        <div className="analytics-card-head">
          <span className="analytics-card-icon">📈</span>
          <div>
            <h4>Difficulty Progression</h4>
            <p className="analytics-card-sub">Monthly solved count by difficulty (last 8 months)</p>
          </div>
        </div>
        <DifficultyProgressionChart activities={activities} />
      </section>
    </div>
  );
}

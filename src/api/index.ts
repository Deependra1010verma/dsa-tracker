import "dotenv/config";
import express, { type RequestHandler } from "express";
import path from "path";
import { existsSync } from "fs";
import { connectDb } from "./db.js";
import { Problem, Topic, topicSeeds } from "./models.js";
import { problemSeeds } from "./seed.js";
import type { ProblemStatus } from "./types.js";

const app = express();
const port = Number(process.env.PORT || 4000);
const mongoUri = process.env.MONGODB_URI || "";
const clientDist = path.resolve(process.cwd(), "dist/web");
const spacedRevisionDays = [1, 3, 7, 15, 30] as const;
let storageMode: "mongo" | "memory" = "mongo";
let databaseReady = false;
let databaseError = "";

app.use(express.json({ limit: "2mb" }));

const asyncHandler = (handler: RequestHandler): RequestHandler => {
  return (req, res, next) => {
    Promise.resolve(handler(req, res, next)).catch(next);
  };
};

function normalizeSearch(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function slugifySegment(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function problemKeyForSeed(topicSlug: string, title: string) {
  return `${slugifySegment(topicSlug)}:${slugifySegment(title)}`;
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function coerceDate(value: unknown) {
  if (value instanceof Date) {
    return value;
  }

  const date = new Date(value as never);
  return Number.isNaN(date.getTime()) ? new Date() : date;
}

function baseRevisionAnchor(problem: {
  solvedAt?: unknown;
  revisitAt?: unknown;
  lastRevisionAt?: unknown;
  updatedAt?: unknown;
}) {
  return coerceDate(problem.lastRevisionAt ?? problem.revisitAt ?? problem.solvedAt ?? problem.updatedAt ?? new Date());
}

function startRevisionSchedule(problem: any, anchorOverride?: Date) {
  const anchor = anchorOverride ?? baseRevisionAnchor(problem);
  problem.revisionStage = 0;
  problem.lastRevisionAt = anchor;
  problem.nextRevisionAt = addDays(anchor, spacedRevisionDays[0]);
  problem.revisionCompletedAt = undefined;
  problem.revisionCount = Math.max(problem.revisionCount ?? 0, 0);
}

function advanceRevisionSchedule(problem: any) {
  const currentStage = Math.max(problem.revisionStage ?? 0, 0);
  const nextStage = Math.min(currentStage + 1, spacedRevisionDays.length);
  const now = new Date();

  problem.revisionCount = (problem.revisionCount ?? 0) + 1;
  problem.lastRevisionAt = now;

  if (nextStage >= spacedRevisionDays.length) {
    problem.revisionStage = spacedRevisionDays.length;
    problem.nextRevisionAt = undefined;
    problem.revisionCompletedAt = now;
    return;
  }

  problem.revisionStage = nextStage;
  problem.nextRevisionAt = addDays(now, spacedRevisionDays[nextStage]);
  problem.revisionCompletedAt = undefined;
}

function clearRevisionSchedule(problem: any) {
  problem.revisionStage = 0;
  problem.lastRevisionAt = undefined;
  problem.nextRevisionAt = undefined;
  problem.revisionCompletedAt = undefined;
}

function seededProblemScore(problem: {
  status?: string;
  shortNote?: string;
  longNote?: string;
  mistakeLog?: string;
  mistakeTrigger?: string;
  mistakeReason?: string;
  mistakeFix?: string;
  invariant?: string;
  compareBruteForce?: string;
  compareOptimized?: string;
  compareWhyBetter?: string;
  revisionCount?: number;
  revisionStage?: number;
  tags?: string[];
  solvedAt?: Date | null;
  revisitAt?: Date | null;
  lastRevisionAt?: Date | null;
  nextRevisionAt?: Date | null;
  updatedAt?: Date | null;
}) {
  return [
    problem.status && problem.status !== "unsolved" ? 10 : 0,
    problem.shortNote ? 3 : 0,
    problem.longNote ? 4 : 0,
    problem.mistakeLog ? 4 : 0,
    problem.mistakeTrigger ? 2 : 0,
    problem.mistakeReason ? 2 : 0,
    problem.mistakeFix ? 2 : 0,
    problem.invariant ? 4 : 0,
    problem.compareBruteForce ? 3 : 0,
    problem.compareOptimized ? 3 : 0,
    problem.compareWhyBetter ? 3 : 0,
    (problem.tags?.length ?? 0) > 0 ? 2 : 0,
    Math.min(problem.revisionCount ?? 0, 10),
    Math.min(problem.revisionStage ?? 0, 6),
    problem.solvedAt ? 3 : 0,
    problem.revisitAt ? 2 : 0,
    problem.lastRevisionAt ? 2 : 0,
    problem.nextRevisionAt ? 2 : 0,
    problem.updatedAt ? problem.updatedAt.getTime() / 1_000_000_000_000 : 0,
  ].reduce((sum, value) => sum + value, 0);
}

type MemoryTopic = {
  _id: string;
  name: string;
  slug: string;
  order: number;
  targetCount: number;
  description: string;
  accent: string;
};

type MemoryProblem = {
  _id: string;
  problemKey: string;
  isSeeded: boolean;
  title: string;
  topic: MemoryTopic;
  platformName: string;
  platformUrl: string;
  roadmapSection: string;
  roadmapSectionOrder: number;
  roadmapOrder: number;
  difficulty: "Easy" | "Medium" | "Hard";
  status: ProblemStatus;
  shortNote: string;
  longNote: string;
  mistakeLog: string;
  mistakeTrigger: string;
  mistakeReason: string;
  mistakeFix: string;
  invariant: string;
  compareBruteForce: string;
  compareOptimized: string;
  compareWhyBetter: string;
  pattern: string;
  rating: number;
  revisionCount: number;
  revisionStage: number;
  solvedAt?: Date;
  revisitAt?: Date;
  lastRevisionAt?: Date;
  nextRevisionAt?: Date;
  revisionCompletedAt?: Date;
  tags: string[];
  priority: number;
  isPinned: boolean;
  createdAt: Date;
  updatedAt: Date;
};

const memoryTopics: MemoryTopic[] = topicSeeds.map((seed) => ({
  _id: `topic:${seed.slug}`,
  name: seed.name,
  slug: seed.slug,
  order: seed.order,
  targetCount: seed.targetCount,
  description: seed.description,
  accent: seed.accent,
}));

const memoryTopicsById = new Map(memoryTopics.map((topic) => [topic._id, topic]));
const memoryTopicsBySlug = new Map(memoryTopics.map((topic) => [topic.slug, topic]));

function memoryProblemId(topicSlug: string, title: string) {
  return `problem:${problemKeyForSeed(topicSlug, title)}`;
}

function seedProblemToMemoryProblem(seed: (typeof problemSeeds)[number]): MemoryProblem {
  const topic = memoryTopicsBySlug.get(seed.topicSlug);
  if (!topic) {
    throw new Error(`Missing topic seed for ${seed.topicSlug}`);
  }

  const now = new Date();
  const isSolvedLike = seed.status === "solved" || seed.status === "revisit";
  const solvedAt = seed.status === "solved" ? now : undefined;
  const revisitAt = seed.status === "revisit" ? now : undefined;

  return {
    _id: memoryProblemId(seed.topicSlug, seed.title),
    problemKey: problemKeyForSeed(seed.topicSlug, seed.title),
    isSeeded: true,
    title: seed.title,
    topic,
    platformName: seed.platformName,
    platformUrl: seed.platformUrl,
    roadmapSection: seed.roadmapSection ?? "",
    roadmapSectionOrder: seed.roadmapSectionOrder ?? 999,
    roadmapOrder: seed.roadmapOrder ?? 999,
    difficulty: seed.difficulty,
    status: seed.status,
    shortNote: seed.shortNote,
    longNote: seed.longNote,
    mistakeLog: seed.mistakeLog ?? "",
    mistakeTrigger: seed.mistakeTrigger ?? "",
    mistakeReason: seed.mistakeReason ?? "",
    mistakeFix: seed.mistakeFix ?? "",
    invariant: seed.invariant ?? "",
    compareBruteForce: seed.compareBruteForce ?? "",
    compareOptimized: seed.compareOptimized ?? "",
    compareWhyBetter: seed.compareWhyBetter ?? "",
    pattern: seed.pattern ?? "",
    rating: seed.rating ?? 0,
    revisionCount: isSolvedLike ? 1 : 0,
    revisionStage: isSolvedLike ? 0 : 0,
    solvedAt,
    revisitAt,
    lastRevisionAt: isSolvedLike ? now : undefined,
    nextRevisionAt: isSolvedLike ? addDays(now, spacedRevisionDays[0]) : undefined,
    tags: [...seed.tags],
    priority: seed.priority,
    isPinned: seed.isPinned,
    createdAt: now,
    updatedAt: now,
  };
}

let memoryProblems: MemoryProblem[] = problemSeeds.map(seedProblemToMemoryProblem);

function cloneMemoryTopic(topic: MemoryTopic) {
  return { ...topic };
}

function toMemoryProblemResponse(problem: MemoryProblem, brief = false) {
  const response: Record<string, unknown> = {
    _id: problem._id,
    title: problem.title,
    platformName: problem.platformName,
    platformUrl: problem.platformUrl,
    roadmapSection: problem.roadmapSection,
    roadmapSectionOrder: problem.roadmapSectionOrder,
    roadmapOrder: problem.roadmapOrder,
    difficulty: problem.difficulty,
    status: problem.status,
    shortNote: problem.shortNote,
    longNote: brief ? undefined : problem.longNote,
    mistakeLog: brief ? undefined : problem.mistakeLog,
    mistakeTrigger: brief ? undefined : problem.mistakeTrigger,
    mistakeReason: brief ? undefined : problem.mistakeReason,
    mistakeFix: brief ? undefined : problem.mistakeFix,
    invariant: brief ? undefined : problem.invariant,
    compareBruteForce: brief ? undefined : problem.compareBruteForce,
    compareOptimized: brief ? undefined : problem.compareOptimized,
    compareWhyBetter: brief ? undefined : problem.compareWhyBetter,
    pattern: problem.pattern,
    rating: problem.rating,
    revisionCount: problem.revisionCount,
    revisionStage: problem.revisionStage,
    solvedAt: problem.solvedAt,
    revisitAt: problem.revisitAt,
    lastRevisionAt: problem.lastRevisionAt,
    nextRevisionAt: problem.nextRevisionAt,
    revisionCompletedAt: problem.revisionCompletedAt,
    tags: [...problem.tags],
    priority: problem.priority,
    isPinned: problem.isPinned,
    topic: cloneMemoryTopic(problem.topic),
    updatedAt: problem.updatedAt,
  };

  return response;
}

function getMemoryTopicsWithCounts() {
  const counts = new Map<string, { totalProblems: number; solvedCount: number; revisitCount: number }>();

  for (const problem of memoryProblems) {
    const key = problem.topic._id;
    const current = counts.get(key) ?? { totalProblems: 0, solvedCount: 0, revisitCount: 0 };
    current.totalProblems += 1;
    if (problem.status === "solved") current.solvedCount += 1;
    if (problem.status === "revisit") current.revisitCount += 1;
    counts.set(key, current);
  }

  return memoryTopics
    .slice()
    .sort((left, right) => left.order - right.order)
    .map((topic) => ({
      ...topic,
      totalProblems: counts.get(topic._id)?.totalProblems ?? 0,
      solvedCount: counts.get(topic._id)?.solvedCount ?? 0,
      revisitCount: counts.get(topic._id)?.revisitCount ?? 0,
    }));
}

function matchesMemorySearch(problem: MemoryProblem, search: string) {
  if (!search) return true;

  const haystack = [
    problem.title,
    problem.shortNote,
    problem.longNote,
    problem.mistakeLog,
    problem.mistakeTrigger,
    problem.mistakeReason,
    problem.mistakeFix,
    problem.invariant,
    problem.compareBruteForce,
    problem.compareOptimized,
    problem.compareWhyBetter,
    problem.pattern,
    problem.platformName,
    ...problem.tags,
  ]
    .join(" ")
    .toLowerCase();

  return haystack.includes(search.toLowerCase());
}

function sortMemoryProblems(left: MemoryProblem, right: MemoryProblem) {
  const sectionOrderDelta = left.roadmapSectionOrder - right.roadmapSectionOrder;
  if (sectionOrderDelta !== 0) return sectionOrderDelta;

  const roadmapOrderDelta = left.roadmapOrder - right.roadmapOrder;
  if (roadmapOrderDelta !== 0) return roadmapOrderDelta;

  const pinnedDelta = Number(right.isPinned) - Number(left.isPinned);
  if (pinnedDelta !== 0) return pinnedDelta;

  const priorityDelta = right.priority - left.priority;
  if (priorityDelta !== 0) return priorityDelta;

  return right.updatedAt.getTime() - left.updatedAt.getTime();
}

async function ensureSeedTopics() {
  const operations = topicSeeds.map((seed) => ({
    updateOne: {
      filter: { slug: seed.slug },
      update: {
        $set: {
          name: seed.name,
          order: seed.order,
          targetCount: seed.targetCount,
          description: seed.description,
          accent: seed.accent,
        },
        $setOnInsert: {
          slug: seed.slug,
        },
      },
      upsert: true,
    },
  }));

  if (operations.length > 0) {
    await Topic.bulkWrite(operations);
  }
}

async function ensureSeedProblems() {
  const topics = await Topic.find({ slug: { $in: problemSeeds.map((seed) => seed.topicSlug) } });
  const topicsBySlug = new Map(topics.map((topic) => [topic.slug, topic._id]));
  const topicIds = topics.map((topic) => topic._id);

  const seededDefinitions = problemSeeds
    .map((seed) => {
      const topicId = topicsBySlug.get(seed.topicSlug);
      if (!topicId) {
        return null;
      }

      return {
        ...seed,
        topicId,
        problemKey: problemKeyForSeed(seed.topicSlug, seed.title),
      };
    })
    .filter((seed): seed is NonNullable<typeof seed> => Boolean(seed));

  const seededKeys = seededDefinitions.map((seed) => seed.problemKey);
  const seededTitles = seededDefinitions.map((seed) => seed.title);

  const existingSeededProblems = await Problem.find({
    $or: [
      { problemKey: { $in: seededKeys } },
      {
        topic: { $in: topicIds },
        title: { $in: seededTitles },
      },
    ],
  }).sort({ updatedAt: -1, createdAt: -1 });

  const existingByKey = new Map<string, typeof existingSeededProblems>();
  for (const problem of existingSeededProblems) {
    const topic = topics.find((entry) => entry._id.equals(problem.topic));
    if (!topic) {
      continue;
    }

    const key = problem.problemKey || problemKeyForSeed(topic.slug, problem.title);
    const bucket = existingByKey.get(key) ?? [];
    bucket.push(problem);
    existingByKey.set(key, bucket);
  }

  const dedupeWrites = [];
  const duplicateIdsToDelete: string[] = [];

  for (const seed of seededDefinitions) {
    const matches = existingByKey.get(seed.problemKey) ?? [];
    if (matches.length === 0) {
      continue;
    }

    const keeper = [...matches].sort((left, right) => seededProblemScore(right) - seededProblemScore(left))[0];
    duplicateIdsToDelete.push(
      ...matches.filter((problem) => String(problem._id) !== String(keeper._id)).map((problem) => String(problem._id))
    );

    dedupeWrites.push({
      updateOne: {
        filter: { _id: keeper._id },
        update: {
          $set: {
            problemKey: seed.problemKey,
            isSeeded: true,
            roadmapSection: seed.roadmapSection ?? "",
            roadmapSectionOrder: seed.roadmapSectionOrder ?? 999,
            roadmapOrder: seed.roadmapOrder ?? 999,
            platformName: seed.platformName,
            platformUrl: seed.platformUrl,
            difficulty: seed.difficulty,
            pattern: seed.pattern ?? "",
            rating: seed.rating ?? 0,
          },
        },
      },
    });
  }

  if (dedupeWrites.length > 0) {
    await Problem.bulkWrite(dedupeWrites);
  }

  if (duplicateIdsToDelete.length > 0) {
    await Problem.deleteMany({ _id: { $in: duplicateIdsToDelete } });
  }

  const operations = seededDefinitions.map((seed) => ({
    updateOne: {
      filter: { problemKey: seed.problemKey },
      update: {
        $set: {
          problemKey: seed.problemKey,
          isSeeded: true,
          platformName: seed.platformName,
          platformUrl: seed.platformUrl,
          roadmapSection: seed.roadmapSection ?? "",
          roadmapSectionOrder: seed.roadmapSectionOrder ?? 999,
          roadmapOrder: seed.roadmapOrder ?? 999,
          difficulty: seed.difficulty,
          pattern: seed.pattern ?? "",
          rating: seed.rating ?? 0,
        },
        $setOnInsert: {
          title: seed.title,
          topic: seed.topicId,
          status: seed.status,
          shortNote: seed.shortNote,
          longNote: seed.longNote,
          tags: seed.tags,
          priority: seed.priority,
          isPinned: seed.isPinned,
          revisionCount: seed.revisionCount ?? 0,
          revisionStage: seed.status === "solved" || seed.status === "revisit" ? 0 : 0,
          solvedAt: seed.status === "solved" ? new Date() : undefined,
          revisitAt: seed.status === "revisit" ? new Date() : undefined,
          lastRevisionAt: seed.status === "solved" || seed.status === "revisit" ? new Date() : undefined,
          nextRevisionAt:
            seed.status === "solved" || seed.status === "revisit" ? addDays(new Date(), spacedRevisionDays[0]) : undefined,
        },
      },
      upsert: true,
    },
  }));

  if (operations.length > 0) {
    await Problem.bulkWrite(operations);
  }

  await Problem.deleteMany({
    isSeeded: true,
    problemKey: { $nin: seededKeys },
  });
}

function statusFromValue(value: unknown): ProblemStatus | "" {
  return value === "solved" || value === "unsolved" || value === "revisit" || value === "skipped"
    ? value
    : "";
}

async function backfillRevisionSchedules() {
  const problems = await Problem.find({
    status: { $in: ["solved", "revisit"] },
    $or: [{ nextRevisionAt: { $exists: false } }, { nextRevisionAt: null }],
  });

  for (const problem of problems) {
    startRevisionSchedule(problem);
    await problem.save();
  }
}

app.get(
  "/api/topics",
  asyncHandler(async (_req, res) => {
    if (storageMode === "memory") {
      res.json({ topics: getMemoryTopicsWithCounts() });
      return;
    }

    const [topics, counts] = await Promise.all([
      Topic.find().sort({ order: 1 }).lean(),
      Problem.aggregate([
        {
          $group: {
            _id: "$topic",
            totalProblems: { $sum: 1 },
            solvedCount: {
              $sum: { $cond: [{ $eq: ["$status", "solved"] }, 1, 0] },
            },
            revisitCount: {
              $sum: { $cond: [{ $eq: ["$status", "revisit"] }, 1, 0] },
            },
          },
        },
      ]),
    ]);

    const countMap = new Map(counts.map((entry) => [String(entry._id), entry]));
    const topicsWithCounts = topics.map((topic) => {
      const countsForTopic = countMap.get(String(topic._id));
      return {
        ...topic,
        totalProblems: countsForTopic?.totalProblems ?? 0,
        solvedCount: countsForTopic?.solvedCount ?? 0,
        revisitCount: countsForTopic?.revisitCount ?? 0,
      };
    });

    res.json({ topics: topicsWithCounts });
  })
);

app.get(
  "/api/problems",
  asyncHandler(async (req, res) => {
    const topic = normalizeSearch(req.query.topic);
    const search = normalizeSearch(req.query.search);
    const difficulty = normalizeSearch(req.query.difficulty);
    const status = statusFromValue(req.query.status);
    const brief = normalizeSearch(req.query.brief) === "1";

    if (storageMode === "memory") {
      const problems = memoryProblems
        .filter((problem) => {
          const matchesTopic = !topic || problem.topic._id === topic;
          const matchesDifficulty = !difficulty || problem.difficulty === difficulty;
          const matchesStatus = !status || problem.status === status;
          return matchesTopic && matchesDifficulty && matchesStatus && matchesMemorySearch(problem, search);
        })
        .slice()
        .sort(sortMemoryProblems)
        .map((problem) => toMemoryProblemResponse(problem, brief));

      res.json({ problems });
      return;
    }

    const filter: Record<string, unknown> = {};
    if (topic) {
      filter.topic = topic;
    }
    if (difficulty) {
      filter.difficulty = difficulty;
    }
    if (status) {
      filter.status = status;
    }
    if (search) {
      filter.$or = [
        { title: { $regex: search, $options: "i" } },
        { shortNote: { $regex: search, $options: "i" } },
        { longNote: { $regex: search, $options: "i" } },
        { mistakeLog: { $regex: search, $options: "i" } },
        { mistakeTrigger: { $regex: search, $options: "i" } },
        { mistakeReason: { $regex: search, $options: "i" } },
        { mistakeFix: { $regex: search, $options: "i" } },
        { invariant: { $regex: search, $options: "i" } },
        { compareBruteForce: { $regex: search, $options: "i" } },
        { compareOptimized: { $regex: search, $options: "i" } },
        { compareWhyBetter: { $regex: search, $options: "i" } },
        { pattern: { $regex: search, $options: "i" } },
        { platformName: { $regex: search, $options: "i" } },
        { tags: { $regex: search, $options: "i" } },
      ];
    }

    const query = Problem.find(filter)
      .populate("topic", "name slug order targetCount description accent")
      .sort({ roadmapSectionOrder: 1, roadmapOrder: 1, isPinned: -1, priority: -1, updatedAt: -1 });

    if (brief) {
      query.select(
        "title topic platformName platformUrl roadmapSection roadmapSectionOrder roadmapOrder difficulty status shortNote pattern rating revisionCount revisionStage solvedAt revisitAt lastRevisionAt nextRevisionAt revisionCompletedAt tags priority isPinned updatedAt"
      );
    }

    const problems = await query.lean();

    res.json({ problems });
  })
);

app.get(
  "/api/problems/:id",
  asyncHandler(async (req, res) => {
    if (storageMode === "memory") {
      const problem = memoryProblems.find((entry) => entry._id === req.params.id);
      if (!problem) {
        res.status(404).json({ message: "Problem not found" });
        return;
      }

      res.json({ problem: toMemoryProblemResponse(problem) });
      return;
    }

    const problem = await Problem.findById(req.params.id).populate(
      "topic",
      "name slug order targetCount description accent"
    );

    if (!problem) {
      res.status(404).json({ message: "Problem not found" });
      return;
    }

    res.json({ problem });
  })
);

app.get(
  "/api/stats",
  asyncHandler(async (_req, res) => {
    if (storageMode === "memory") {
      const totalProblems = memoryProblems.length;
      const solvedProblems = memoryProblems.filter((problem) => problem.status === "solved").length;
      const revisitProblems = memoryProblems.filter((problem) => problem.status === "revisit").length;
      const unsolvedProblems = memoryProblems.filter((problem) => problem.status === "unsolved").length;
      const skippedProblems = memoryProblems.filter((problem) => problem.status === "skipped").length;

      res.json({
        stats: {
          totalProblems,
          solvedProblems,
          revisitProblems,
          unsolvedProblems,
          skippedProblems,
        },
      });
      return;
    }

    const [totalProblems, solvedProblems, revisitProblems, unsolvedProblems, skippedProblems] =
      await Promise.all([
        Problem.countDocuments(),
        Problem.countDocuments({ status: "solved" }),
        Problem.countDocuments({ status: "revisit" }),
        Problem.countDocuments({ status: "unsolved" }),
        Problem.countDocuments({ status: "skipped" }),
      ]);

    res.json({
      stats: {
        totalProblems,
        solvedProblems,
        revisitProblems,
        unsolvedProblems,
        skippedProblems,
      },
    });
  })
);

app.post(
  "/api/problems",
  asyncHandler(async (req, res) => {
    const {
      title,
      topicId,
      roadmapSection = "",
      platformName,
      platformUrl,
      difficulty,
      status,
      pattern = "",
      rating = 0,
      shortNote = "",
      longNote = "",
      mistakeLog = "",
      mistakeTrigger = "",
      mistakeReason = "",
      mistakeFix = "",
      invariant = "",
      compareBruteForce = "",
      compareOptimized = "",
      compareWhyBetter = "",
      tags = [],
      priority = 0,
      isPinned = false,
    } = req.body ?? {};

    if (storageMode === "memory") {
      const topic = memoryTopicsById.get(String(topicId));
      if (!topic) {
        res.status(400).json({ message: "Topic not found" });
        return;
      }

      const now = new Date();
      const isSolvedLike = status === "solved" || status === "revisit";
      const problem: MemoryProblem = {
        _id: memoryProblemId(topic.slug, title),
        problemKey: problemKeyForSeed(topic.slug, title),
        isSeeded: false,
        title,
        topic,
        platformName,
        platformUrl,
        roadmapSection,
        roadmapSectionOrder: 999,
        roadmapOrder: 999,
        difficulty,
        status,
        shortNote,
        longNote,
        mistakeLog,
        mistakeTrigger,
        mistakeReason,
        mistakeFix,
        invariant,
        compareBruteForce,
        compareOptimized,
        compareWhyBetter,
        pattern,
        rating,
        revisionCount: isSolvedLike ? 1 : 0,
        revisionStage: isSolvedLike ? 0 : 0,
        solvedAt: status === "solved" ? now : undefined,
        revisitAt: status === "revisit" ? now : undefined,
        lastRevisionAt: isSolvedLike ? now : undefined,
        nextRevisionAt: isSolvedLike ? addDays(now, spacedRevisionDays[0]) : undefined,
        revisionCompletedAt: undefined,
        tags,
        priority,
        isPinned,
        createdAt: now,
        updatedAt: now,
      };

      memoryProblems = [problem, ...memoryProblems.filter((entry) => entry._id !== problem._id)];
      res.status(201).json({ problem: toMemoryProblemResponse(problem) });
      return;
    }

    const now = new Date();
    const isSolvedLike = status === "solved" || status === "revisit";
    const solvedAt = status === "solved" ? now : undefined;
    const revisitAt = status === "revisit" ? now : undefined;

    const created = await Problem.create({
      title,
      topic: topicId,
      roadmapSection,
      platformName,
      platformUrl,
      difficulty,
      status,
      pattern,
      rating,
      shortNote,
      longNote,
      mistakeLog,
      mistakeTrigger,
      mistakeReason,
      mistakeFix,
      invariant,
      compareBruteForce,
      compareOptimized,
      compareWhyBetter,
      tags,
      priority,
      isPinned,
      revisionCount: isSolvedLike ? 1 : 0,
      revisionStage: isSolvedLike ? 0 : 0,
      solvedAt,
      revisitAt,
      lastRevisionAt: isSolvedLike ? now : undefined,
      nextRevisionAt: isSolvedLike ? addDays(now, spacedRevisionDays[0]) : undefined,
    });

    const populated = await created.populate("topic");
    res.status(201).json({ problem: populated });
  })
);

app.patch(
  "/api/problems/:id",
  asyncHandler(async (req, res) => {
    if (storageMode === "memory") {
      const problemIndex = memoryProblems.findIndex((entry) => entry._id === req.params.id);
      if (problemIndex === -1) {
        res.status(404).json({ message: "Problem not found" });
        return;
      }

      const problem = memoryProblems[problemIndex];
      const next = req.body ?? {};
      const previousStatus = problem.status;
      const now = new Date();

      const nextTopicId = typeof next.topicId === "string" ? next.topicId : problem.topic._id;
      const nextTopic = memoryTopicsById.get(nextTopicId) ?? problem.topic;

      Object.assign(problem, {
        title: next.title ?? problem.title,
        topic: nextTopic,
        roadmapSection: next.roadmapSection ?? problem.roadmapSection,
        platformName: next.platformName ?? problem.platformName,
        platformUrl: next.platformUrl ?? problem.platformUrl,
        difficulty: next.difficulty ?? problem.difficulty,
        status: next.status ?? problem.status,
        pattern: next.pattern ?? problem.pattern,
        rating: typeof next.rating === "number" ? next.rating : problem.rating,
        shortNote: next.shortNote ?? problem.shortNote,
        longNote: next.longNote ?? problem.longNote,
        mistakeLog: next.mistakeLog ?? problem.mistakeLog,
        mistakeTrigger: next.mistakeTrigger ?? problem.mistakeTrigger,
        mistakeReason: next.mistakeReason ?? problem.mistakeReason,
        mistakeFix: next.mistakeFix ?? problem.mistakeFix,
        invariant: next.invariant ?? problem.invariant,
        compareBruteForce: next.compareBruteForce ?? problem.compareBruteForce,
        compareOptimized: next.compareOptimized ?? problem.compareOptimized,
        compareWhyBetter: next.compareWhyBetter ?? problem.compareWhyBetter,
        tags: Array.isArray(next.tags) ? next.tags : problem.tags,
        priority: typeof next.priority === "number" ? next.priority : problem.priority,
        isPinned: typeof next.isPinned === "boolean" ? next.isPinned : problem.isPinned,
        updatedAt: now,
      });

      const statusChangedToSolved = problem.status === "solved" && previousStatus !== "solved";
      const statusChangedToRevisit = problem.status === "revisit" && previousStatus !== "revisit";
      const statusChangedToUnsolved = problem.status === "unsolved" && previousStatus !== "unsolved";

      if (statusChangedToUnsolved) {
        clearRevisionSchedule(problem);
      } else if (statusChangedToSolved || statusChangedToRevisit) {
        startRevisionSchedule(problem, now);
      } else if (
        (problem.status === "solved" || problem.status === "revisit") &&
        !problem.nextRevisionAt &&
        !problem.revisionCompletedAt
      ) {
        startRevisionSchedule(problem, now);
      }

      if (problem.status === "solved" && previousStatus !== "solved") {
        problem.solvedAt = now;
      }
      if (problem.status === "revisit" && previousStatus !== "revisit") {
        problem.revisitAt = now;
      }

      memoryProblems[problemIndex] = problem;
      res.json({ problem: toMemoryProblemResponse(problem) });
      return;
    }

    const problem = await Problem.findById(req.params.id);
    if (!problem) {
      res.status(404).json({ message: "Problem not found" });
      return;
    }

    const next = req.body ?? {};
    const previousStatus = problem.status;
    const now = new Date();
    Object.assign(problem, {
      title: next.title ?? problem.title,
      topic: next.topicId ?? problem.topic,
      roadmapSection: next.roadmapSection ?? problem.roadmapSection,
      platformName: next.platformName ?? problem.platformName,
      platformUrl: next.platformUrl ?? problem.platformUrl,
      difficulty: next.difficulty ?? problem.difficulty,
      status: next.status ?? problem.status,
      pattern: next.pattern ?? problem.pattern,
      rating: typeof next.rating === "number" ? next.rating : problem.rating,
      shortNote: next.shortNote ?? problem.shortNote,
      longNote: next.longNote ?? problem.longNote,
      mistakeLog: next.mistakeLog ?? problem.mistakeLog,
      mistakeTrigger: next.mistakeTrigger ?? problem.mistakeTrigger,
      mistakeReason: next.mistakeReason ?? problem.mistakeReason,
      mistakeFix: next.mistakeFix ?? problem.mistakeFix,
      invariant: next.invariant ?? problem.invariant,
      compareBruteForce: next.compareBruteForce ?? problem.compareBruteForce,
      compareOptimized: next.compareOptimized ?? problem.compareOptimized,
      compareWhyBetter: next.compareWhyBetter ?? problem.compareWhyBetter,
      tags: Array.isArray(next.tags) ? next.tags : problem.tags,
      priority: typeof next.priority === "number" ? next.priority : problem.priority,
      isPinned: typeof next.isPinned === "boolean" ? next.isPinned : problem.isPinned,
    });

    const statusChangedToSolved = problem.status === "solved" && previousStatus !== "solved";
    const statusChangedToRevisit = problem.status === "revisit" && previousStatus !== "revisit";
    const statusChangedToUnsolved = problem.status === "unsolved" && previousStatus !== "unsolved";

    if (statusChangedToUnsolved) {
      clearRevisionSchedule(problem);
    } else if (statusChangedToSolved || statusChangedToRevisit) {
      startRevisionSchedule(problem, now);
    } else if (
      (problem.status === "solved" || problem.status === "revisit") &&
      !problem.nextRevisionAt &&
      !problem.revisionCompletedAt
    ) {
      startRevisionSchedule(problem, now);
    }

    if (problem.status === "solved" && previousStatus !== "solved") {
      problem.solvedAt = now;
    }
    if (problem.status === "revisit" && previousStatus !== "revisit") {
      problem.revisitAt = now;
    }

    await problem.save();
    const populated = await problem.populate("topic");
    res.json({ problem: populated });
  })
);

app.post(
  "/api/problems/:id/revision",
  asyncHandler(async (req, res) => {
    if (storageMode === "memory") {
      const problemIndex = memoryProblems.findIndex((entry) => entry._id === req.params.id);
      if (problemIndex === -1) {
        res.status(404).json({ message: "Problem not found" });
        return;
      }

      const problem = memoryProblems[problemIndex];
      if (problem.status === "unsolved") {
        problem.status = "solved";
        problem.solvedAt = problem.solvedAt ?? new Date();
      }

      if (!problem.nextRevisionAt) {
        startRevisionSchedule(problem);
      } else {
        advanceRevisionSchedule(problem);
      }

      problem.updatedAt = new Date();
      memoryProblems[problemIndex] = problem;
      res.json({ problem: toMemoryProblemResponse(problem) });
      return;
    }

    const problem = await Problem.findById(req.params.id);
    if (!problem) {
      res.status(404).json({ message: "Problem not found" });
      return;
    }

    if (problem.status === "unsolved") {
      problem.status = "solved";
      problem.solvedAt = problem.solvedAt ?? new Date();
    }

    if (!problem.nextRevisionAt) {
      startRevisionSchedule(problem);
    } else {
      advanceRevisionSchedule(problem);
    }

    await problem.save();
    const populated = await problem.populate("topic");
    res.json({ problem: populated });
  })
);

app.delete(
  "/api/problems/:id",
  asyncHandler(async (req, res) => {
    if (storageMode === "memory") {
      const nextProblems = memoryProblems.filter((entry) => entry._id !== req.params.id);
      if (nextProblems.length === memoryProblems.length) {
        res.status(404).json({ message: "Problem not found" });
        return;
      }

      memoryProblems = nextProblems;
      res.json({ message: "Problem deleted" });
      return;
    }

    const deleted = await Problem.findByIdAndDelete(req.params.id);
    if (!deleted) {
      res.status(404).json({ message: "Problem not found" });
      return;
    }

    res.json({ message: "Problem deleted" });
  })
);

app.get("/api/health", (_req, res) => {
  res.json({
    ok: true,
    storageMode,
    databaseReady,
    databaseError: databaseError || undefined,
  });
});

if (existsSync(clientDist)) {
  app.use(express.static(clientDist));
  app.get(/^(?!\/api).*/, (_req, res) => {
    res.sendFile(path.join(clientDist, "index.html"));
  });
}

app.use(
  (
    err: unknown,
    _req: express.Request,
    res: express.Response,
    _next: express.NextFunction
  ) => {
    const message = err instanceof Error ? err.message : "Internal server error";
    console.error(err);
    res.status(500).json({ message });
  }
);

app.listen(port, () => {
  console.log(`API running on port ${port}`);
});

void (async () => {
  try {
    await connectDb(mongoUri);
    await ensureSeedTopics();
    await ensureSeedProblems();
    await backfillRevisionSchedules();
    storageMode = "mongo";
    databaseReady = true;
    databaseError = "";
    console.log("Database ready");
  } catch (error) {
    storageMode = "memory";
    databaseReady = true;
    databaseError = error instanceof Error ? `Mongo unavailable, using in-memory fallback: ${error.message}` : "Mongo unavailable, using in-memory fallback";
    console.warn(databaseError);
  }
})();

export default app;

// Serverless deployment – no explicit listen required

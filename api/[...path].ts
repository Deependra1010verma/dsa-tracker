import "dotenv/config";
import type { IncomingMessage, ServerResponse } from "node:http";
import { connectDb } from "../src/api/db.js";
import { Problem, Topic, topicSeeds } from "../src/api/models.js";
import { problemSeeds } from "../src/api/seed.js";
import type { ProblemStatus } from "../src/api/types.js";

const mongoUri = process.env.MONGODB_URI || "";

function normalizeSearch(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function statusFromValue(value: unknown): ProblemStatus | "" {
  return value === "solved" || value === "unsolved" || value === "revisit" || value === "skipped"
    ? value
    : "";
}

function json(res: ServerResponse, statusCode: number, payload: unknown) {
  res.statusCode = statusCode;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(payload));
}

function readBody(req: IncomingMessage): Promise<unknown> {
  const reqWithBody = req as { body?: unknown };
  if (reqWithBody.body !== undefined && reqWithBody.body !== null) {
    const b = reqWithBody.body;
    if (typeof b === "object") {
      if (Buffer.isBuffer(b)) {
        try {
          return Promise.resolve(JSON.parse(b.toString("utf8")));
        } catch {
          return Promise.resolve({});
        }
      }
      return Promise.resolve(b);
    }
    if (typeof b === "string") {
      try {
        return Promise.resolve(JSON.parse(b));
      } catch {
        return Promise.resolve({});
      }
    }
    return Promise.resolve(b);
  }

  if (!req.readable || req.complete) {
    return Promise.resolve({});
  }

  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (chunk) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
    req.on("end", () => {
      const raw = Buffer.concat(chunks).toString("utf8").trim();
      if (!raw) {
        resolve({});
        return;
      }

      try {
        resolve(JSON.parse(raw));
      } catch (error) {
        reject(error);
      }
    });
    req.on("error", reject);
  });
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

function seededProblemScore(problem: {
  status?: string;
  shortNote?: string;
  longNote?: string;
  revisionCount?: number;
  tags?: string[];
  solvedAt?: Date | null;
  revisitAt?: Date | null;
  updatedAt?: Date | null;
}) {
  return [
    problem.status && problem.status !== "unsolved" ? 10 : 0,
    problem.shortNote ? 3 : 0,
    problem.longNote ? 4 : 0,
    (problem.tags?.length ?? 0) > 0 ? 2 : 0,
    Math.min(problem.revisionCount ?? 0, 10),
    problem.solvedAt ? 3 : 0,
    problem.revisitAt ? 2 : 0,
    problem.updatedAt ? problem.updatedAt.getTime() / 1_000_000_000_000 : 0,
  ].reduce((sum, value) => sum + value, 0);
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
          solvedAt: seed.status === "solved" ? new Date() : undefined,
          revisitAt: seed.status === "revisit" ? new Date() : undefined,
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

let seedPromise: Promise<void> | null = null;

async function ensureSeedData() {
  if (!seedPromise) {
    seedPromise = (async () => {
      await ensureSeedTopics();
      await ensureSeedProblems();
    })();
  }

  return seedPromise;
}

async function handleRequest(req: IncomingMessage, res: ServerResponse) {
  await connectDb(mongoUri);
  await ensureSeedData();

  const url = new URL(req.url ?? "/api", "http://localhost");
  const pathname = url.pathname;
  const method = (req.method ?? "GET").toUpperCase();

  try {
    if (pathname === "/api/health" && method === "GET") {
      json(res, 200, { ok: true });
      return;
    }

    if (pathname === "/api/topics" && method === "GET") {
      const topics = await Topic.aggregate([
        { $sort: { order: 1 } },
        {
          $lookup: {
            from: "problems",
            localField: "_id",
            foreignField: "topic",
            as: "problems",
          },
        },
        {
          $addFields: {
            totalProblems: { $size: "$problems" },
            solvedCount: {
              $size: {
                $filter: {
                  input: "$problems",
                  as: "problem",
                  cond: { $eq: ["$$problem.status", "solved"] },
                },
              },
            },
            revisitCount: {
              $size: {
                $filter: {
                  input: "$problems",
                  as: "problem",
                  cond: { $eq: ["$$problem.status", "revisit"] },
                },
              },
            },
          },
        },
        {
          $project: {
            problems: 0,
          },
        },
      ]);

      json(res, 200, { topics });
      return;
    }

    if (pathname === "/api/problems" && method === "GET") {
      const topic = normalizeSearch(url.searchParams.get("topic"));
      const search = normalizeSearch(url.searchParams.get("search"));
      const difficulty = normalizeSearch(url.searchParams.get("difficulty"));
      const status = statusFromValue(url.searchParams.get("status"));

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
          { pattern: { $regex: search, $options: "i" } },
          { platformName: { $regex: search, $options: "i" } },
          { tags: { $regex: search, $options: "i" } },
        ];
      }

      const problems = await Problem.find(filter)
        .populate("topic")
        .sort({ roadmapSectionOrder: 1, roadmapOrder: 1, isPinned: -1, priority: -1, updatedAt: -1 });

      json(res, 200, { problems });
      return;
    }

    if (pathname === "/api/stats" && method === "GET") {
      const [totalProblems, solvedProblems, revisitProblems, unsolvedProblems, skippedProblems] =
        await Promise.all([
          Problem.countDocuments(),
          Problem.countDocuments({ status: "solved" }),
          Problem.countDocuments({ status: "revisit" }),
          Problem.countDocuments({ status: "unsolved" }),
          Problem.countDocuments({ status: "skipped" }),
        ]);

      json(res, 200, {
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

    if (pathname === "/api/problems" && method === "POST") {
      const body = (await readBody(req)) as Record<string, unknown>;
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
        tags = [],
        priority = 0,
        isPinned = false,
      } = body;

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
        tags,
        priority,
        isPinned,
        solvedAt: status === "solved" ? new Date() : undefined,
        revisitAt: status === "revisit" ? new Date() : undefined,
      });

      const populated = await created.populate("topic");
      json(res, 201, { problem: populated });
      return;
    }

    const problemIdMatch = pathname.match(/^\/api\/problems\/([^/]+)$/);
    if (problemIdMatch && method === "PATCH") {
      const problem = await Problem.findById(problemIdMatch[1]);
      if (!problem) {
        json(res, 404, { message: "Problem not found" });
        return;
      }

      const next = ((await readBody(req)) as Record<string, unknown>) ?? {};
      const previousStatus = problem.status;
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
        tags: Array.isArray(next.tags) ? next.tags : problem.tags,
        priority: typeof next.priority === "number" ? next.priority : problem.priority,
        isPinned: typeof next.isPinned === "boolean" ? next.isPinned : problem.isPinned,
      });

      if (problem.status === "solved" && previousStatus !== "solved") {
        problem.solvedAt = new Date();
      }
      if (problem.status === "revisit" && previousStatus !== "revisit") {
        problem.revisitAt = new Date();
        problem.revisionCount += 1;
      }

      await problem.save();
      const populated = await problem.populate("topic");
      json(res, 200, { problem: populated });
      return;
    }

    if (problemIdMatch && method === "DELETE") {
      const deleted = await Problem.findByIdAndDelete(problemIdMatch[1]);
      if (!deleted) {
        json(res, 404, { message: "Problem not found" });
        return;
      }

      json(res, 200, { message: "Problem deleted" });
      return;
    }

    json(res, 404, { message: "Not found" });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Internal server error";
    console.error(error);
    json(res, 500, { message });
  }
}

export default handleRequest;

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

async function ensureSeedTopics() {
  const topicCount = await Topic.countDocuments();
  if (topicCount > 0) {
    return;
  }

  await Topic.insertMany(topicSeeds);
}

async function ensureSeedProblems() {
  const problemCount = await Problem.countDocuments();
  if (problemCount > 0) {
    return;
  }

  const topics = await Topic.find({ slug: { $in: problemSeeds.map((seed) => seed.topicSlug) } });
  const topicsBySlug = new Map(topics.map((topic) => [topic.slug, topic._id]));

  const demoProblems = problemSeeds
    .map((seed) => {
      const topicId = topicsBySlug.get(seed.topicSlug);
      if (!topicId) {
        return null;
      }

      return {
        title: seed.title,
        topic: topicId,
        platformName: seed.platformName,
        platformUrl: seed.platformUrl,
        difficulty: seed.difficulty,
        status: seed.status,
        shortNote: seed.shortNote,
        longNote: seed.longNote,
        tags: seed.tags,
        priority: seed.priority,
        isPinned: seed.isPinned,
        revisionCount: seed.revisionCount ?? 0,
        solvedAt: seed.status === "solved" ? new Date() : undefined,
        revisitAt: seed.status === "revisit" ? new Date() : undefined,
      };
    })
    .filter((problem): problem is NonNullable<typeof problem> => Boolean(problem));

  if (demoProblems.length > 0) {
    await Problem.insertMany(demoProblems);
  }
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
          { platformName: { $regex: search, $options: "i" } },
          { tags: { $regex: search, $options: "i" } },
        ];
      }

      const problems = await Problem.find(filter)
        .populate("topic")
        .sort({ isPinned: -1, priority: -1, updatedAt: -1 });

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
        platformName,
        platformUrl,
        difficulty,
        status,
        shortNote = "",
        longNote = "",
        tags = [],
        priority = 0,
        isPinned = false,
      } = body;

      const created = await Problem.create({
        title,
        topic: topicId,
        platformName,
        platformUrl,
        difficulty,
        status,
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
        platformName: next.platformName ?? problem.platformName,
        platformUrl: next.platformUrl ?? problem.platformUrl,
        difficulty: next.difficulty ?? problem.difficulty,
        status: next.status ?? problem.status,
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

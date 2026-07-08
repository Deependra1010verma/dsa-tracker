import "dotenv/config";
import express, { type RequestHandler } from "express";
import path from "path";
import { existsSync } from "fs";
import { connectDb } from "./db.js";
import { Problem, Topic, topicSeeds } from "./models.js";
import type { ProblemStatus } from "./types.js";

const app = express();
const port = Number(process.env.PORT || 4000);
const mongoUri = process.env.MONGODB_URI || "";
const clientDist = path.resolve(process.cwd(), "../client/dist");

app.use(express.json({ limit: "2mb" }));

const asyncHandler = (handler: RequestHandler): RequestHandler => {
  return (req, res, next) => {
    Promise.resolve(handler(req, res, next)).catch(next);
  };
};

function normalizeSearch(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

async function ensureSeedTopics() {
  const topicCount = await Topic.countDocuments();
  if (topicCount > 0) {
    return;
  }

  await Topic.insertMany(topicSeeds);
}

function statusFromValue(value: unknown): ProblemStatus | "" {
  return value === "solved" || value === "unsolved" || value === "revisit" || value === "skipped"
    ? value
    : "";
}

app.get(
  "/api/topics",
  asyncHandler(async (_req, res) => {
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

    res.json({ topics });
  })
);

app.get(
  "/api/problems",
  asyncHandler(async (req, res) => {
    const topic = normalizeSearch(req.query.topic);
    const search = normalizeSearch(req.query.search);
    const difficulty = normalizeSearch(req.query.difficulty);
    const status = statusFromValue(req.query.status);

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

    res.json({ problems });
  })
);

app.get(
  "/api/stats",
  asyncHandler(async (_req, res) => {
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
      platformName,
      platformUrl,
      difficulty,
      status,
      shortNote = "",
      longNote = "",
      tags = [],
      priority = 0,
      isPinned = false,
    } = req.body ?? {};

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
    res.status(201).json({ problem: populated });
  })
);

app.patch(
  "/api/problems/:id",
  asyncHandler(async (req, res) => {
    const problem = await Problem.findById(req.params.id);
    if (!problem) {
      res.status(404).json({ message: "Problem not found" });
      return;
    }

    const next = req.body ?? {};
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
    res.json({ problem: populated });
  })
);

app.delete(
  "/api/problems/:id",
  asyncHandler(async (req, res) => {
    const deleted = await Problem.findByIdAndDelete(req.params.id);
    if (!deleted) {
      res.status(404).json({ message: "Problem not found" });
      return;
    }

    res.json({ message: "Problem deleted" });
  })
);

app.get("/api/health", (_req, res) => {
  res.json({ ok: true });
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

await connectDb(mongoUri);
await ensureSeedTopics();

app.listen(port, () => {
  console.log(`DSA Tracker API running on http://localhost:${port}`);
});

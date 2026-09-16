import "dotenv/config";
import express, { type RequestHandler } from "express";
import path from "path";
import crypto from "crypto";
import { existsSync } from "fs";
import { connectDb } from "./db.js";
import { Activity, Problem, Topic, topicSeeds, GeneralNoteModelExport } from "./models.js";
import { problemSeeds } from "./seed.js";
import { problemSeeds2, topicSeeds2 } from "./seed2.js";
import { problemSeeds3, topicSeeds3 } from "./seed3.js";
import type { ActivityKind, ProblemStatus, GeneralNote, GeneralNoteCategory, GeneralNoteImportance } from "./types.js";
import { addDays, advanceRevisionSchedule, baseRevisionAnchor, clearRevisionSchedule, initializeRevisionSchedule, revisionIntervalsDays, toValidDate } from "./revision.js";


const allTopicSeeds = [
  ...topicSeeds.map(t => ({ ...t, problemSet: "set1" })),
  ...topicSeeds2.map(t => ({ ...t, problemSet: "set2" })),
  ...topicSeeds3.map(t => ({ ...t, problemSet: "set3" }))
];
const allProblemSeeds = [
  ...problemSeeds.map(p => ({ ...p, problemSet: "set1" })),
  ...problemSeeds2.map(p => ({ ...p, problemSet: "set2" })),
  ...problemSeeds3.map(p => ({ ...p, problemSet: "set3" }))
];

export const generalNoteSeeds: Array<Omit<GeneralNote, "_id" | "createdAt" | "updatedAt">> = [
  {
    title: "Sliding Window Pattern: Fixed vs Dynamic Windows & Invariants",
    category: "Algorithmic Patterns",
    importance: "Essential",
    isPinned: true,
    summary: "Complete blueprint for solving contiguous subarray/substring problems in O(N) time instead of O(N^2).",
    content: `### Core Concept
The Sliding Window technique converts an O(N²) nested loop search into an O(N) linear scan by reusing computations of overlapping contiguous elements.

#### 1. Fixed-Size Window
When window length **K** is fixed:
- Initialize first window of size K.
- Slide right pointer by 1, subtract leftmost element \`arr[i-K]\` and add rightmost \`arr[i]\`.

#### 2. Dynamic-Size Window (Variable Length)
When looking for min/max subarray matching a condition:
- Expand right pointer \`right\` to include elements.
- When condition is violated (or met for min window), shrink left pointer \`left\` while maintaining window invariant.`,
    keyTakeaways: [
      "Always check if contiguous subarray/substring is required. Non-contiguous arrays usually need Dynamic Programming or Hashing.",
      "Use frequency arrays for ASCII strings (size 256 or 26) instead of HashMap for maximum O(1) performance in C++/Java.",
      "Window length formula: (right - left + 1)."
    ],
    mistakesToAvoid: [
      {
        mistake: "Off-by-one errors in window size calculation.",
        whyBad: "Using 'right - left' instead of 'right - left + 1' causes window count to be short by 1 element.",
        correctFix: "Always use: int windowLen = right - left + 1;"
      },
      {
        mistake: "Forgetting to shrink left pointer inside while loop.",
        whyBad: "Causes infinite loop or invalid window expansion beyond array bounds.",
        correctFix: "Ensure 'left++' is inside the condition shrink while loop."
      }
    ],
    codeSnippets: [
      {
        title: "C++ Variable Sliding Window Template",
        language: "cpp",
        code: `int maxSubArrayLen(vector<int>& nums, int k) {
    unordered_map<int, int> freq;
    int left = 0, maxLen = 0;
    
    for (int right = 0; right < nums.size(); right++) {
        freq[nums[right]]++;
        
        // Shrink window while condition is violated
        while (/* condition violated, e.g. distinct elements > k */) {
            freq[nums[left]]--;
            if (freq[nums[left]] == 0) freq.erase(nums[left]);
            left++;
        }
        
        maxLen = max(maxLen, right - left + 1);
    }
    return maxLen;
}`,
        explanation: "Standard dynamic sliding window template maintaining frequency map and two pointers."
      }
    ],
    tags: ["Sliding Window", "Two Pointers", "Subarray", "C++", "O(N)"]
  },
  {
    title: "Binary Search Edge Cases: Never Get Stuck in Infinite Loops",
    category: "Algorithmic Patterns",
    importance: "Essential",
    isPinned: true,
    summary: "Universal template for Binary Search avoiding integer overflow and infinite while(low < high) loops.",
    content: `### Binary Search Foundations
Binary Search operates on a monotonic search space (sorted array or monotonic predicate function).

#### Calculating Midpoint safely
Never use \`mid = (low + high) / 2\` because \`low + high\` can overflow 32-bit signed integer limits ($2^{31} - 1$).
Use: \`mid = low + (high - low) / 2\`

#### Left Bias vs Right Bias
- Left Bias (standard): \`mid = low + (high - low) / 2\` -> paired with \`low = mid + 1\` and \`high = mid\`.
- Right Bias (upper bound): \`mid = low + (high - low + 1) / 2\` -> paired with \`high = mid - 1\` and \`low = mid\`.`,
    keyTakeaways: [
      "Identify the monotonic condition P(x): false false false ... true true true.",
      "Lower Bound: smallest index i where arr[i] >= target.",
      "Upper Bound: smallest index i where arr[i] > target."
    ],
    mistakesToAvoid: [
      {
        mistake: "Using low = mid with mid = low + (high - low) / 2 when low + 1 == high.",
        whyBad: "mid evaluates to low, so low = mid does not advance low, causing an infinite while loop.",
        correctFix: "Use right-biased mid calculation 'low + (high - low + 1) / 2' whenever setting low = mid."
      },
      {
        mistake: "Integer overflow in binary search on answer range [1, 10^9].",
        whyBad: "low + high exceeds 2 * 10^9 limit.",
        correctFix: "Use long long or 'low + (high - low) / 2'."
      }
    ],
    codeSnippets: [
      {
        title: "Universal Lower Bound Template (C++)",
        language: "cpp",
        code: `int lowerBound(vector<int>& nums, int target) {
    int low = 0, high = nums.size(); // Range [0, N]
    while (low < high) {
        int mid = low + (high - low) / 2;
        if (nums[mid] >= target) {
            high = mid; // Narrow right boundary
        } else {
            low = mid + 1; // Narrow left boundary
        }
    }
    return low; // First index where nums[i] >= target
}`,
        explanation: "Clean lower bound template returning index of first element >= target."
      }
    ],
    tags: ["Binary Search", "Two Pointers", "Templates", "Edge Cases"]
  },
  {
    title: "Monotonic Stack Pattern & Next Greater Element Boilerplate",
    category: "Data Structures",
    importance: "Important",
    isPinned: false,
    summary: "Monotonic Stack maintains elements in strict increasing or decreasing order to solve range/NGE problems in O(N).",
    content: `### Monotonic Stack Insights
When you need to find the **Next Greater Element**, **Next Smaller Element**, **Previous Greater Element**, or **Previous Smaller Element** for every element in an array in linear time O(N).

#### Stack Invariants
- **Monotonic Decreasing Stack**: Stack elements are ordered from largest (bottom) to smallest (top). Used for Next Greater Element.
- **Monotonic Increasing Stack**: Stack elements are ordered from smallest (bottom) to largest (top). Used for Next Smaller Element (e.g. Largest Rectangle in Histogram).`,
    keyTakeaways: [
      "Always store indices in the stack instead of raw values, because index gives both value (arr[i]) and distance (i - stack.top()).",
      "Process remaining elements in stack after linear loop if needed."
    ],
    mistakesToAvoid: [
      {
        mistake: "Pushing raw array values instead of array indices into stack.",
        whyBad: "Prevents calculating distances or widths needed for histogram / trapping rain water problems.",
        correctFix: "Push i (the index) into stack: st.push(i)."
      }
    ],
    codeSnippets: [
      {
        title: "Next Greater Element Template",
        language: "cpp",
        code: `vector<int> nextGreaterElement(vector<int>& nums) {
    int n = nums.size();
    vector<int> res(n, -1);
    stack<int> st; // Stores indices
    
    for (int i = 0; i < n; i++) {
        while (!st.empty() && nums[st.top()] < nums[i]) {
            res[st.top()] = nums[i];
            st.pop();
        }
        st.push(i);
    }
    return res;
}`,
        explanation: "Monotonic decreasing stack that pops elements once a greater element is encountered."
      }
    ],
    tags: ["Stack", "Monotonic Stack", "NGE", "Data Structures"]
  },
  {
    title: "Top 10 DSA Interview Mistakes & Coding Anti-Patterns To Avoid",
    category: "Mistakes & Anti-Patterns",
    importance: "Essential",
    isPinned: true,
    summary: "Crucial checklist of traps to avoid during live technical interviews and problem solving.",
    content: `### 1. Diving straight into code without clarifying requirements
Never start typing code immediately after hearing a problem. First:
1. Clarify constraints (N size, element bounds, negative values, duplicates).
2. Talk through sample test cases & edge cases.
3. State brute force complexity, then optimize.

### 2. Modifying Array while Iterating
Mutating an array or vector while looping through it alters indices and array length dynamically, producing subtle bugs.

### 3. Missing Base Cases in Recursion / DFS
Every recursive function MUST have a terminating condition before making child calls.`,
    keyTakeaways: [
      "Always test edge cases out loud: N=0, N=1, all negative, duplicates, INT_MAX.",
      "Check time complexity vs constraints: N <= 10^5 requires O(N) or O(N log N). N <= 20 allows O(2^N)."
    ],
    mistakesToAvoid: [
      {
        mistake: "Jumping straight to code without writing dry run step-by-step.",
        whyBad: "Leads to mid-code panic, incorrect logic, and wasted interview time.",
        correctFix: "Write pseudo-code and test with small example input first."
      },
      {
        mistake: "Using global or static variables across test cases.",
        whyBad: "State leaks between consecutive test calls, breaking submission on LeetCode/platforms.",
        correctFix: "Pass state via function parameters or class member variables initialized per call."
      }
    ],
    codeSnippets: [],
    tags: ["Interview Prep", "Best Practices", "Anti-Patterns", "Mindset"]
  },
  {
    title: "Graph Traversal: BFS vs DFS Space Overhead & Visited Array Rules",
    category: "Algorithmic Patterns",
    importance: "Important",
    isPinned: false,
    summary: "Key differences in memory footprint, visited node marking placement, and shortest path properties.",
    content: `### BFS vs DFS Comparison

| Property | BFS (Breadth-First Search) | DFS (Depth-First Search) |
|---|---|---|
| **Data Structure** | Queue (FIFO) | Stack (LIFO / Recursion) |
| **Shortest Path** | Guarantees shortest path in unweighted graph | Does NOT guarantee shortest path |
| **Space Overhead** | O(W) where W is max width of graph | O(H) where H is max depth/height |

### Critical Rule for BFS Visited Set
Mark a node as visited **IMMEDIATELY when pushing it into the queue**, NOT when popping it! Marking on pop causes the same node to be pushed multiple times by adjacent neighbors, exploding queue size to exponential O(V^2).`,
    keyTakeaways: [
      "Mark visited at PUSH time in BFS to prevent duplicate queue entries.",
      "Use BFS for shortest path in unweighted graphs or grid matrices."
    ],
    mistakesToAvoid: [
      {
        mistake: "Marking visited on queue pop instead of queue push.",
        whyBad: "The same neighbor node gets added multiple times by different adjacent nodes before it gets popped, leading to TLE or MLE.",
        correctFix: "Set visited[neighbor] = true inside the push loop."
      }
    ],
    codeSnippets: [
      {
        title: "Correct BFS Queue Visited Marking (C++)",
        language: "cpp",
        code: `void bfs(int startNode, vector<vector<int>>& adj, int n) {
    vector<bool> visited(n, false);
    queue<int> q;
    
    q.push(startNode);
    visited[startNode] = true; // Mark on push!
    
    while (!q.empty()) {
        int curr = q.front();
        q.pop();
        
        for (int neighbor : adj[curr]) {
            if (!visited[neighbor]) {
                visited[neighbor] = true; // Mark on push!
                q.push(neighbor);
            }
        }
    }
}`,
        explanation: "Standard BFS grid / graph traversal with proper push-time visited tracking."
      }
    ],
    tags: ["Graph", "BFS", "DFS", "Shortest Path", "Space Complexity"]
  }
];


const app = express();
const port = Number(process.env.PORT || 4000);
const mongoUri = process.env.MONGODB_URI || "";
const clientDist = path.resolve(process.cwd(), "dist/web");
let storageMode: "mongo" | "memory" = "mongo";
let databaseReady = false;
let databaseError = "";
let databaseInitPromise: Promise<void> | null = null;

function getServerAuthCredentials() {
  const username = (process.env.USERNAME || process.env.LOGIN_USERNAME || "").trim();
  const password = process.env.PASSWORD || process.env.LOGIN_PASSWORD || "";
  return { username, password, isConfigured: Boolean(username && password) };
}

const AUTH_SECRET = process.env.JWT_SECRET || process.env.SESSION_SECRET || "dsa-tracker-hmac-secret-key-2026";

function generateAuthToken(username: string): string {
  const timestamp = Date.now();
  const payload = `${username}:${timestamp}`;
  const signature = crypto.createHmac("sha256", AUTH_SECRET).update(payload).digest("hex");
  return Buffer.from(`${payload}:${signature}`).toString("base64url");
}

function verifyAuthToken(token: string): boolean {
  if (!token) return false;
  try {
    const decoded = Buffer.from(token, "base64url").toString("utf-8");
    const lastColonIdx = decoded.lastIndexOf(":");
    if (lastColonIdx === -1) return false;
    const payload = decoded.substring(0, lastColonIdx);
    const signature = decoded.substring(lastColonIdx + 1);

    const expectedSig = crypto.createHmac("sha256", AUTH_SECRET).update(payload).digest("hex");
    if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSig))) {
      return false;
    }

    const firstColonIdx = payload.indexOf(":");
    if (firstColonIdx === -1) return false;
    const username = payload.substring(0, firstColonIdx);
    const { username: configUser, isConfigured } = getServerAuthCredentials();
    if (isConfigured && username !== configUser) {
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

app.use(express.json({ limit: "2mb" }));

app.use((req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "SAMEORIGIN");
  res.setHeader("X-XSS-Protection", "1; mode=block");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");

  const origin = req.headers.origin;
  if (origin) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Vary", "Origin");
  } else {
    res.setHeader("Access-Control-Allow-Origin", "*");
  }
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, PATCH, DELETE, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Auth-Token");

  if (req.method === "OPTIONS") {
    res.sendStatus(204);
    return;
  }
  next();
});

const asyncHandler = (handler: RequestHandler): RequestHandler => {
  return (req, res, next) => {
    Promise.resolve(handler(req, res, next)).catch(next);
  };
};

function getMongoUri(): string {
  return (process.env.MONGODB_URI || "").trim();
}

async function dropLegacyTopicIndexes() {
  try {
    await Topic.collection.dropIndex("name_1");
  } catch {
    // Index may already be dropped or not exist
  }
}

async function initializeStorage() {
  const currentMongoUri = getMongoUri();
  if (!currentMongoUri) {
    if (process.env.NODE_ENV === "production") {
      storageMode = "memory";
      databaseReady = false;
      databaseError = "MONGODB_URI is required in production for permanent storage.";
      console.error(databaseError);
      return;
    }

    storageMode = "memory";
    databaseReady = true;
    databaseError = "No MONGODB_URI provided, using in-memory fallback";
    console.warn(databaseError);
    return;
  }

  try {
    await connectDb(currentMongoUri);
    storageMode = "mongo";

    await dropLegacyTopicIndexes();
    await ensureSeedTopics();
    await ensureSeedGeneralNotes();
    await ensureSeedProblems();

    const problemCount = await Problem.countDocuments();
    if (problemCount === 0) {
      console.log("Database is empty. Initializing revision & activities...");
      await backfillRevisionSchedules();
      await ensureActivityHistory();
      console.log("Database seeding completed.");
    } else {
      await Problem.updateMany(
        { $or: [{ problemSet: { $exists: false } }, { problemSet: null }] },
        { $set: { problemSet: "set1" } }
      );
      await Topic.updateMany(
        { $or: [{ problemSet: { $exists: false } }, { problemSet: null }] },
        { $set: { problemSet: "set1" } }
      );
    }

    databaseReady = true;
    databaseError = "";
    console.log("Database ready (mongo)");
  } catch (error) {
    storageMode = "memory";
    databaseReady = true;
    databaseError = error instanceof Error ? error.message : String(error);
    console.warn("MongoDB connection failed; falling back to in-memory mode:", databaseError);
  }
}

databaseInitPromise = initializeStorage();

app.use(
  "/api",
  asyncHandler(async (req, res, next) => {
    if (req.path === "/health") {
      next();
      return;
    }

    if (databaseInitPromise) {
      await databaseInitPromise;
    }

    if (!databaseReady && storageMode === "memory") {
      databaseReady = true;
    }

    if (!databaseReady) {
      res.status(503).json({
        message: "Storage is not ready. Please check MONGODB_URI.",
        error: databaseError,
      });
      return;
    }

    next();
  })
);

// Auth endpoints
app.get("/api/auth/status", (_req, res) => {
  const { isConfigured, username } = getServerAuthCredentials();
  res.json({ isConfigured, usernameConfigured: Boolean(username) });
});

app.post("/api/auth/login", (req, res) => {
  const { username, password } = req.body ?? {};
  const creds = getServerAuthCredentials();

  if (!creds.isConfigured) {
    const token = generateAuthToken(username || "user");
    res.json({ success: true, token, username: username || "user" });
    return;
  }

  const inputUser = typeof username === "string" ? username.trim() : "";
  const inputPass = typeof password === "string" ? password : "";

  if (inputUser === creds.username && inputPass === creds.password) {
    const token = generateAuthToken(creds.username);
    res.json({ success: true, token, username: creds.username });
  } else {
    setTimeout(() => {
      res.status(401).json({ message: "Invalid username or password" });
    }, 400);
  }
});

app.get("/api/auth/check", (req, res) => {
  const authHeader = req.headers.authorization || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.substring(7) : (req.headers["x-auth-token"] as string) || "";
  const isValid = verifyAuthToken(token);
  if (isValid) {
    res.json({ valid: true });
  } else {
    res.status(401).json({ valid: false, message: "Invalid or expired token" });
  }
});

// Protected route middleware
app.use("/api", (req, res, next) => {
  if (req.path.startsWith("/auth/") || req.path === "/health") {
    return next();
  }

  const creds = getServerAuthCredentials();
  if (!creds.isConfigured) {
    return next();
  }

  const authHeader = req.headers.authorization || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.substring(7) : (req.headers["x-auth-token"] as string) || "";

  if (verifyAuthToken(token)) {
    return next();
  }

  res.status(401).json({ message: "Authentication required. Please log in." });
});

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

function coerceDate(value: unknown) {
  if (value instanceof Date) {
    return value;
  }

  const date = new Date(value as never);
  return Number.isNaN(date.getTime()) ? new Date() : date;
}

function startRevisionSchedule(problem: any, anchorOverride?: Date) {
  initializeRevisionSchedule(problem, anchorOverride);
}

function isRevisionActiveStatus(status: unknown): status is "solved" | "revisit" {
  return status === "solved" || status === "revisit";
}

function syncRevisionScheduleForStatus(problem: any, previousStatus: unknown, now: Date) {
  const statusChangedToRevisit = problem.status === "revisit" && previousStatus !== "revisit";
  const statusChangedToUnscheduled = !isRevisionActiveStatus(problem.status);
  const statusChangedFromUnscheduled = isRevisionActiveStatus(problem.status) && !isRevisionActiveStatus(previousStatus);
  const hasExistingSchedule = Boolean(
    toValidDate(problem.lastRevisionAt) || toValidDate(problem.nextRevisionAt) || toValidDate(problem.revisionCompletedAt)
  );

  if (statusChangedToUnscheduled) {
    clearRevisionSchedule(problem);
    return;
  }

  if (statusChangedToRevisit) {
    startRevisionSchedule(problem, now);
    return;
  }

  if (statusChangedFromUnscheduled || !hasExistingSchedule) {
    startRevisionSchedule(problem, now);
    return;
  }

  if (problem.revisionCompletedAt && !problem.nextRevisionAt && problem.status === "solved") {
    problem.lastRevisionAt = problem.lastRevisionAt ?? baseRevisionAnchor(problem);
  }
}

function patchDateField(target: any, source: Record<string, unknown>, field: string) {
  if (!Object.prototype.hasOwnProperty.call(source, field)) {
    return;
  }

  const value = source[field];
  target[field] = value === null || value === "" || value === undefined ? undefined : coerceDate(value);
}

function applyRevisionProgressPatch(problem: any, next: Record<string, unknown>) {
  if (typeof next.revisionCount === "number" && Number.isFinite(next.revisionCount)) {
    problem.revisionCount = Math.max(0, Math.floor(next.revisionCount));
  }

  if (typeof next.revisionStage === "number" && Number.isFinite(next.revisionStage)) {
    problem.revisionStage = Math.max(0, Math.floor(next.revisionStage));
  }

  patchDateField(problem, next, "solvedAt");
  patchDateField(problem, next, "revisitAt");
  patchDateField(problem, next, "lastRevisionAt");
  patchDateField(problem, next, "nextRevisionAt");
  patchDateField(problem, next, "revisionCompletedAt");
}

// Use local-time date strings (YYYY-MM-DD) so the "same day" check matches what
// the frontend computes via toDateKey(). Using UTC would create a mismatch for
// users in UTC+N timezones (e.g. IST at 00:00-05:29 is still "yesterday" in UTC).
function isSameLocalDay(left: Date, right: Date) {
  const toLocalDateKey = (d: Date) => {
    const year = d.getFullYear();
    const month = `${d.getMonth() + 1}`.padStart(2, "0");
    const day = `${d.getDate()}`.padStart(2, "0");
    return `${year}-${month}-${day}`;
  };
  return toLocalDateKey(left) === toLocalDateKey(right);
}

function canCompleteRevisionToday(problem: {
  status?: unknown;
  revisionCount?: number;
  revisionCompletedAt?: unknown;
  lastRevisionAt?: unknown;
}) {
  if (!isRevisionActiveStatus(problem.status)) {
    return false;
  }

  if (toValidDate(problem.revisionCompletedAt)) {
    return false;
  }

  const lastRevisionAt = toValidDate(problem.lastRevisionAt);
  if (!lastRevisionAt) {
    return true;
  }

  if ((problem.revisionCount ?? 0) <= 0) {
    return true;
  }

  return !isSameLocalDay(lastRevisionAt, new Date());
}

function seededProblemScore(problem: {
  status?: string;
  shortNote?: string;
  longNote?: string;
  codeSnippet?: string;
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
    problem.codeSnippet ? 2 : 0,
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
    // Normalize updatedAt to a bounded [0, 2] contribution.
    // We measure recency relative to a fixed baseline (2024-01-01) and cap at 2 years out.
    // This prevents the tiebreaker from growing unboundedly each year.
    problem.updatedAt
      ? Math.min((problem.updatedAt.getTime() - 1_704_067_200_000) / (2 * 365.25 * 24 * 3600 * 1000), 2)
      : 0,
  ].reduce((sum, value) => sum + value, 0);
}

type MemoryTopic = {
  _id: string;
  name: string;
  slug: string;
  problemSet: string;
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
  codeSnippet: string;
  codeSnippetLang: string;
  mistakeLog: string;
  mistakeTrigger: string;
  mistakeReason: string;
  mistakeFix: string;
  invariant: string;
  compareBruteForce: string;
  compareOptimized: string;
  compareWhyBetter: string;
  prerequisites?: Array<{ title: string; platformName?: string; platformUrl?: string; note?: string; kind?: "prerequisite" | "warmup" | "stepping_stone" }>;
  patternFamily?: Array<{ title: string; platformName?: string; platformUrl?: string; note?: string }>;
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

type MemoryActivity = {
  _id: string;
  problemId: string;
  topicId: string;
  kind: ActivityKind;
  occurredAt: Date;
};

const memoryTopics: MemoryTopic[] = allTopicSeeds.map((seed) => ({
  _id: `topic:${seed.slug}`,
  name: seed.name,
  slug: seed.slug,
  problemSet: seed.problemSet,
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

function seedProblemToMemoryProblem(seed: (typeof allProblemSeeds)[number]): MemoryProblem {
  const topic = memoryTopicsBySlug.get(seed.topicSlug);
  if (!topic) {
    throw new Error(`Missing topic seed for ${seed.topicSlug}`);
  }

  const now = new Date();
  const isSolvedLike = isRevisionActiveStatus(seed.status);
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
    codeSnippet: "",
    codeSnippetLang: "cpp",
    mistakeLog: seed.mistakeLog ?? "",
    mistakeTrigger: seed.mistakeTrigger ?? "",
    mistakeReason: seed.mistakeReason ?? "",
    mistakeFix: seed.mistakeFix ?? "",
    invariant: seed.invariant ?? "",
    compareBruteForce: seed.compareBruteForce ?? "",
    compareOptimized: seed.compareOptimized ?? "",
    compareWhyBetter: seed.compareWhyBetter ?? "",
    prerequisites: seed.prerequisites ? [...seed.prerequisites] : [],
    patternFamily: seed.patternFamily ? [...seed.patternFamily] : [],
    pattern: seed.pattern ?? "",
    rating: seed.rating ?? 0,
    revisionCount: 0,
    revisionStage: 0,
    solvedAt,
    revisitAt,
    lastRevisionAt: isSolvedLike ? now : undefined,
    nextRevisionAt: isSolvedLike ? addDays(now, revisionIntervalsDays[0] ?? 1) : undefined,
    tags: [...seed.tags],
    priority: seed.priority,
    isPinned: seed.isPinned,
    createdAt: now,
    updatedAt: now,
  };
}

let memoryProblems: MemoryProblem[] = allProblemSeeds.map(seedProblemToMemoryProblem);
let memoryActivities: MemoryActivity[] = [];

for (const problem of memoryProblems) {
  if (problem.solvedAt) {
    appendMemoryActivity(problem, "solved", problem.solvedAt);
  }
  if (problem.revisitAt) {
    appendMemoryActivity(problem, "revisit", problem.revisitAt);
  }
}

function cloneMemoryTopic(topic: MemoryTopic) {
  return { ...topic };
}

function memoryActivityId(problemId: string, kind: ActivityKind, occurredAt: Date) {
  return `activity:${problemId}:${kind}:${occurredAt.getTime()}`;
}

function appendMemoryActivity(problem: MemoryProblem, kind: ActivityKind, occurredAt: Date) {
  const timestamp = coerceDate(occurredAt);
  const activity: MemoryActivity = {
    _id: memoryActivityId(problem._id, kind, timestamp),
    problemId: problem._id,
    topicId: problem.topic._id,
    kind,
    occurredAt: timestamp,
  };

  const duplicate = memoryActivities.some(
    (entry) =>
      entry.problemId === activity.problemId &&
      entry.kind === activity.kind &&
      Math.abs(entry.occurredAt.getTime() - activity.occurredAt.getTime()) < 1000
  );

  if (!duplicate) {
    memoryActivities = [activity, ...memoryActivities];
  }
}

function toMemoryProblemResponse(problem: MemoryProblem, brief = false) {
  const hasNotes = hasUserProblemNotes(problem);
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
    hasNotes,
    shortNote: problem.shortNote,
    longNote: brief ? undefined : problem.longNote,
    codeSnippet: brief ? undefined : problem.codeSnippet,
    codeSnippetLang: brief ? undefined : problem.codeSnippetLang,
    mistakeLog: brief ? undefined : problem.mistakeLog,
    mistakeTrigger: brief ? undefined : problem.mistakeTrigger,
    mistakeReason: brief ? undefined : problem.mistakeReason,
    mistakeFix: brief ? undefined : problem.mistakeFix,
    invariant: brief ? undefined : problem.invariant,
    compareBruteForce: brief ? undefined : problem.compareBruteForce,
    compareOptimized: brief ? undefined : problem.compareOptimized,
    compareWhyBetter: brief ? undefined : problem.compareWhyBetter,
    prerequisites: problem.prerequisites ? [...problem.prerequisites] : [],
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

const problemNoteFields = [
  "shortNote",
  "longNote",
  "codeSnippet",
  "mistakeLog",
  "mistakeTrigger",
  "mistakeReason",
  "mistakeFix",
  "compareBruteForce",
  "compareOptimized",
  "compareWhyBetter",
] as const;

function normalizedText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function hasUserProblemNotes(problem: Partial<MemoryProblem> & { problemKey?: string; topic?: { slug?: string } }) {
  const seed = allProblemSeeds.find((entry) =>
    problem.problemKey
      ? problemKeyForSeed(entry.topicSlug, entry.title) === problem.problemKey
      : entry.topicSlug === problem.topic?.slug && entry.title === problem.title
  );
  const seedRecord = seed as Record<string, unknown> | undefined;

  return problemNoteFields.some((field) => {
    const currentValue = normalizedText(problem[field]);
    if (!currentValue) return false;
    if (!seedRecord) return true;
    return currentValue !== normalizedText(seedRecord[field]);
  });
}

function toMemoryActivityResponse(activity: MemoryActivity) {
  const problem = memoryProblems.find((entry) => entry._id === activity.problemId);
  if (!problem) {
    return null;
  }

  return {
    _id: activity._id,
    kind: activity.kind,
    occurredAt: activity.occurredAt,
    problem: {
      _id: problem._id,
      title: problem.title,
      difficulty: problem.difficulty,
      platformName: problem.platformName,
    },
    topic: {
      _id: problem.topic._id,
      name: problem.topic.name,
    },
  };
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
  const operations = allTopicSeeds.map((seed) => ({
    updateOne: {
      filter: { slug: seed.slug },
      update: {
        $set: {
          name: seed.name,
          order: seed.order,
          problemSet: seed.problemSet,
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
  const topics = await Topic.find({ slug: { $in: allProblemSeeds.map((seed) => seed.topicSlug) } });
  const topicsBySlug = new Map(topics.map((topic) => [topic.slug, topic._id]));
  const topicIds = topics.map((topic) => topic._id);

  const seededDefinitions = allProblemSeeds
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
            problemSet: seed.problemSet,
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
          problemSet: seed.problemSet,
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
          revisionCount: 0,
          revisionStage: 0,
          solvedAt: seed.status === "solved" ? new Date() : undefined,
          revisitAt: seed.status === "revisit" ? new Date() : undefined,
          lastRevisionAt: isRevisionActiveStatus(seed.status) ? new Date() : undefined,
          nextRevisionAt:
            isRevisionActiveStatus(seed.status) ? addDays(new Date(), revisionIntervalsDays[0] ?? 1) : undefined,
        },
      },
      upsert: true,
    },
  }));

  if (operations.length > 0) {
    await Problem.bulkWrite(operations);
  }

  // Log any seeded problems that will be deleted BEFORE actually removing them.
  // This makes it safe to catch accidental deletions from seed file typos or removals.
  const staleSeededProblems = await Problem.find(
    { isSeeded: true, problemKey: { $nin: seededKeys } },
    { title: 1, problemKey: 1 }
  ).lean();

  if (staleSeededProblems.length > 0) {
    console.warn(
      `[ensureSeedProblems] Deleting ${staleSeededProblems.length} stale seeded problem(s) no longer in seed file:`,
      staleSeededProblems.map((p) => `"${p.title}" (${p.problemKey})`).join(", ")
    );
    await Problem.deleteMany({
      isSeeded: true,
      problemKey: { $nin: seededKeys },
    });
  }
}

let memoryGeneralNotes: GeneralNote[] = generalNoteSeeds.map((seed, idx) => ({
  _id: `note:${idx + 1}`,
  ...seed,
  createdAt: new Date(),
  updatedAt: new Date(),
}));

async function ensureSeedGeneralNotes() {
  for (const seed of generalNoteSeeds) {
    await GeneralNoteModelExport.findOneAndUpdate(
      { title: seed.title },
      { $setOnInsert: seed },
      { upsert: true, new: false }
    );
  }
}


function statusFromValue(value: unknown): ProblemStatus | "" {
  return value === "solved" || value === "unsolved" || value === "revisit" || value === "skipped"
    ? value
    : "";
}

async function recordMongoActivity(problem: { _id: unknown; topic: unknown }, kind: ActivityKind, occurredAt: Date) {
  const when = coerceDate(occurredAt);
  const existing = await Activity.findOne({
    problem: problem._id,
    kind,
    occurredAt: {
      $gte: new Date(when.getTime() - 1000),
      $lte: new Date(when.getTime() + 1000),
    },
  }).select("_id");

  if (!existing) {
    await Activity.create({
      problem: problem._id,
      topic: problem.topic,
      kind,
      occurredAt: when,
    });
  }
}

async function backfillRevisionSchedules() {
  const problems = await Problem.find({
    status: { $in: ["solved", "revisit"] },
    $or: [
      { lastRevisionAt: { $exists: false } },
      { lastRevisionAt: null },
      { nextRevisionAt: { $exists: false }, revisionCompletedAt: { $exists: false } },
      { nextRevisionAt: null, revisionCompletedAt: null },
    ],
  });

  if (problems.length === 0) return;

  const writes = problems.map((problem) => {
    startRevisionSchedule(problem);
    return {
      updateOne: {
        filter: { _id: problem._id },
        update: {
          $set: {
            lastRevisionAt: problem.lastRevisionAt,
            nextRevisionAt: problem.nextRevisionAt,
            revisionStage: problem.revisionStage,
            revisionCount: problem.revisionCount,
          },
        },
      },
    };
  });

  await Problem.bulkWrite(writes);
}

async function ensureActivityHistory() {
  const problems = await Problem.find().select("_id topic status solvedAt revisitAt lastRevisionAt revisionCompletedAt updatedAt");

  for (const problem of problems) {
    if (problem.solvedAt) {
      await recordMongoActivity(problem, "solved", problem.solvedAt);
    } else if (problem.status === "solved") {
      await recordMongoActivity(problem, "solved", coerceDate(problem.updatedAt));
    }
    if (problem.revisitAt) {
      await recordMongoActivity(problem, "revisit", problem.revisitAt);
    } else if (problem.status === "revisit") {
      await recordMongoActivity(problem, "revisit", coerceDate(problem.updatedAt));
    }
    if (problem.revisionCompletedAt) {
      await recordMongoActivity(problem, "revision", problem.revisionCompletedAt);
    } else if (problem.lastRevisionAt && !problem.solvedAt && !problem.revisitAt) {
      await recordMongoActivity(problem, "revision", problem.lastRevisionAt);
    }
  }
}

app.get(
  "/api/topics",
  asyncHandler(async (req, res) => {
    const problemSet = normalizeSearch(req.query.set) || "set1";

    if (storageMode === "memory") {
      res.json({ topics: getMemoryTopicsWithCounts().filter(t => t.problemSet === problemSet) });
      return;
    }

    const [topics, counts] = await Promise.all([
      Topic.find({ problemSet }).sort({ order: 1 }).lean(),
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
    const problemSet = normalizeSearch(req.query.set) || "set1";
    const topic = normalizeSearch(req.query.topic);
    const search = normalizeSearch(req.query.search);
    const difficulty = normalizeSearch(req.query.difficulty);
    const status = statusFromValue(req.query.status);
    const brief = normalizeSearch(req.query.brief) === "1";

    if (storageMode === "memory") {
      const seen = new Set<string>();
      const problems = memoryProblems
        .filter((problem) => {
          if (problem.topic.problemSet !== problemSet) return false;
          if (seen.has(problem._id)) return false;
          seen.add(problem._id);
          const matchesTopic = !topic || Boolean(search) || problem.topic._id === topic || problem.topic.slug === topic;
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

    const filter: Record<string, unknown> =
      problemSet === "set1"
        ? { $or: [{ problemSet: "set1" }, { problemSet: { $exists: false } }, { problemSet: null }] }
        : { problemSet };
    if (topic && !search) {
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
        "problemKey isSeeded title topic platformName platformUrl roadmapSection roadmapSectionOrder roadmapOrder difficulty status shortNote longNote codeSnippet codeSnippetLang mistakeLog mistakeTrigger mistakeReason mistakeFix invariant compareBruteForce compareOptimized compareWhyBetter pattern rating revisionCount revisionStage solvedAt revisitAt lastRevisionAt nextRevisionAt revisionCompletedAt prerequisites tags priority isPinned updatedAt"
      );
    }

    const rawProblems = await query.lean();
    const mongoSeen = new Set<string>();
    const problems = rawProblems.filter((p: any) => {
      const idStr = String(p._id);
      if (mongoSeen.has(idStr)) return false;
      mongoSeen.add(idStr);
      return true;
    });

    const responseProblems = problems.map((problem: any) => {
      const response = {
        ...problem,
        hasNotes: hasUserProblemNotes(problem),
      };

      if (brief) {
        delete response.longNote;
        delete response.codeSnippet;
        delete response.codeSnippetLang;
        delete response.mistakeLog;
        delete response.mistakeTrigger;
        delete response.mistakeReason;
        delete response.mistakeFix;
        delete response.invariant;
        delete response.compareBruteForce;
        delete response.compareOptimized;
        delete response.compareWhyBetter;
      }

      return response;
    });

    res.json({ problems: responseProblems });
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
  "/api/activity",
  asyncHandler(async (req, res) => {
    const topic = normalizeSearch(req.query.topic);
    const problemSet = normalizeSearch(req.query.set);
    const limit = Math.min(Math.max(Number(req.query.limit) || 1000, 1), 5000);

    if (storageMode === "memory") {
      const problemIdsForSet = problemSet
        ? new Set(memoryProblems.filter((problem) => problem.topic.problemSet === problemSet).map((problem) => problem._id))
        : null;
      const activities = memoryActivities
        .filter((activity) => !topic || activity.topicId === topic)
        .filter((activity) => !problemIdsForSet || problemIdsForSet.has(activity.problemId))
        .slice()
        .sort((left, right) => right.occurredAt.getTime() - left.occurredAt.getTime())
        .slice(0, limit)
        .map(toMemoryActivityResponse)
        .filter(Boolean);

      res.json({ activities });
      return;
    }

    const filter: Record<string, unknown> = {};
    if (topic) {
      filter.topic = topic;
    }
    if (problemSet) {
      const topicIds = await Topic.find({ problemSet }).distinct("_id");
      filter.topic = topic ? topic : { $in: topicIds };
    }

    const activities = await Activity.find(filter)
      .sort({ occurredAt: -1 })
      .limit(limit)
      .populate("problem", "_id title difficulty platformName")
      .populate("topic", "_id name")
      .lean();

    res.json({ activities });
  })
);

app.post(
  "/api/activity",
  asyncHandler(async (req, res) => {
    const body = req.body ?? {};
    const kind: ActivityKind | undefined =
      body.kind === "solved" || body.kind === "revision" || body.kind === "revisit" ? body.kind : undefined;
    const occurredAt = toValidDate(body.occurredAt) ?? new Date();
    const problemId: string | undefined = typeof body.problemId === "string" ? body.problemId : undefined;
    const topicId: string | undefined = typeof body.topicId === "string" ? body.topicId : undefined;

    if (!kind || !problemId || !topicId) {
      res.status(400).json({ message: "Missing required fields: problemId, topicId, kind" });
      return;
    }

    // Day-level dedup: one record per (problem, kind, calendar day)
    const dayStart = new Date(occurredAt);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(occurredAt);
    dayEnd.setHours(23, 59, 59, 999);

    if (storageMode === "memory") {
      const problem = memoryProblems.find((entry) => entry._id === problemId);
      if (!problem) {
        res.status(404).json({ message: "Problem not found" });
        return;
      }

      const existing = memoryActivities.find(
        (entry) =>
          entry.problemId === problemId &&
          entry.kind === kind &&
          entry.occurredAt >= dayStart &&
          entry.occurredAt <= dayEnd
      );

      if (existing) {
        res.json({ activity: toMemoryActivityResponse(existing) });
        return;
      }

      appendMemoryActivity(problem, kind, occurredAt);
      const created = memoryActivities.find(
        (entry) =>
          entry.problemId === problemId &&
          entry.kind === kind &&
          entry.occurredAt >= dayStart &&
          entry.occurredAt <= dayEnd
      );
      res.json({ activity: created ? toMemoryActivityResponse(created) : null });
      return;
    }

    // MongoDB: find or create by (problem, kind, day window)
    const existing = await Activity.findOne({
      problem: problemId,
      kind,
      occurredAt: { $gte: dayStart, $lte: dayEnd },
    })
      .populate("problem", "_id title difficulty platformName")
      .populate("topic", "_id name")
      .lean();

    if (existing) {
      res.json({ activity: existing });
      return;
    }

    const created = await Activity.create({
      problem: problemId,
      topic: topicId,
      kind,
      occurredAt,
    });

    const populated = await Activity.findById(created._id)
      .populate("problem", "_id title difficulty platformName")
      .populate("topic", "_id name")
      .lean();

    res.json({ activity: populated });
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
      codeSnippet = "",
      codeSnippetLang = "cpp",
      mistakeLog = "",
      mistakeTrigger = "",
      mistakeReason = "",
      mistakeFix = "",
      invariant = "",
      compareBruteForce = "",
      compareOptimized = "",
      compareWhyBetter = "",
      prerequisites = [],
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
      const isSolvedLike = isRevisionActiveStatus(status);
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
        codeSnippet,
        codeSnippetLang,
        mistakeLog,
        mistakeTrigger,
        mistakeReason,
        mistakeFix,
        invariant,
        compareBruteForce,
        compareOptimized,
        compareWhyBetter,
        prerequisites: Array.isArray(prerequisites) ? prerequisites : [],
        pattern,
        rating,
        revisionCount: 0,
        revisionStage: 0,
        solvedAt: status === "solved" ? now : undefined,
        revisitAt: status === "revisit" ? now : undefined,
        lastRevisionAt: isSolvedLike ? now : undefined,
        nextRevisionAt: isSolvedLike ? addDays(now, revisionIntervalsDays[0] ?? 1) : undefined,
        revisionCompletedAt: undefined,
        tags,
        priority,
        isPinned,
        createdAt: now,
        updatedAt: now,
      };

      memoryProblems = [problem, ...memoryProblems.filter((entry) => entry._id !== problem._id)];
      if (problem.solvedAt) {
        appendMemoryActivity(problem, "solved", problem.solvedAt);
      }
      if (problem.revisitAt) {
        appendMemoryActivity(problem, "revisit", problem.revisitAt);
      }
      res.status(201).json({ problem: toMemoryProblemResponse(problem) });
      return;
    }

    const now = new Date();
    const isSolvedLike = isRevisionActiveStatus(status);
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
      codeSnippet,
      codeSnippetLang,
      mistakeLog,
      mistakeTrigger,
      mistakeReason,
      mistakeFix,
      invariant,
      compareBruteForce,
      compareOptimized,
      compareWhyBetter,
      prerequisites: Array.isArray(prerequisites) ? prerequisites : [],
      tags,
      priority,
      isPinned,
      revisionCount: 0,
      revisionStage: 0,
      solvedAt,
      revisitAt,
      lastRevisionAt: isSolvedLike ? now : undefined,
      nextRevisionAt: isSolvedLike ? addDays(now, revisionIntervalsDays[0] ?? 1) : undefined,
    });

    if (created.solvedAt) {
      await recordMongoActivity(created, "solved", created.solvedAt);
    }
    if (created.revisitAt) {
      await recordMongoActivity(created, "revisit", created.revisitAt);
    }

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
        codeSnippet: next.codeSnippet ?? problem.codeSnippet,
        codeSnippetLang: next.codeSnippetLang ?? problem.codeSnippetLang,
        mistakeLog: next.mistakeLog ?? problem.mistakeLog,
        mistakeTrigger: next.mistakeTrigger ?? problem.mistakeTrigger,
        mistakeReason: next.mistakeReason ?? problem.mistakeReason,
        mistakeFix: next.mistakeFix ?? problem.mistakeFix,
        invariant: next.invariant ?? problem.invariant,
        compareBruteForce: next.compareBruteForce ?? problem.compareBruteForce,
        compareOptimized: next.compareOptimized ?? problem.compareOptimized,
        compareWhyBetter: next.compareWhyBetter ?? problem.compareWhyBetter,
        prerequisites: Array.isArray(next.prerequisites) ? next.prerequisites : problem.prerequisites,
        tags: Array.isArray(next.tags) ? next.tags : problem.tags,
        priority: typeof next.priority === "number" ? next.priority : problem.priority,
        isPinned: typeof next.isPinned === "boolean" ? next.isPinned : problem.isPinned,
        updatedAt: now,
      });

      syncRevisionScheduleForStatus(problem, previousStatus, now);
      applyRevisionProgressPatch(problem, next);

      if (problem.status === "solved" && previousStatus !== "solved") {
        problem.solvedAt = problem.solvedAt ?? now;
        appendMemoryActivity(problem, "solved", now);
      }
      if (problem.status === "revisit" && previousStatus !== "revisit") {
        problem.revisitAt = problem.revisitAt ?? now;
        appendMemoryActivity(problem, "revisit", now);
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
      codeSnippet: next.codeSnippet ?? problem.codeSnippet,
      codeSnippetLang: next.codeSnippetLang ?? problem.codeSnippetLang,
      mistakeLog: next.mistakeLog ?? problem.mistakeLog,
      mistakeTrigger: next.mistakeTrigger ?? problem.mistakeTrigger,
      mistakeReason: next.mistakeReason ?? problem.mistakeReason,
      mistakeFix: next.mistakeFix ?? problem.mistakeFix,
      invariant: next.invariant ?? problem.invariant,
      compareBruteForce: next.compareBruteForce ?? problem.compareBruteForce,
      compareOptimized: next.compareOptimized ?? problem.compareOptimized,
      compareWhyBetter: next.compareWhyBetter ?? problem.compareWhyBetter,
      prerequisites: Array.isArray(next.prerequisites) ? next.prerequisites : problem.prerequisites,
      tags: Array.isArray(next.tags) ? next.tags : problem.tags,
      priority: typeof next.priority === "number" ? next.priority : problem.priority,
      isPinned: typeof next.isPinned === "boolean" ? next.isPinned : problem.isPinned,
    });

    syncRevisionScheduleForStatus(problem, previousStatus, now);
    applyRevisionProgressPatch(problem, next);

    if (problem.status === "solved" && previousStatus !== "solved") {
      problem.solvedAt = problem.solvedAt ?? now;
      await recordMongoActivity(problem, "solved", now);
    }
    if (problem.status === "revisit" && previousStatus !== "revisit") {
      problem.revisitAt = problem.revisitAt ?? now;
      await recordMongoActivity(problem, "revisit", now);
    }

    await problem.save();
    const populated = await problem.populate("topic");
    res.json({ problem: populated });
  })
);

app.post(
  "/api/problems/:id/revision",
  asyncHandler(async (req, res) => {
    // Accept the frontend's active SRS preset intervals so the server advances
    // the schedule using the same cadence the user has selected (standard/aggressive/relaxed).
    // Falls back to the default [1,3,7,14,30,60] schedule if not provided.
    const rawIntervals: unknown = req.body?.srsIntervals;
    const srsIntervals: number[] | undefined =
      Array.isArray(rawIntervals) &&
      rawIntervals.length > 0 &&
      rawIntervals.every((v) => typeof v === "number" && Number.isFinite(v) && v > 0)
        ? (rawIntervals as number[])
        : undefined;

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

       if (!canCompleteRevisionToday(problem)) {
        res.status(409).json({ message: "Revision already completed for this problem today or schedule is inactive." });
        return;
      }

      advanceRevisionSchedule(problem, new Date(), srsIntervals);

      problem.updatedAt = new Date();
      appendMemoryActivity(problem, "revision", problem.lastRevisionAt ?? problem.updatedAt);
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

    if (!canCompleteRevisionToday(problem)) {
      res.status(409).json({ message: "Revision already completed for this problem today or schedule is inactive." });
      return;
    }

    advanceRevisionSchedule(problem, new Date(), srsIntervals);

    await problem.save();
    await recordMongoActivity(problem, "revision", problem.lastRevisionAt ?? new Date());
    const populated = await problem.populate("topic");
    res.json({ problem: populated });
  })
);

// Recalculate nextRevisionAt for all active revision problems using new SRS intervals.
// Called when the user switches SRS preset so existing schedules stay consistent.
app.post(
  "/api/problems/reschedule-all",
  asyncHandler(async (req, res) => {
    const rawIntervals: unknown = req.body?.srsIntervals;
    const srsIntervals: number[] | undefined =
      Array.isArray(rawIntervals) &&
      rawIntervals.length > 0 &&
      rawIntervals.every((v) => typeof v === "number" && Number.isFinite(v) && v > 0)
        ? (rawIntervals as number[])
        : undefined;

    if (!srsIntervals) {
      res.status(400).json({ message: "srsIntervals is required and must be a non-empty array of positive numbers" });
      return;
    }

    if (storageMode === "memory") {
      let count = 0;
      for (const problem of memoryProblems) {
        if (!isRevisionActiveStatus(problem.status)) continue;
        const lastRev = toValidDate(problem.lastRevisionAt);
        if (!lastRev) continue;
        const stage = Math.max(problem.revisionStage ?? 0, 0);
        if (stage >= srsIntervals.length) continue; // already complete
        const nextIntervalDays = srsIntervals[stage] ?? srsIntervals[srsIntervals.length - 1];
        problem.nextRevisionAt = addDays(lastRev, nextIntervalDays);
        problem.updatedAt = new Date();
        count++;
      }
      res.json({ rescheduled: count });
      return;
    }

    const problems = await Problem.find({
      status: { $in: ["solved", "revisit"] },
      lastRevisionAt: { $exists: true, $ne: null },
      revisionCompletedAt: { $exists: false },
      nextRevisionAt: { $exists: true, $ne: null },
    }).select("_id revisionStage lastRevisionAt nextRevisionAt");

    const writes = problems
      .map((problem) => {
        const stage = Math.max(problem.revisionStage ?? 0, 0);
        if (stage >= srsIntervals.length) return null;
        const lastRev = toValidDate(problem.lastRevisionAt);
        if (!lastRev) return null;
        const nextIntervalDays = srsIntervals[stage] ?? srsIntervals[srsIntervals.length - 1];
        const newNextRevisionAt = addDays(lastRev, nextIntervalDays);
        return {
          updateOne: {
            filter: { _id: problem._id },
            update: { $set: { nextRevisionAt: newNextRevisionAt } },
          },
        };
      })
      .filter(Boolean);

    if (writes.length > 0) {
      await Problem.bulkWrite(writes as Parameters<typeof Problem.bulkWrite>[0]);
    }

    res.json({ rescheduled: writes.length });
  })
);

// Snooze a revision: push nextRevisionAt forward by N days without incrementing revisionCount.
app.post(
  "/api/problems/:id/snooze",
  asyncHandler(async (req, res) => {
    const days = Math.min(Math.max(Number(req.body?.days) || 1, 1), 30);

    if (storageMode === "memory") {
      const problem = memoryProblems.find((entry) => entry._id === req.params.id);
      if (!problem) {
        res.status(404).json({ message: "Problem not found" });
        return;
      }

      const base = toValidDate(problem.nextRevisionAt) ?? new Date();
      problem.nextRevisionAt = addDays(base, days);
      problem.updatedAt = new Date();
      res.json({ problem: toMemoryProblemResponse(problem) });
      return;
    }

    const problem = await Problem.findById(req.params.id);
    if (!problem) {
      res.status(404).json({ message: "Problem not found" });
      return;
    }

    const base = toValidDate(problem.nextRevisionAt) ?? new Date();
    problem.nextRevisionAt = addDays(base, days);
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

      memoryActivities = memoryActivities.filter((entry) => entry.problemId !== req.params.id);
      memoryProblems = nextProblems;
      res.json({ message: "Problem deleted" });
      return;
    }

    const deleted = await Problem.findByIdAndDelete(req.params.id);
    if (!deleted) {
      res.status(404).json({ message: "Problem not found" });
      return;
    }

    await Activity.deleteMany({ problem: req.params.id });

    res.json({ message: "Problem deleted" });
  })
);

app.get(
  "/api/general-notes",
  asyncHandler(async (req, res) => {
    const search = normalizeSearch(req.query.search);
    const category = normalizeSearch(req.query.category);
    const tag = normalizeSearch(req.query.tag);

    if (storageMode === "memory") {
      let filtered = memoryGeneralNotes.slice();
      if (category && category !== "all") {
        filtered = filtered.filter((n) => n.category === category);
      }
      if (tag && tag !== "all") {
        filtered = filtered.filter((n) => n.tags.includes(tag));
      }
      if (search) {
        const query = search.toLowerCase();
        filtered = filtered.filter((n) =>
          [n.title, n.summary, n.content, ...n.tags, ...(n.keyTakeaways ?? [])]
            .join(" ")
            .toLowerCase()
            .includes(query)
        );
      }
      filtered.sort((a, b) => (b.isPinned ? 1 : 0) - (a.isPinned ? 1 : 0));
      res.json({ notes: filtered });
      return;
    }

    const filter: Record<string, unknown> = {};
    if (category && category !== "all") {
      filter.category = category;
    }
    if (tag && tag !== "all") {
      filter.tags = tag;
    }
    if (search) {
      filter.$text = { $search: search };
    }

    const notes = await GeneralNoteModelExport.find(filter).sort({ isPinned: -1, updatedAt: -1 }).lean();
    res.json({ notes });
  })
);

app.post(
  "/api/general-notes",
  asyncHandler(async (req, res) => {
    const body = req.body;
    if (!body.title) {
      res.status(400).json({ message: "Title is required" });
      return;
    }

    if (storageMode === "memory") {
      const newNote: GeneralNote = {
        _id: `note:${Date.now()}`,
        title: body.title,
        category: body.category || "Algorithmic Patterns",
        summary: body.summary || "",
        content: body.content || "",
        keyTakeaways: body.keyTakeaways || [],
        mistakesToAvoid: body.mistakesToAvoid || [],
        codeSnippets: body.codeSnippets || [],
        tags: body.tags || [],
        importance: body.importance || "Important",
        isPinned: Boolean(body.isPinned),
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      memoryGeneralNotes = [newNote, ...memoryGeneralNotes];
      res.json({ note: newNote });
      return;
    }

    const note = await GeneralNoteModelExport.create(body);
    res.json({ note });
  })
);

app.patch(
  "/api/general-notes/:id",
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const body = req.body;

    if (storageMode === "memory") {
      const idx = memoryGeneralNotes.findIndex((n) => n._id === id);
      if (idx === -1) {
        res.status(404).json({ message: "Note not found" });
        return;
      }
      const updated = {
        ...memoryGeneralNotes[idx],
        ...body,
        updatedAt: new Date(),
      };
      memoryGeneralNotes[idx] = updated;
      res.json({ note: updated });
      return;
    }

    const updated = await GeneralNoteModelExport.findByIdAndUpdate(id, { $set: body }, { new: true }).lean();
    if (!updated) {
      res.status(404).json({ message: "Note not found" });
      return;
    }
    res.json({ note: updated });
  })
);

app.delete(
  "/api/general-notes/:id",
  asyncHandler(async (req, res) => {
    const { id } = req.params;

    if (storageMode === "memory") {
      memoryGeneralNotes = memoryGeneralNotes.filter((n) => n._id !== id);
      res.json({ message: "Note deleted" });
      return;
    }

    await GeneralNoteModelExport.findByIdAndDelete(id);
    res.json({ message: "Note deleted" });
  })
);

app.get("/api/health", (_req, res) => {
  res.status(databaseReady ? 200 : 503).json({
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

if (!process.env.VERCEL) {
  app.listen(port, () => {
    console.log(`API running on port ${port}`);
  });
}

export default app;

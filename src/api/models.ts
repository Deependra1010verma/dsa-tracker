import mongoose from "mongoose";
import { topicSeeds } from "./seed.js";

const topicSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    slug: { type: String, required: true, unique: true },
    problemSet: { type: String, required: true, default: "set1", index: true },
    order: { type: Number, required: true },
    targetCount: { type: Number, required: true },
    description: { type: String, required: true },
    accent: { type: String, required: true },
  },
  { timestamps: true }
);

const problemSchema = new mongoose.Schema(
  {
    problemKey: { type: String, index: true, sparse: true },
    isSeeded: { type: Boolean, default: false, index: true },
    title: { type: String, required: true },
    topic: { type: mongoose.Schema.Types.ObjectId, ref: "Topic", required: true },
    problemSet: { type: String, required: true, default: "set1", index: true },
    platformName: { type: String, required: true },
    platformUrl: { type: String, required: true },
    roadmapSection: { type: String, default: "" },
    roadmapSectionOrder: { type: Number, default: 999 },
    roadmapOrder: { type: Number, default: 999 },
    difficulty: {
      type: String,
      enum: ["Easy", "Medium", "Hard"],
      default: "Easy",
    },
    status: {
      type: String,
      enum: ["unsolved", "solved", "revisit", "skipped"],
      default: "unsolved",
    },
    shortNote: { type: String, default: "" },
    longNote: { type: String, default: "" },
    mistakeLog: { type: String, default: "" },
    mistakeTrigger: { type: String, default: "" },
    mistakeReason: { type: String, default: "" },
    mistakeFix: { type: String, default: "" },
    pattern: { type: String, default: "" },
    invariant: { type: String, default: "" },
    compareBruteForce: { type: String, default: "" },
    compareOptimized: { type: String, default: "" },
    compareWhyBetter: { type: String, default: "" },
    rating: { type: Number, default: 0 },
    revisionCount: { type: Number, default: 0 },
    revisionStage: { type: Number, default: 0 },
    solvedAt: { type: Date },
    revisitAt: { type: Date },
    lastRevisionAt: { type: Date },
    nextRevisionAt: { type: Date, index: true },
    revisionCompletedAt: { type: Date },
    tags: [{ type: String }],
    priority: { type: Number, default: 0 },
    isPinned: { type: Boolean, default: false },
  },
  { timestamps: true }
);

problemSchema.index({ title: "text", shortNote: "text", longNote: "text", platformName: "text" });

const activitySchema = new mongoose.Schema(
  {
    problem: { type: mongoose.Schema.Types.ObjectId, ref: "Problem", required: true, index: true },
    topic: { type: mongoose.Schema.Types.ObjectId, ref: "Topic", required: true, index: true },
    kind: {
      type: String,
      enum: ["solved", "revision", "revisit"],
      required: true,
      index: true,
    },
    occurredAt: { type: Date, required: true, index: true },
  },
  { timestamps: true }
);

activitySchema.index({ problem: 1, kind: 1, occurredAt: 1 });

const TopicModel = mongoose.model("Topic", topicSchema);
export const Topic = (mongoose.models.Topic as typeof TopicModel) || TopicModel;

const ProblemModel = mongoose.model("Problem", problemSchema);
export const Problem = (mongoose.models.Problem as typeof ProblemModel) || ProblemModel;

const ActivityModel = mongoose.model("Activity", activitySchema);
export const Activity = (mongoose.models.Activity as typeof ActivityModel) || ActivityModel;
export { topicSeeds };
